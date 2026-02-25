#!/usr/bin/env node

/**
 * One-time batch script to update all existing authorizedUsers documents with courseRef fields
 * 
 * This script:
 * 1. Reads all authorizedUsers documents
 * 2. For each user, updates their courses with the appropriate courseRef
 * 3. Writes the updated documents back to Firestore
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

// Initialize Firebase
function initializeFirebase() {
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

    logger.info("Firebase initialized for batch update");
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Generate courseRef based on course type and section
 * @param {Object} course - Course object
 * @returns {string} - courseRef path
 */
function generateCourseRef(course) {
  if (!course.courseType) {
    return null;
  }

  if (course.courseType === "PropheticGuidance") {
    const section = course.guidanceDetails?.section || "";
    return `courses/Prophetic Guidance ${section}`;
  } else if (course.courseType === "AssociatesProgram") {
    const section = course.placementInfo?.section || "";
    return `courses/Associates Program ${section}`;
  }

  return null;
}

/**
 * Update all authorizedUsers documents with courseRef fields
 */
async function updateCourseRefs() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    
    logger.info("Starting batch update of courseRef fields");
    
    // Get all authorizedUsers documents
    const usersSnapshot = await db.collection("authorizedUsers").get();
    
    if (usersSnapshot.empty) {
      logger.info("No users found to update");
      return;
    }
    
    logger.info(`Found ${usersSnapshot.size} users to process`);
    
    // Track statistics
    let updatedUsers = 0;
    let updatedCourses = 0;
    let skippedUsers = 0;
    
    // Process in batches to avoid hitting Firestore limits
    const batchSize = 500;
    let batch = db.batch();
    let operationsInCurrentBatch = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const courses = userData.courses || [];
      
      if (!courses.length) {
        logger.info(`User ${userDoc.id} has no courses, skipping`);
        skippedUsers++;
        continue;
      }
      
      // Track if any courses were updated for this user
      let userUpdated = false;
      
      // Update each course with courseRef if needed
      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        
        // Skip if courseRef already exists
        if (course.courseRef) {
          continue;
        }
        
        const courseRef = generateCourseRef(course);
        
        if (courseRef) {
          courses[i] = {
            ...course,
            courseRef
          };
          userUpdated = true;
          updatedCourses++;
        }
      }
      
      // Only update the document if changes were made
      if (userUpdated) {
        batch.update(userDoc.ref, { 
          courses,
          lastSynced: admin.firestore.FieldValue.serverTimestamp()
        });
        updatedUsers++;
        operationsInCurrentBatch++;
        
        // If we've reached the batch limit, commit and start a new batch
        if (operationsInCurrentBatch >= batchSize) {
          logger.info(`Committing batch of ${operationsInCurrentBatch} operations`);
          await batch.commit();
          batch = db.batch();
          operationsInCurrentBatch = 0;
        }
      }
    }
    
    // Commit any remaining operations
    if (operationsInCurrentBatch > 0) {
      logger.info(`Committing final batch of ${operationsInCurrentBatch} operations`);
      await batch.commit();
    }
    
    logger.info(`Batch update complete. Updated ${updatedUsers} users with ${updatedCourses} courses. Skipped ${skippedUsers} users.`);
    
  } catch (error) {
    logger.error("Error updating courseRef fields:", error);
    throw error;
  }
}

// Run the update function
updateCourseRefs()
  .then(() => {
    logger.info("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
