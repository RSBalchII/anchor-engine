// Final verification that all path fixes are working
console.log('=== Final Verification of Path Fixes ===\n');

try {
    console.log('1. Testing core modules...');
    const { db, init } = require('./src/core/db');
    console.log('   ✓ Core DB module loaded successfully');
    
    const pathsConfig = require('./src/config/paths');
    console.log('   ✓ Config paths module loaded successfully');
    
    const appConfig = require('./src/config/app');
    console.log('   ✓ App config module loaded successfully');
    
    console.log('\n2. Testing service modules...');
    const { executeSearch } = require('./src/services/search/search');
    console.log('   ✓ Search service loaded successfully');
    
    const { ingestContent } = require('./src/services/ingest/ingest');
    console.log('   ✓ Ingest service loaded successfully');
    
    const { dream } = require('./src/services/dreamer/dreamer');
    console.log('   ✓ Dreamer service loaded successfully');
    
    const scribe = require('./src/services/scribe/scribe');
    console.log('   ✓ Scribe service loaded successfully');
    
    const { mirrorToDisk } = require('./src/services/mirror/mirror');
    console.log('   ✓ Mirror service loaded successfully');
    
    const inference = require('./src/services/inference/inference');
    console.log('   ✓ Inference service loaded successfully');
    
    const { setupFileWatcher } = require('./src/services/watcher/watcher');
    console.log('   ✓ Watcher service loaded successfully');
    
    const SafeShellExecutor = require('./src/services/safe-shell-executor/safe-shell-executor');
    console.log('   ✓ SafeShellExecutor loaded successfully');
    
    console.log('\n3. Testing route modules...');
    const apiRoutes = require('./src/routes/api');
    console.log('   ✓ API routes loaded successfully');
    
    console.log('\n🎉 SUCCESS: All modules loaded without path errors!');
    console.log('The path fixes have been successfully implemented.');
    console.log('The remaining issue is likely related to the cozo-node native module compatibility on Windows.');
    
} catch (error) {
    console.error('\n❌ ERROR: Module loading failed:', error.message);
    console.error('Stack trace:', error.stack);
}