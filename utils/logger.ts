/**
 * Simple logger utility for the scheduler application
 */

type LogLevelName = "ERROR" | "WARN" | "INFO" | "DEBUG";

const LOG_LEVELS: Record<LogLevelName, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Get the current log level from environment or default to INFO
const currentLogLevel: number = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase() as LogLevelName]
  : LOG_LEVELS.INFO;

/**
 * Format the log message with timestamp and level
 */
function formatLog(level: LogLevelName, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} [${level}] ${message}`;

  if (data) {
    if (typeof data === "object") {
      try {
        logMessage += ` ${JSON.stringify(data)}`;
      } catch (e) {
        logMessage += ` [Object cannot be stringified]`;
      }
    } else {
      logMessage += ` ${data}`;
    }
  }

  return logMessage;
}

/**
 * Log a message if the current log level allows it
 */
function log(level: number, levelName: LogLevelName, message: string, data?: unknown): void {
  if (level <= currentLogLevel) {
    const formattedMessage = formatLog(levelName, message, data);

    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(formattedMessage);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
}

// Export the logger object with methods for each log level
export const logger = {
  error: (message: string, data?: unknown) => log(LOG_LEVELS.ERROR, "ERROR", message, data),
  warn: (message: string, data?: unknown) => log(LOG_LEVELS.WARN, "WARN", message, data),
  info: (message: string, data?: unknown) => log(LOG_LEVELS.INFO, "INFO", message, data),
  debug: (message: string, data?: unknown) => log(LOG_LEVELS.DEBUG, "DEBUG", message, data),
};
