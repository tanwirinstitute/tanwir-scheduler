/**
 * Manually add a course to an existing authorizedUsers document.
 *
 * Usage:
 *   node scripts/addCourse.js --type <PG|AP> --email <email> --section <section> --plan <plan>
 *
 * Examples:
 *   node scripts/addCourse.js --type PG --email rdqa0206@gmail.com --section "Year 2" --plan "Full Payment"
 *   node scripts/addCourse.js --type AP --email someone@gmail.com --section "Year 1" --plan "Monthly"
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

const COURSE_TYPES = {
  PG: "PropheticGuidance",
  AP: "AssociatesProgram",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };

  const type = get("--type");
  const email = get("--email");
  const section = get("--section");
  const plan = get("--plan");

  if (!type || !email || !section || !plan) {
    console.error("Usage: node scripts/addCourse.js --type <PG|AP> --email <email> --section <section> --plan <plan>");
    process.exit(1);
  }

  if (!COURSE_TYPES[type]) {
    console.error(`Unknown type "${type}". Use PG (Prophetic Guidance) or AP (Associates Program).`);
    process.exit(1);
  }

  return { type, email: email.toLowerCase().trim(), section, plan };
}

function buildCourse(type, email, section, plan) {
  const slug = section.toLowerCase().replace(/\s+/g, "-");

  if (type === "PG") {
    return {
      courseId: `manual-pg-${slug}-${email}`,
      orderNumber: "MANUAL",
      createdOn: new Date().toISOString(),
      courseName: "Prophetic Guidance",
      courseType: "PropheticGuidance",
      courseRef: `courses/Prophetic Guidance Foundations - ${section}`,
      guidanceDetails: {
        module: "General",
        plan,
        section,
        imageUrl: "",
        status: "enrolled",
      },
      metadata: { lastUpdated: new Date().toISOString() },
    };
  }

  // AP
  return {
    courseId: `manual-ap-${slug}-${email}`,
    orderNumber: "MANUAL",
    createdOn: new Date().toISOString(),
    courseName: "Associates Program",
    courseType: "AssociatesProgram",
    courseRef: `courses/Associates Program ${section}`,
    placementInfo: {
      level: section,
      section,
      plan,
      arabicProficiency: "",
      readingAbility: "",
      writingAbility: "",
      listeningAbility: "",
      studiedIslamicSciences: "",
      previousTopics: "",
      interestReason: "",
    },
    metadata: { lastUpdated: new Date().toISOString() },
  };
}

function alreadyEnrolled(existingCourses, type, section, plan) {
  if (type === "PG") {
    return existingCourses.some(
      c => c.courseType === "PropheticGuidance" &&
           c.guidanceDetails?.section === section &&
           c.guidanceDetails?.plan === plan
    );
  }
  // AP duplicate check matches firebase.js logic (section only, no plan)
  return existingCourses.some(
    c => c.courseType === "AssociatesProgram" &&
         c.placementInfo?.section === section
  );
}

function initializeFirebase() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString()
    : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) throw new Error("Missing Firebase credentials");

  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountJson)) });
}

async function run() {
  const { type, email, section, plan } = parseArgs();
  const courseTypeName = COURSE_TYPES[type];

  initializeFirebase();
  const db = admin.firestore();

  const snapshot = await db
    .collection("authorizedUsers")
    .where("studentInfo.email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();
  const existingCourses = userData.courses || [];

  logger.info(`Found user: ${userData.studentInfo?.firstName} ${userData.studentInfo?.lastName}`);
  logger.info(`Current courses (${existingCourses.length}):`);
  existingCourses.forEach(c =>
    logger.info(`  - ${c.courseName} | ${c.courseType} | section: ${c.guidanceDetails?.section || c.placementInfo?.section || "n/a"} | plan: ${c.guidanceDetails?.plan || c.placementInfo?.plan || "n/a"}`)
  );

  if (alreadyEnrolled(existingCourses, type, section, plan)) {
    logger.warn(`${courseTypeName} ${section} (${plan}) already exists for ${email}. No changes made.`);
    process.exit(0);
  }

  const newCourse = buildCourse(type, email, section, plan);

  await userDoc.ref.update({
    courses: admin.firestore.FieldValue.arrayUnion(newCourse),
    lastSynced: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Successfully added ${courseTypeName} ${section} (${plan}) to ${email}.`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error("Script failed:", err);
    process.exit(1);
  });
