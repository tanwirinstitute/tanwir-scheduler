#!/usr/bin/env node

/**
 * Adhoc script to update display names for admin users in Firebase Authentication
 * 
 * This script:
 * 1. Takes admin email and display name as command line arguments
 * 2. Updates the Firebase Authentication user's display name
 * 3. Provides detailed logging of the process
 * 
 * Usage:
 * node scripts/updateAdminDisplayNames.js --email admin@example.com --name "Admin Name"
 * 
 * For multiple admins, run the script multiple times with different arguments
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
let email = null;
let displayName = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email" && i + 1 < args.length) {
    email = args[i + 1];
    i++;
  } else if (args[i] === "--name" && i + 1 < args.length) {
    displayName = args[i + 1];
    i++;
  }
}

// Validate arguments
if (!email || !displayName) {
  logger.error("Missing required arguments. Usage: node scripts/updateAdminDisplayNames.js --email admin@example.com --name \"Admin Name\"");
  process.exit(1);
}

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

    logger.info("Firebase initialized for admin display name update");
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Update display name for a Firebase Authentication user
 * @param {string} email - User's email address
 * @param {string} displayName - New display name to set
 */
async function updateUserDisplayName(email, displayName) {
  try {
    initializeFirebase();
    
    logger.info(`Looking up user with email: ${email}`);
    
    // Get the user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    if (!userRecord) {
      logger.error(`User with email ${email} not found`);
      return;
    }
    
    logger.info(`Found user: ${userRecord.uid}, current display name: ${userRecord.displayName || 'none'}`);
    
    // Update the display name
    await admin.auth().updateUser(userRecord.uid, {
      displayName: displayName
    });
    
    logger.info(`Successfully updated display name for ${email} to "${displayName}"`);
    
    // Also check if there's a corresponding Firestore document to update
    const db = admin.firestore();
    const userQuery = await db
      .collection("authorizedUsers")
      .where("studentInfo.email", "==", email.toLowerCase())
      .limit(1)
      .get();
    
    if (!userQuery.empty) {
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      // Update the Firestore document if it exists
      if (userData.studentInfo) {
        await userDoc.ref.update({
          "studentInfo.firstName": displayName.split(" ")[0] || "",
          "studentInfo.lastName": displayName.split(" ").slice(1).join(" ") || "",
          lastSynced: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info(`Also updated Firestore document for ${email}`);
      }
    } else {
      logger.info(`No Firestore document found for ${email}, only Auth user was updated`);
    }
    
  } catch (error) {
    logger.error(`Error updating display name for ${email}:`, error);
    throw error;
  }
}

// Run the update function
updateUserDisplayName(email, displayName)
  .then(() => {
    logger.info("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
