const fs = require('fs');

// Write to a file to ensure we get output even if console is suppressed
const logFile = 'app_debug_log.txt';
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message); // Also log to console
};

log('Starting application debug...');

try {
    log('Attempting to require cozo-loader...');
    const { db } = require('./src/core/cozo_loader.js');
    log('cozo-loader loaded successfully');
    
    log('Attempting to initialize the app...');
    const app = require('./src/index.js');
    log('App initialized successfully');
} catch (error) {
    log(`Error during app startup: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    log(`Error code: ${error.code}`);
    log(`Error path: ${error.path}`);
}