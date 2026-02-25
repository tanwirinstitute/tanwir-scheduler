import { runScheduledTask } from "../index.js";
import { logger } from "../utils/logger.js";

// Run the scheduled task and exit when done
async function main() {
  try {
    // Check if specific time range is provided (ISO format)
    // Usage: node scripts/runSync.js [lookbackMinutes]
    // OR:    node scripts/runSync.js --start "2026-01-01T10:00:00Z" --end "2026-01-01T11:00:00Z"
    
    const args = process.argv.slice(2);
    let timeConfig;
    
    if (args.includes('--start') && args.includes('--end')) {
      const startIndex = args.indexOf('--start');
      const endIndex = args.indexOf('--end');
      const startTime = args[startIndex + 1];
      const endTime = args[endIndex + 1];
      
      timeConfig = {
        type: 'range',
        start: startTime,
        end: endTime
      };
      
      logger.info(`Starting manual sync for time range: ${startTime} to ${endTime}`);
    } else {
      // Get lookback minutes from command line argument, default to 6
      const lookbackMinutes = args[0] ? parseInt(args[0]) : 6;
      
      timeConfig = {
        type: 'lookback',
        minutes: lookbackMinutes
      };
      
      logger.info(`Starting manual sync (looking back ${lookbackMinutes} minutes)`);
    }
    
    await runScheduledTask(timeConfig);
    logger.info("Manual sync completed successfully");
    
    // Wait for any pending promises to complete (like email API calls)
    logger.info("Waiting for all pending operations to complete...");
    setTimeout(() => {
      logger.info("All operations completed, exiting process");
      process.exit(0);
    }, 5000); // Wait 5 seconds for any pending operations
  } catch (error) {
    logger.error("Manual sync failed:", {
      message: error.message || "Unknown error",
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    process.exit(1);
  }
}

main();
