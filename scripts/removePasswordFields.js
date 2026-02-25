#!/usr/bin/env node

/**
 * Adhoc script to remove password fields from all authorizedUsers documents
 * 
 * This script:
 * 1. Reads all authorizedUsers documents
 * 2. For each user, removes the password field from studentInfo if it exists
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

    logger.info("Firebase initialized for password field removal");
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Remove password fields from all authorizedUsers documents
 */
async function removePasswordFields() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    
    logger.info("Starting batch removal of password fields");
    
    // Get all authorizedUsers documents
    const usersSnapshot = await db.collection("authorizedUsers").get();
    
    if (usersSnapshot.empty) {
      logger.info("No users found to update");
      return;
    }
    
    logger.info(`Found ${usersSnapshot.size} users to process`);
    
    // Track statistics
    let updatedUsers = 0;
    let skippedUsers = 0;
    
    // Process in batches to avoid hitting Firestore limits
    const batchSize = 500;
    let batch = db.batch();
    let operationsInCurrentBatch = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const studentInfo = userData.studentInfo;
      
      if (!studentInfo) {
        logger.info(`User ${userDoc.id} has no studentInfo, skipping`);
        skippedUsers++;
        continue;
      }
      
      // Check if password field exists
      if (studentInfo.password !== undefined) {
        // Create a new studentInfo object without the password field
        const { password, ...studentInfoWithoutPassword } = studentInfo;
        
        // Update the document
        batch.update(userDoc.ref, { 
          studentInfo: studentInfoWithoutPassword,
          lastSynced: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updatedUsers++;
        operationsInCurrentBatch++;
        logger.info(`Removing password field for user ${userDoc.id}`);
        
        // If we've reached the batch limit, commit and start a new batch
        if (operationsInCurrentBatch >= batchSize) {
          logger.info(`Committing batch of ${operationsInCurrentBatch} operations`);
          await batch.commit();
          batch = db.batch();
          operationsInCurrentBatch = 0;
        }
      } else {
        logger.info(`User ${userDoc.id} has no password field, skipping`);
        skippedUsers++;
      }
    }
    
    // Commit any remaining operations
    if (operationsInCurrentBatch > 0) {
      logger.info(`Committing final batch of ${operationsInCurrentBatch} operations`);
      await batch.commit();
    }
    
    logger.info(`Batch update complete. Removed password fields from ${updatedUsers} users. Skipped ${skippedUsers} users.`);
    
  } catch (error) {
    logger.error("Error removing password fields:", error);
    throw error;
  }
}

// Run the update function
removePasswordFields()
  .then(() => {
    logger.info("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
