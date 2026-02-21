/**
 * Winston Logger for Nanobot
 * Centralized logging with rotation to project root logs directory
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Navigate to project root (packages/nanobot-node/utils -> ../../..)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Custom format for nanobot logs
const nanobotFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: nanobotFormat,
  transports: [
    // Main nanobot_node.log file with size-based rotation (10KB)
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'nanobot_node.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '10k',
      maxFiles: '7d',
      format: nanobotFormat
    }),
    // Separate error file
    new DailyRotateFile({
      level: 'error',
      filename: path.join(LOGS_DIR, 'nanobot_node_error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10k',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      )
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}] ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

// Helper functions for common logging patterns
export const logWithContext = {
  info: (message, context) => {
    logger.info(message, { context, pid: process.pid, module: 'nanobot' });
  },
  warn: (message, context) => {
    logger.warn(message, { context, pid: process.pid, module: 'nanobot' });
  },
  error: (message, error, context) => {
    logger.error(message, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      context,
      pid: process.pid,
      module: 'nanobot'
    });
  },
  debug: (message, context) => {
    logger.debug(message, { context, pid: process.pid, module: 'nanobot' });
  },
  // Specialized logging for nanobot operations
  telegram: (event, details) => {
    logger.info(`[Telegram] ${event}`, { details, pid: process.pid, module: 'nanobot' });
  },
  brain: (event, details) => {
    logger.info(`[Brain] ${event}`, { details, pid: process.pid, module: 'nanobot' });
  },
  server: (event, details) => {
    logger.info(`[Server] ${event}`, { details, pid: process.pid, module: 'nanobot' });
  }
};

export { logger };
export default logger;
