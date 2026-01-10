try {
    console.log('Attempting to require cozo-node...');
    const { CozoDb } = require('./node_modules/cozo-node');
    console.log('cozo-node loaded successfully');
    console.log('CozoDb constructor:', typeof CozoDb);
} catch (error) {
    console.error('Error loading cozo-node:', error.message);
    console.error('Stack trace:', error.stack);
}