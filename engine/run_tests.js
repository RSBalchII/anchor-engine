// Script to run the comprehensive test suite using SafeShellExecutor
const SafeShellExecutor = require('./src/services/safe-shell-executor/safe-shell-executor');

console.log('Starting comprehensive test suite via SafeShellExecutor...');

SafeShellExecutor.execute('node tests/comprehensive_suite.js', { timeout: 120000 }) // 2 minute timeout
    .then(result => {
        console.log('Test suite execution completed:', result);
        
        // Try to read the log file to see results
        const fs = require('fs');
        const path = require('path');
        
        // Look for the most recent log file
        const logsDir = path.join(__dirname, 'logs');
        if (fs.existsSync(logsDir)) {
            const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort();
            if (logFiles.length > 0) {
                const latestLogFile = path.join(logsDir, logFiles[logFiles.length - 1]);
                console.log('Reading latest log file:', latestLogFile);
                
                try {
                    const logContent = fs.readFileSync(latestLogFile, 'utf8');
                    console.log('Log content:');
                    console.log(logContent);
                } catch (e) {
                    console.log('Could not read log file:', e.message);
                }
            }
        }
    })
    .catch(error => {
        console.error('Error running test suite:', error.message);
    });