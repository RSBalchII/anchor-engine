// Simple test to verify system functionality
console.log('Starting simple test...');

// Test basic functionality
console.log('✓ Basic console output works');

// Test importing modules
try {
  const fs = require('fs');
  console.log('✓ FS module loaded successfully');
} catch (e) {
  console.log('✗ FS module failed to load:', e.message);
}

try {
  const path = require('path');
  console.log('✓ Path module loaded successfully');
} catch (e) {
  console.log('✗ Path module failed to load:', e.message);
}

try {
  const crypto = require('crypto');
  console.log('✓ Crypto module loaded successfully');
} catch (e) {
  console.log('✗ Crypto module failed to load:', e.message);
}

// Test basic file operations
try {
  const testFilePath = path.join(__dirname, 'test-file.txt');
  fs.writeFileSync(testFilePath, 'Test content', 'utf8');
  const content = fs.readFileSync(testFilePath, 'utf8');
  console.log('✓ File read/write works:', content);
  
  // Clean up
  fs.unlinkSync(testFilePath);
} catch (e) {
  console.log('✗ File operations failed:', e.message);
}

console.log('Simple test completed.');