// Simple test to check if the db module can be loaded
try {
    console.log('Attempting to load db module...');
    const { db } = require('./src/core/db');
    console.log('DB module loaded successfully');
    
    // Try to initialize the database
    console.log('Attempting to initialize database...');
    db.init()
        .then(() => {
            console.log('Database initialized successfully');
        })
        .catch(err => {
            console.error('Database initialization error:', err.message);
        });
} catch (error) {
    console.error('Error loading DB module:', error.message);
    console.error('Stack trace:', error.stack);
}