// Load environment variables first (before anything else)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional - continue without it
}

require('./core/logger');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { db, init } = require('./core/db');
const apiRoutes = require('./routes/api');
const { setupFileWatcher } = require('./services/watcher/watcher');
const { dream } = require('./services/dreamer/dreamer');
const { mirrorToDisk } = require('./services/mirror/mirror');
const config = require('./config/paths');

const configValues = require('./config/app');
const PORT = process.env.PORT || configValues.DEFAULT_PORT;

// Setup Express
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from interface directory
app.use(express.static(config.INTERFACE_DIR));

// Mount Routes
app.use('/v1', apiRoutes);

// GET /health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'Sovereign',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start System
async function boot() {
    try {
        console.log('Starting Sovereign Context Engine...');
        console.log(`Mode: ${config.IS_PKG ? 'Production (PKG)' : 'Development'}`);
        console.log(`Base Path: ${config.BASE_PATH}`);
        console.log(`Interface Dir: ${config.INTERFACE_DIR}`);
        console.log(`Database Path: ${config.DB_PATH}`);

        // Initialize DB with retry logic for locking issues
        let dbInitialized = false;
        let retries = 0;
        const maxRetries = 5;

        while (!dbInitialized && retries < maxRetries) {
            try {
                await init(); // Initialize DB and Auto-Hydrate
                dbInitialized = true;
                console.log('Database initialized successfully');
            } catch (dbError) {
                retries++;
                console.error(`Database initialization failed (attempt ${retries}/${maxRetries}):`, dbError.message);

                if (retries >= maxRetries) {
                    console.error('Max retries reached. Please ensure no other instances are running.');
                    process.exit(1);
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        setupFileWatcher(); // Start Watcher

        // Schedule dreamer to run automatically with configured intervals
        const DREAM_INTERVAL = configValues.DREAM_INTERVAL_MS; // Configurable interval in milliseconds
        const STARTUP_DELAY = configValues.STARTUP_DELAY_MS; // Configurable startup delay

        console.log(`🌙 Dreamer: Scheduling self-organization cycle every ${DREAM_INTERVAL / 60000} minutes with ${STARTUP_DELAY / 1000}s startup delay`);

        // Initial delay before starting the interval
        setTimeout(() => {
            setInterval(async () => {
                try {
                    const result = await dream();
                    console.log(`🌙 Dreamer Auto-Run Result:`, result);

                    // Trigger mirror protocol after each dreamer cycle to update physical representation
                    try {
                        await mirrorToDisk();
                    } catch (mirrorError) {
                        console.error('🪞 Mirror Protocol Error after Dreamer cycle:', mirrorError.message);
                    }
                } catch (error) {
                    console.error('🌙 Dreamer Auto-Run Error:', error);
                }
            }, DREAM_INTERVAL);
        }, STARTUP_DELAY);

        app.listen(PORT, () => {
            console.log(`Sovereign Context Engine listening on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`Interface: http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error("Fatal startup error:", e);
        process.exit(1);
    }
}

// Handle graceful shutdown
const shutdown = async (signal) => {
  console.log(`Shutting down gracefully... (Signal: ${signal})`);
  try {
    // Ensure database is properly closed
    if (db && typeof db.close === 'function') {
      await db.close();
      console.log('Database connection closed');
    }
  } catch (e) {
    console.error('Error closing database:', e);
  }
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});

boot();

module.exports = { app };
