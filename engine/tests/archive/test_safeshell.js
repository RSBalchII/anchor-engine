// Test script to check if the SafeShellExecutor works properly
try {
    console.log('Attempting to load SafeShellExecutor...');
    const SafeShellExecutor = require('./src/services/safe-shell-executor/safe-shell-executor');
    console.log('SafeShellExecutor loaded successfully');
    
    // Test executing a simple command
    console.log('Testing SafeShellExecutor with a simple command...');
    SafeShellExecutor.execute('echo Hello from SafeShellExecutor')
        .then(result => {
            console.log('Command executed successfully:', result);
        })
        .catch(error => {
            console.error('Error executing command:', error.message);
        });
} catch (error) {
    console.error('Error loading SafeShellExecutor:', error.message);
    console.error('Stack trace:', error.stack);
}