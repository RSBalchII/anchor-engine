const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config/paths');

// Maximum number of lines to keep in log file
const MAX_LOG_LINES = 2000;
// Truncate every N log writes for performance (instead of every write)
const TRUNCATE_INTERVAL = 100;
let logWriteCount = 0;

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOGS_DIR, `engine_${timestamp}.log`);
const errorFile = path.join(LOGS_DIR, `error_${timestamp}.log`);

// Function to truncate log file if it exceeds the maximum number of lines
// Now runs periodically instead of on every write for better performance
function truncateLogFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        if (lines.length > MAX_LOG_LINES) {
            // Keep only the most recent lines (from the end)
            const truncatedLines = lines.slice(-MAX_LOG_LINES);
            const truncatedContent = truncatedLines.join('\n');
            fs.writeFileSync(filePath, truncatedContent);
        }
    } catch (error) {
        // If there's an error truncating (e.g., file doesn't exist yet), ignore it
    }
}

// Periodic truncation check - only runs every TRUNCATE_INTERVAL writes
function maybeFlushAndTruncate() {
    logWriteCount++;
    if (logWriteCount >= TRUNCATE_INTERVAL) {
        logWriteCount = 0;
        truncateLogFile(logFile);
        truncateLogFile(errorFile);
    }
}

// Create streams for file logging
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorStream = fs.createWriteStream(errorFile, { flags: 'a' });

// Save original console methods
const originalLog = console.log;
const originalError = console.error;

function formatMessage(args) {
    return args.map(arg => {
        if (arg instanceof Error) {
            return arg.stack || arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
}

// For development/Qwen Code CLI environments, only log to files, not to console
const isQwenCLI = process.env.QWEN_CLI === 'true';

console.log = function(...args) {
    const msg = `[${new Date().toISOString()}] [INFO] ${formatMessage(args)}\n`;
    logStream.write(msg);
    // Periodic truncation check (every TRUNCATE_INTERVAL writes)
    maybeFlushAndTruncate();

    // Only output to console if not in Qwen CLI environment
    if (!isQwenCLI) {
        originalLog.apply(console, args);
    }
};

console.error = function(...args) {
    const msg = `[${new Date().toISOString()}] [ERROR] ${formatMessage(args)}\n`;
    errorStream.write(msg);
    logStream.write(msg); // Also write errors to the main log
    // Periodic truncation check (every TRUNCATE_INTERVAL writes)
    maybeFlushAndTruncate();

    // Only output to console if not in Qwen CLI environment
    if (!isQwenCLI) {
        originalError.apply(console, args);
    }
};

console.info = console.log;
console.warn = console.log;

module.exports = {
    logFile,
    errorFile
};
