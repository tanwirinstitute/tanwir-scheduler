import admin from "firebase-admin";
import dotenv from "dotenv";
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize Firebase properly
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

    logger.info("Firebase initialized for renameDoc script");
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

async function renameDoc() {
  try {
    // Initialize Firebase with proper credentials
    initializeFirebase();
    
    const db = admin.firestore();
    const oldId = "Shaziak86@gmail.com";
    const newId = "8JxTVCTeXbbF69QrupZbyoL8HIS2";

    logger.info(`Attempting to rename document from ${oldId} to ${newId}`);

    const oldRef = db.collection("authorizedUsers").doc(oldId);
    const newRef = db.collection("authorizedUsers").doc(newId);

    // Check if destination already exists
    const newDocSnapshot = await newRef.get();
    if (newDocSnapshot.exists) {
      logger.error(`Cannot rename: Destination document ${newId} already exists`);
      return;
    }

    const snapshot = await oldRef.get();

    if (!snapshot.exists) {
      logger.error(`Old document ${oldId} not found`);
      return;
    }

    // Copy data
    const data = snapshot.data();
    logger.info(`Found document to rename with data: ${JSON.stringify(data, null, 2)}`);
    
    // Update email in studentInfo if it exists
    if (data.studentInfo && data.studentInfo.email) {
      data.studentInfo.email = newId;
    }
    
    // Set the new document
    await newRef.set(data);
    logger.info(`New document created with ID: ${newId}`);

    // Delete old doc
    await oldRef.delete();
    logger.info(`Old document ${oldId} deleted`);

    logger.info("Document ID updated successfully");
    
    // Add a small delay to ensure logs are printed before exit
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    logger.error("Error during document rename:", error);
    process.exit(1);
  }
}

renameDoc();
