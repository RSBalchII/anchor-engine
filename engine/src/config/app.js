/**
 * Application Configuration
 * 
 * Centralized configuration for default limits and settings
 */

// Default configuration values
const DEFAULT_CONFIG = {
  // Search settings
  DEFAULT_SEARCH_CHAR_LIMIT: 5000,
  SEARCH_DEEP_CHAR_LIMIT: 10000,
  
  // Dreamer settings
  DREAM_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes in milliseconds
  STARTUP_DELAY_MS: 60 * 1000, // 60 seconds startup delay
  
  // Ingestion settings
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max per file
  MAX_LINES_PER_FILE: 5000, // Max 5000 lines per file
  
  // Memory settings
  TOKEN_LIMIT: 1000000, // 1M tokens for context aggregation
  
  // Mirror protocol settings
  MIRROR_BATCH_SIZE: 100, // Number of memories to process per batch during mirroring
  MIRROR_STREAM_BUFFER_SIZE: 1024 * 1024, // 1MB buffer for streaming large files
  
  // API settings
  DEFAULT_PORT: 3000,
  REQUEST_BODY_LIMIT: '50mb',
  
  // File watcher settings
  WATCHER_IGNORE_PATTERNS: [
    '**/node_modules/**',
    '**/.git/**',
    '**/context/mirrored_brain/**', // Critical: prevent recursion loop
    '**/engine/context.db/**',
    '**/logs/**',
    '**/backups/**',
    '**/combined_memory.yaml',      // Ignore bulk export files
    '**/combined_*.yaml',           // Ignore any combined export files
    '**/*.snapshot.yaml'            // Ignore snapshot files
  ]
};

module.exports = DEFAULT_CONFIG;