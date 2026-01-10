// Simple test to check if the core modules can be loaded
try {
    console.log('Attempting to load core modules...');
    
    // Test loading the db module
    const { db, init } = require('./src/core/db');
    console.log('DB module loaded successfully');
    
    // Test loading the config paths
    const { BASE_PATH } = require('./src/config/paths');
    console.log('Config paths loaded successfully:', BASE_PATH);
    
    // Test loading the app config
    const configValues = require('./src/config/app');
    console.log('App config loaded successfully');
    
    console.log('All core modules loaded successfully!');
} catch (error) {
    console.error('Error loading core modules:', error.message);
    console.error('Stack trace:', error.stack);
}