import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import {
  fetchPendingZakatConsentScholarships,
  markConsentEmailSent,
  recordScholarshipConsent,
} from "./services/scholarships.js";
import { sendZakatConsentEmail } from "./services/zakatMailer.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

function getAppBaseUrl(): string {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing APP_BASE_URL environment variable");
  }
  return baseUrl.replace(/\/+$/, "");
}

function renderConsentPage(message: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Zakat Consent</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
<p>${message}</p>
</body>
</html>`;
}

// Basic health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).send({ status: "OK", message: "Scheduler is running" });
});

// Manual trigger endpoint for the scheduler
app.post("/trigger-sync", async (req: Request, res: Response) => {
  try {
    logger.info("Manual sync triggered");
    const result = await runScheduledTask();
    res.status(200).send({ status: "success", ...result });
  } catch (error) {
    logger.error("Manual sync failed:", error);
    res.status(500).send({ status: "error", message: (error as Error).message });
  }
});

// Public link from the consent email — records consent on the scholarship document
app.get("/consent/:docId", async (req: Request, res: Response) => {
  const { docId } = req.params;
  try {
    const result = await recordScholarshipConsent(docId);

    if (result === null) {
      res
        .status(404)
        .send(
          renderConsentPage(
            "We couldn't find that scholarship record. Please contact us if you believe this is an error."
          )
        );
      return;
    }

    const message = result.alreadyConsented
      ? "You've already confirmed your consent — thank you!"
      : "Thank you! Your consent has been recorded.";
    res.status(200).send(renderConsentPage(message));
  } catch (error) {
    logger.error(`Error recording consent for scholarship ${docId}:`, error);
    res
      .status(500)
      .send(
        renderConsentPage(
          "Something went wrong recording your consent. Please try again or contact us."
        )
      );
  }
});

// The main scheduled task that will run according to the cron schedule.
// Finds unapproved zakat-eligible scholarship applicants and emails them a
// consent confirmation link.
async function runScheduledTask(): Promise<{ scholarshipsFound: number; emailsSent: number }> {
  try {
    logger.info("Starting scheduled task to send zakat consent emails");

    const pending = await fetchPendingZakatConsentScholarships();
    logger.info(`Found ${pending.length} scholarship(s) pending zakat consent email`);

    const appBaseUrl = pending.length > 0 ? getAppBaseUrl() : null;
    let emailsSent = 0;

    for (const { id, data } of pending) {
      try {
        const consentLink = `${appBaseUrl}/consent/${id}`;

        await sendZakatConsentEmail({
          recipientEmail: data.email,
          studentName: data.firstName,
          programName: data.course,
          consentLink,
          additionalDetails:
            "Please confirm your consent to receive Zakat-funded enrollment by clicking the link above.",
        });

        await markConsentEmailSent(id);
        emailsSent++;
        logger.info(`Sent zakat consent email for scholarship ${id}`);
      } catch (error) {
        logger.error(`Failed to send zakat consent email for scholarship ${id}:`, error);
      }
    }

    return { scholarshipsFound: pending.length, emailsSent };
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error("Error in scheduled task:", {
      message: err.message || "Unknown error",
      stack: err.stack,
      name: err.name,
      code: err.code,
    });
    throw error;
  }
}

// Only start the server if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Start the server
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(
      "API server initialized. Use /trigger-sync endpoint to run a sync."
    );
  });

  // Handle graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    process.exit(0);
  });
}

// Export the runScheduledTask function for direct command-line execution
export { runScheduledTask };
