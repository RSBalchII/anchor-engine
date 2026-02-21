// Script to set environment variables based on user_settings.json before starting the application
const fs = require('fs');

try {
  // Read the user settings
  const settings = JSON.parse(fs.readFileSync('./user_settings.json', 'utf8'));
  
  // Set environment variables based on the configuration
  if (settings.vector_processing && settings.vector_processing.skip_vector_processing) {
    process.env.SKIP_VECTOR_PROCESSING = 'true';
    console.log('Set SKIP_VECTOR_PROCESSING=true based on user_settings.json');
  } else {
    process.env.SKIP_VECTOR_PROCESSING = 'false';
    console.log('Set SKIP_VECTOR_PROCESSING=false based on user_settings.json');
  }
  
  console.log('Environment variables set based on configuration.');
} catch (error) {
  console.error('Error reading user_settings.json:', error.message);
  process.exit(1);
}