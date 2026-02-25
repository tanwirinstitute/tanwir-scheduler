import admin from "firebase-admin";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { sendWelcomeEmail } from './emailService.js';

dotenv.config();

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          "base64"
        ).toString()
      : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) throw new Error("Missing Firebase credentials");

    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    logger.info("Firebase initialized");
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Save Badr Program data to the programs collection
 * @param {Array} programRecords - Badr Program records
 */
async function saveProgramsToFirestore(programRecords) {
  if (!programRecords || programRecords.length === 0) {
    logger.info("No program records to save");
    return 0;
  }

  const db = admin.firestore();
  const batch = db.batch();
  let successCount = 0;

  for (const program of programRecords) {
    try {
      const programId = program.programId;
      const docRef = db.collection("programs").doc(programId);

      // Check if program already exists
      const existingDoc = await docRef.get();
      
      if (existingDoc.exists) {
        logger.info(`Program ${programId} already exists, skipping`);
        continue;
      }

      // Add new program
      batch.set(docRef, {
        ...program,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      });

      successCount++;
      logger.info(`Added new program ${programId}`);
    } catch (error) {
      logger.error(`Error processing program ${program.programId}:`, error);
    }
  }

  await batch.commit();
  logger.info(`Saved ${successCount} program records to Firestore`);
  return successCount;
}

/**
 * Save processed Squarespace orders to Firestore
 * @param {Array} studentRecords - Already formatted and grouped student records
 */
export async function saveToFirestore(studentRecords) {
  try {
    if (!studentRecords || studentRecords.length === 0) {
      logger.info("No student records to save");
      return;
    }

    initializeFirebase();
    
    // Separate Badr Program records from student course records
    const badrProgramRecords = studentRecords.filter(
      record => record.programType === "BadrProgram"
    );
    const courseRecords = studentRecords.filter(
      record => record.courseType === "AssociatesProgram" || record.courseType === "PropheticGuidance"
    );
    
    logger.info(`Found ${badrProgramRecords.length} Badr Program records and ${courseRecords.length} course records`);
    
    // Save Badr Program records to programs collection
    if (badrProgramRecords.length > 0) {
      await saveProgramsToFirestore(badrProgramRecords);
    }
    
    // Process course records for authorizedUsers collection
    if (courseRecords.length === 0) {
      logger.info("No course records to save to authorizedUsers");
      return;
    }
    
    const db = admin.firestore();
    const batch = db.batch();
    
    // Group records by email to handle multiple courses for the same student
    const studentsByEmail = {};
    
    // First, group all records by email
    courseRecords.forEach(record => {
      // Skip records without student info or email
      if (!record.studentInfo || !record.studentInfo.email) {
        logger.warn(`Skipping record with missing student email: ${JSON.stringify(record)}`);
        return;
      }
      
      const email = record.studentInfo.email.toLowerCase().trim();
      
      if (!studentsByEmail[email]) {
        studentsByEmail[email] = [];
      }
      
      studentsByEmail[email].push(record);
    });
    
    logger.info(`Processing ${Object.keys(studentsByEmail).length} unique students`);
    
    let successCount = 0;
    
    // Process each unique student
    for (const email of Object.keys(studentsByEmail)) {
      try {
        const coursesForUser = studentsByEmail[email];
        const docRef = db.collection("authorizedUsers").doc(email);
        
                // Query for existing user with this email in studentInfo.email
                const userQuery = await db
                .collection("authorizedUsers")
                .where("studentInfo.email", "==", email)
                .limit(1)
                .get();
              
        
        if (!userQuery.empty) {
          // User exists, check for new courses to add
          const existingUserDoc = userQuery.docs[0];
          const existingUserData = existingUserDoc.data();
          const existingCourses = existingUserData.courses || [];
          
          // Create a map of existing courses by courseId for quick lookup
          const existingCourseMap = {};
          existingCourses.forEach(course => {
            const key = course.courseId || course.orderNumber;
            existingCourseMap[key] = true;
          });
          
          // Filter out courses that already exist
          const newCourses = coursesForUser.filter(course => {
            const courseKey = course.courseId || course.orderNumber;
            return !existingCourseMap[courseKey];
          });
          
          if (newCourses.length > 0) {
            // Extract course data without studentInfo to avoid duplication
            const coursesToAdd = newCourses.map(course => {
              const { studentInfo: _, ...courseOnly } = course;
              return courseOnly;
            });
            
            // Update the user with new courses
            batch.update(existingUserDoc.ref, {
              courses: admin.firestore.FieldValue.arrayUnion(...coursesToAdd),
              lastSynced: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            successCount += newCourses.length;
          } else {
            logger.info(`No new courses to add for user ${email}`);
          }
        } else {
          // New user, add all courses
          const firstCourse = coursesForUser[0];
          const { studentInfo } = firstCourse;
          
          // Extract course data without studentInfo to avoid duplication
          const courses = coursesForUser.map(course => {
            const { studentInfo: _, ...courseOnly } = course;
            return courseOnly;
          });
          
          try {
            logger.info(`Preparing to save new user with email ${email} and ${courses.length} courses`);
            
            // Create Firebase Authentication user
            try {
              logger.info(`Creating Firebase Authentication user for ${email}`);
              await admin.auth().createUser({
                email: email,
                password: studentInfo.password || uuidv4().substring(0, 8),
                displayName: `${studentInfo.firstName} ${studentInfo.lastName}`.trim(),
                disabled: false
              });
              logger.info(`Firebase Authentication user created for ${email}`);
            } catch (authError) {
              // Check if error is because user already exists
              if (authError.code === 'auth/email-already-exists') {
                logger.info(`Firebase Authentication user already exists for ${email}`);
              } else {
                logger.error(`Error creating Firebase Authentication user for ${email}:`, authError);
              }
            }
            
            batch.set(docRef, {
              studentInfo,
              courses,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSynced: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            successCount += courses.length;
            logger.info(`Created new user ${email} with ${courses.length} courses`);
            
            // Send welcome email to new student
            const newStudent = {
              studentInfo,
              courses
            };
            sendWelcomeEmail(newStudent)
              .then(sent => {
                if (sent) {
                  logger.info(`Welcome email sent to new student ${email}`);
                } else {
                  logger.warn(`Failed to send welcome email to ${email}`);
                }
              })
              .catch(emailError => {
                logger.error(`Error sending welcome email to ${email}:`, emailError);
              });
          } catch (saveError) {
            logger.error(`Error saving new user with email ${email}:`, saveError);
          }
        }
      } catch (userError) {
        logger.error(`Error processing user with email ${email}:`, userError);
      }
    }
    
    // Commit all the batched writes
    await batch.commit();
    logger.info(`Saved/updated ${successCount} user records in Firestore`);
    
    return successCount;
  } catch (error) {
    logger.error("Failed to save to Firestore:", error);
    throw error;
  }
}
