const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { DB_PATH, BACKUPS_DIR, LOGS_DIR } = require('../config/paths');
const { hydrate } = require('../hydrate');
const { CozoDb } = require('./cozo_loader');

// Ensure logs directory exists for error reporting
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Initialize CozoDB with RocksDB backend
const db = new CozoDb('rocksdb', DB_PATH);

async function initializeDb() {
  try {
    // Check if the memory relation already exists
    const checkQuery = '::relations';
    const relations = await db.run(checkQuery);

    // Only create the memory table if it doesn't already exist
    if (!relations.rows.some(row => row[0] === 'memory')) {
        const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String]}';
        await db.run(schemaQuery);
        console.log('Database schema initialized');
    } else {
        // Check if we need to migrate from bucket (String) to buckets ([String])
        const columnsQuery = '::columns memory';
        const columns = await db.run(columnsQuery);
        const hasBuckets = columns.rows.some(row => row[0] === 'buckets');
        
        if (!hasBuckets) {
            console.log('Migrating schema: bucket -> buckets');
            // 1. Get all data
            const data = await db.run('?[id, timestamp, content, source, type, hash, bucket] := *memory{id, timestamp, content, source, type, hash, bucket}');
            
            // EMERGENCY BACKUP BEFORE DESTRUCTIVE CHANGE
            try {
                const emergencyBackup = data.rows.map(r => ({ id: r[0], timestamp: r[1], content: r[2], source: r[3], type: r[4], hash: r[5], bucket: r[6] }));
                const yamlStr = yaml.dump(emergencyBackup);
                const backupPath = path.join(BACKUPS_DIR, `MIGRATION_BACKUP_${Date.now()}.yaml`);
                if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
                fs.writeFileSync(backupPath, yamlStr);
                console.log(`[Safety] Emergency backup created at ${backupPath}`);
            } catch (e) {
                console.error('[Safety] Emergency backup failed, but continuing migration:', e.message);
            }

            // 2. Clear old table
            await db.run('~memory(_) :rm');
            
            // 3. We can't easily change schema without dropping, so we'll just warn and suggest manual reset if this fails
            console.log('Warning: Schema migration requires manual database reset or complex Cozo migration.');
            console.log('Attempting to drop and recreate...');
            try {
                await db.run('::fts remove memory:content_fts');
            } catch (e) {}
            await db.run('::remove memory');
            
            // 4. Create new table
            const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String]}';
            await db.run(schemaQuery);
            
            // 5. Re-insert data with bucket wrapped in list
            if (data.rows.length > 0) {
                const migratedValues = data.rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], [r[6]]]);
                await db.run('?[id, timestamp, content, source, type, hash, buckets] <- $data :put memory {id, timestamp, content, source, type, hash, buckets}', { data: migratedValues });
            }
            console.log('Migration complete.');
        } else {
            console.log('Database schema already exists');
        }
    }

    // Try to create FTS index
    try {
      const ftsQuery = `::fts create memory:content_fts {extractor: content, tokenizer: Simple, filters: [Lowercase]}`;
      await db.run(ftsQuery);
      console.log('FTS index created');
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log('FTS index already exists');
      } else {
        console.log('FTS creation failed (optional feature):', e.message);
      }
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

async function autoHydrate() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('No backups directory found, skipping auto-hydration.');
    return;
  }

  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => ({
        name: f,
        path: path.join(BACKUPS_DIR, f),
        mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      const latest = files[0];
      console.log(`🔄 Stateless Mode: Reloading from latest backup: ${latest.name}`);
      
      // Clear existing memories to ensure a clean reload
      // await db.run('~memory{_} :rm'); // Skipping for now to avoid syntax issues
      
      await hydrate(db, latest.path);
      console.log(`✅ Database reloaded from backup. Current session is temporary unless you 'Eject' (Backup).`);
    } else {
      console.log('No snapshots found in backups directory. Starting with current database state.');
    }
  } catch (error) {
    console.error('Auto-hydration failed:', error);
  }
}

async function init() {
    await initializeDb();
    // Small delay to ensure DB is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    await autoHydrate();
}

module.exports = {
    db,
    init
};
