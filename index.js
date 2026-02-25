import express from "express";
import dotenv from "dotenv";
import { fetchSquarespaceOrders } from "./services/squarespace.js";
import { processOrderData } from "./services/dataProcessor.js";
import { saveToFirestore } from "./services/firebase.js";
import { logger } from "./utils/logger.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic health check endpoint
app.get("/", (req, res) => {
  res.status(200).send({ status: "OK", message: "Scheduler is running" });
});

// Manual trigger endpoint for the scheduler
app.post("/trigger-sync", async (req, res) => {
  try {
    logger.info("Manual sync triggered");
    await runScheduledTask();
    res
      .status(200)
      .send({ status: "success", message: "Sync completed successfully" });
  } catch (error) {
    logger.error("Manual sync failed:", error);
    res.status(500).send({ status: "error", message: error.message });
  }
});

// The main scheduled task that will run according to the cron schedule
async function runScheduledTask(timeConfig = 6) {
  try {
    logger.info("Starting scheduled task to process Squarespace orders");

    // Step 1: Extract data from Squarespace
    const orders = await fetchSquarespaceOrders(timeConfig);
    logger.info(`Fetched ${orders.length} orders from Squarespace`);

    // Step 2: Format the data
    const processedOrders = await processOrderData(orders);
    logger.info(`Processed ${processedOrders.length} orders`);

    // Step 3: Insert data into Firebase
    if (processedOrders && processedOrders.length > 0) {
      await saveToFirestore(processedOrders);
      logger.info("Successfully saved orders to Firestore");
    } else {
      logger.info("No orders to save to Firestore");
    }

    return { success: true, ordersProcessed: processedOrders.length };
  } catch (error) {
    logger.error("Error in scheduled task:", error.message || "Unknown error", {
      stack: error.stack,
      name: error.name,
      code: error.code,
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
