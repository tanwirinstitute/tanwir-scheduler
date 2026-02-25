import axios from "axios";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { logger } from "../utils/logger.js";
import { mapCourseToModel } from "../models/courseMapper.js";

dotenv.config();

const SQUARESPACE_API_KEY = process.env.SQUARESPACE_API_KEY;
const SQUARESPACE_API_URL = process.env.SQUARESPACE_API_URL || "https://api.squarespace.com/1.0";

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString()
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

async function fetchAllOrders() {
  let allOrders = [];
  let cursor = null;

  logger.info("Fetching all orders from Squarespace...");

  do {
    const response = await axios.get(`${SQUARESPACE_API_URL}/commerce/orders`, {
      headers: {
        Authorization: `Bearer ${SQUARESPACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      params: {
        cursor,
      },
    });

    const result = response.data?.result || [];
    allOrders = [...allOrders, ...result];
    cursor = response.data?.pagination?.nextPageCursor || null;

    logger.info(`Fetched ${result.length} orders (total: ${allOrders.length})`);
  } while (cursor);

  return allOrders;
}

async function saveProgramsToFirestore(programRecords) {
  if (!programRecords || programRecords.length === 0) {
    logger.info("No program records to save");
    return 0;
  }

  const db = admin.firestore();
  const batch = db.batch();
  let successCount = 0;
  let skippedCount = 0;

  for (const program of programRecords) {
    try {
      const programId = program.programId;
      const docRef = db.collection("programs").doc(programId);

      const existingDoc = await docRef.get();
      
      if (existingDoc.exists) {
        logger.info(`Program ${programId} already exists, skipping`);
        skippedCount++;
        continue;
      }

      batch.set(docRef, {
        ...program,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      });

      successCount++;
      logger.info(`Added new program ${programId} for ${program.participantInfo.email}`);
    } catch (error) {
      logger.error(`Error processing program ${program.programId}:`, error);
    }
  }

  await batch.commit();
  logger.info(`Saved ${successCount} new program records, skipped ${skippedCount} existing records`);
  return successCount;
}

async function backfillBadrProgram() {
  try {
    logger.info("=== Starting Badr Program Backfill ===");
    
    initializeFirebase();

    const allOrders = await fetchAllOrders();
    logger.info(`Total orders fetched: ${allOrders.length}`);

    const badrOrders = allOrders.filter((order) =>
      order.lineItems?.some((item) => 
        item.lineItemType === "SERVICE" && 
        item.productName?.toLowerCase().includes("badr")
      )
    );

    logger.info(`Found ${badrOrders.length} orders with Badr Program items`);

    if (badrOrders.length === 0) {
      logger.info("No Badr Program orders found. Exiting.");
      return;
    }

    const allMappedRecords = [];
    
    for (const order of badrOrders) {
      try {
        const mapped = mapCourseToModel(order);
        if (Array.isArray(mapped)) {
          const badrRecords = mapped.filter(record => record.programType === "BadrProgram");
          allMappedRecords.push(...badrRecords);
        }
      } catch (error) {
        logger.error(`Error mapping order ${order.id}:`, error);
      }
    }

    logger.info(`Mapped ${allMappedRecords.length} Badr Program records`);

    if (allMappedRecords.length > 0) {
      const savedCount = await saveProgramsToFirestore(allMappedRecords);
      logger.info(`=== Backfill Complete: ${savedCount} records saved ===`);
    } else {
      logger.info("No Badr Program records to save");
    }

  } catch (error) {
    logger.error("Error during backfill:", error);
    throw error;
  } finally {
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}

backfillBadrProgram();
