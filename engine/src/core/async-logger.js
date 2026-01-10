// async-logger.js
const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('./config/paths');

class AsyncLogger {
  constructor() {
    this.logQueue = [];
    this.isProcessing = false;
    this.logFilePath = path.join(LOGS_DIR, `engine_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    
    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    
    // Start processing queue
    this.processQueue();
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    this.logQueue.push(logEntry);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.logQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const logEntry = this.logQueue.shift();
    
    try {
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      // If file write fails, we don't want to crash the main process
      console.error('Log write failed:', error.message);
    }
    
    // Continue processing the queue
    setImmediate(() => this.processQueue());
  }

  info(message) {
    this.log('INFO', message);
  }

  error(message) {
    this.log('ERROR', message);
  }

  warn(message) {
    this.log('WARN', message);
  }
}

// Create global logger instance
const logger = new AsyncLogger();

// Override console methods to use async logger only (no stdout)
global.asyncLog = {
  info: (msg) => logger.info(msg),
  error: (msg) => logger.error(msg),
  warn: (msg) => logger.warn(msg)
};

module.exports = { logger, asyncLog };