const fs = require('fs');

// Write to a file to ensure we get output even if console is suppressed
const logFile = 'test_log.txt';
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message); // Also log to console
};

log('Testing basic cozo-node import...');
try {
    // Try importing the module directly
    const cozoPath = './node_modules/cozo-node';
    log(`Attempting to require: ${cozoPath}`);

    // Check if the file exists first
    if (!fs.existsSync(cozoPath)) {
        log(`Path does not exist: ${cozoPath}`);
        process.exit(1);
    }

    // Check if the native binary exists
    const nativePath = './node_modules/cozo-node/native/6/cozo_node_prebuilt.node';
    if (!fs.existsSync(nativePath)) {
        log(`Native binary does not exist: ${nativePath}`);
        process.exit(1);
    }

    log('Native binary exists, attempting to require cozo-node...');
    const { CozoDb } = require(cozoPath);
    log('Success: cozo-node loaded without error');

    // Try to create a database instance
    log('Creating CozoDb instance...');
    const db = new CozoDb();
    log('Success: CozoDb instance created');

    // Close the database
    db.close();
    log('Test completed successfully');
} catch (error) {
    log(`Error during test: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    process.exit(1);
}