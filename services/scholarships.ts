import admin from "firebase-admin";
import { getDb } from "./firebase.js";
import { logger } from "../utils/logger.js";
import type { ScholarshipDocument, ScholarshipRecord } from "../types/scholarship.js";

const SCHOLARSHIPS_COLLECTION = process.env.SCHOLARSHIPS_COLLECTION || "scholarships";

/**
 * "Unapproved" means the document has no `status` field set at all (rather
 * than an explicit "unapproved" value), and Firestore can't query for field
 * absence directly, so that part of the filter is applied in memory after
 * fetching everyone with zakat === "yes".
 *
 * `consentEmailSentAt` gates re-sending: without it, every cron tick would
 * re-email anyone still unapproved.
 */
export async function fetchPendingZakatConsentScholarships(): Promise<ScholarshipRecord[]> {
  const db = getDb();

  const snapshot = await db
    .collection(SCHOLARSHIPS_COLLECTION)
    .where("zakat", "==", "yes")
    .get();

  const pending: ScholarshipRecord[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as ScholarshipDocument;
    if (data.status === undefined && data.consentEmailSentAt === undefined) {
      pending.push({ id: doc.id, data });
    }
  });

  return pending;
}

export async function markConsentEmailSent(docId: string): Promise<void> {
  const db = getDb();
  await db.collection(SCHOLARSHIPS_COLLECTION).doc(docId).update({
    consentEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export interface ConsentResult {
  alreadyConsented: boolean;
}

/**
 * Idempotent: revisiting the link after consent is already recorded doesn't
 * overwrite the original consentedAt.
 */
export async function recordScholarshipConsent(docId: string): Promise<ConsentResult | null> {
  const db = getDb();
  const docRef = db.collection(SCHOLARSHIPS_COLLECTION).doc(docId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as ScholarshipDocument;
  if (data.consented === true) {
    return { alreadyConsented: true };
  }

  await docRef.update({
    consented: true,
    consentedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Recorded zakat consent for scholarship ${docId}`);
  return { alreadyConsented: false };
}
