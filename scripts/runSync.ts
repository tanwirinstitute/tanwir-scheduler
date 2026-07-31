import { runScheduledTask } from "../index.js";
import { logger } from "../utils/logger.js";

// Run the scheduled task and exit when done
async function main() {
  try {
    logger.info("Starting manual sync");
    await runScheduledTask();
    logger.info("Manual sync completed successfully");
    process.exit(0);
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error("Manual sync failed:", {
      message: err.message || "Unknown error",
      stack: err.stack,
      name: err.name,
      code: err.code,
    });
    process.exit(1);
  }
}

main();
