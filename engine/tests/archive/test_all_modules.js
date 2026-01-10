// Test to verify all modules can be loaded after path fixes
console.log('Testing module loading after path fixes...');

try {
    // Test loading the main index file indirectly by testing its dependencies
    console.log('Testing core modules...');
    
    const { db, init } = require('./src/core/db');
    console.log('✓ Core DB module loaded');
    
    const { setupFileWatcher } = require('./src/services/watcher/watcher');
    console.log('✓ Watcher service loaded');
    
    const { executeSearch } = require('./src/services/search/search');
    console.log('✓ Search service loaded');
    
    const { ingestContent } = require('./src/services/ingest/ingest');
    console.log('✓ Ingest service loaded');
    
    const { dream } = require('./src/services/dreamer/dreamer');
    console.log('✓ Dreamer service loaded');
    
    const scribe = require('./src/services/scribe/scribe');
    console.log('✓ Scribe service loaded');
    
    const { mirrorToDisk } = require('./src/services/mirror/mirror');
    console.log('✓ Mirror service loaded');
    
    const inference = require('./src/services/inference/inference');
    console.log('✓ Inference service loaded');
    
    const SafeShellExecutor = require('./src/services/safe-shell-executor/safe-shell-executor');
    console.log('✓ SafeShellExecutor loaded');
    
    console.log('\n🎉 All modules loaded successfully!');
    console.log('All path fixes have been applied correctly.');
    
} catch (error) {
    console.error('❌ Error loading modules:', error.message);
    console.error('Stack trace:', error.stack);
}