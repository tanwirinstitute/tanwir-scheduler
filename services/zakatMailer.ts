import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ZAKAT_MAIL_API_URL = process.env.ZAKAT_MAIL_API_URL || "https://email.tanwir.institute";

export interface SendZakatConsentEmailParams {
  recipientEmail: string;
  studentName: string;
  programName: string;
  consentLink: string;
  additionalDetails?: string;
}

export async function sendZakatConsentEmail(params: SendZakatConsentEmailParams): Promise<void> {
  const token = process.env.ZAKAT_MAIL_API_TOKEN;
  if (!token) {
    throw new Error("Missing ZAKAT_MAIL_API_TOKEN environment variable");
  }

  await axios.post(
    `${ZAKAT_MAIL_API_URL}/send-zakat-consent-email`,
    {
      recipientEmail: params.recipientEmail,
      studentName: params.studentName,
      programName: params.programName,
      consentLink: params.consentLink,
      additionalDetails: params.additionalDetails,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
}
