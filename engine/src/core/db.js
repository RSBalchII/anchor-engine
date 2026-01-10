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
// Use appropriate engine based on whether we're in PKG mode or development
const dbEngine = require('../config/paths').IS_PKG ? 'rocksdb' : 'rocksdb';
const db = new CozoDb(dbEngine, DB_PATH);

/**
 * Helper function to remove all indices attached to the memory relation
 * CozoDB requires indices to be removed before the relation can be dropped
 * Note: CozoDB uses "::fts drop <name>" syntax for FTS indices
 */
async function removeMemoryIndices() {
  // List of known FTS index names to try removing
  const ftsIndexNames = ['memory:content_fts', 'content_fts'];
  
  for (const indexName of ftsIndexNames) {
    // Try multiple syntaxes as CozoDB versions may differ
    const dropCommands = [
      `::fts drop ${indexName}`,
      `::fts destroy ${indexName}`,
      `::hnsw drop ${indexName}`,
    ];
    
    for (const cmd of dropCommands) {
      try {
        await db.run(cmd);
        console.log(`Index dropped with: ${cmd}`);
        break; // Success, move to next index
      } catch (e) {
        // Command failed, try next syntax
        continue;
      }
    }
  }
  
  console.log('Index cleanup completed');
}

/**
 * Helper function to perform schema migration
 * Extracts all data, recreates table with new schema, and reinserts data
 * @param {string} label - Log label for identifying which migration path is running
 */
async function performSchemaMigration(label = '') {
  const logPrefix = label ? `[${label}] ` : '';
  
  // Eject current data
  console.log(`${logPrefix}Ejecting current data for schema migration...`);

  // Get all existing data
  const allDataQuery = '?[id, timestamp, content, source, type, hash, buckets, tags] := *memory{id, timestamp, content, source, type, hash, buckets, tags}';
  const allData = await db.run(allDataQuery);

  // CRITICAL: Remove all indices BEFORE removing the relation
  console.log(`${logPrefix}Removing indices before dropping relation...`);
  await removeMemoryIndices();

  // Small delay to ensure index removal is processed
  await new Promise(resolve => setTimeout(resolve, 300));

  // Drop the existing memory relation using ::remove
  await db.run('::remove memory');
  console.log(`${logPrefix}Old memory relation removed with ::remove`);

  // Small delay to ensure the removal is fully processed
  await new Promise(resolve => setTimeout(resolve, 200));

  // Create the memory relation with the new schema including epochs
  const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
  await db.run(schemaQuery);
  console.log(`${logPrefix}Memory relation recreated with epochs column`);

  // Reinsert the data with default empty epochs
  if (allData.rows && allData.rows.length > 0) {
    console.log(`${logPrefix}Reinserting ${allData.rows.length} records with schema migration...`);

    const BATCH_SIZE = 50; // Smaller batch size
    for (let i = 0; i < allData.rows.length; i += BATCH_SIZE) {
      const batch = allData.rows.slice(i, i + BATCH_SIZE);
      console.log(`${logPrefix}Inserting batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allData.rows.length/BATCH_SIZE)} (${batch.length} records)...`);

      const values = batch.map(row => [
        row[0], // id
        row[1], // timestamp
        row[2], // content
        row[3], // source
        row[4], // type
        row[5], // hash
        row[6], // buckets
        row[7], // tags
        '[]'    // epochs (default empty array)
      ]);

      const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
      await db.run(insertQuery, { data: values });
      console.log(`${logPrefix}Batch complete`);
    }

    console.log(`${logPrefix}Schema migration completed for ${allData.rows.length} records`);
  }
}

async function initializeDb() {
  try {
    // Check if the memory relation exists and has the correct schema
    const relations = await db.run('::relations');
    const memoryRelationExists = relations.rows.some(row => row[0] === 'memory');

    if (memoryRelationExists) {
      console.log('Memory relation exists, checking schema...');

      try {
        // Check if the schema has the epochs column using CozoDB's ::columns command
        // This returns column metadata including name, type, and constraints
        const columnResult = await db.run('::columns memory');
        
        // columnResult.rows is array of [name, type, nullable, default, ...]
        const hasEpochsColumn = columnResult.rows.some(row => row[0] === 'epochs');

        if (hasEpochsColumn) {
          console.log('Schema already includes epochs column');
        } else {
          // If epochs column doesn't exist, migrate the schema
          console.log('Epochs column not found, migrating schema...');
          await performSchemaMigration('primary');
        }
      } catch (checkError) {
        // If the metadata query fails, try a simple probe query instead
        console.log('Column check failed, trying probe query...');
        try {
          // Try to select epochs - if it fails, column doesn't exist
          await db.run('?[epochs] := *memory{epochs}, epochs = ""', {});
          console.log('Schema already includes epochs column (verified by probe)');
        } catch (probeError) {
          console.log('Epochs column not found (probe failed), migrating schema...');
          await performSchemaMigration('fallback');
        }
      }
    } else {
      // Create the memory relation with the correct schema if it doesn't exist
      console.log('Creating new memory relation with full schema...');
      const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
      await db.run(schemaQuery);
      console.log('Database schema initialized');
    }

    // FTS index creation - wrap in Promise.race with timeout
    try {
      console.log('Attempting to create FTS index...');
      const ftsQuery = `::fts create memory:content_fts {extractor: content, tokenizer: Simple, filters: [Lowercase]}`;
      
      // Use Promise.race for timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FTS creation timeout after 5s')), 5000)
      );
      
      const ftsResult = await Promise.race([db.run(ftsQuery), timeoutPromise]);
      console.log('FTS index created successfully', ftsResult);
    } catch (e) {
      const errMsg = e.message || String(e);
      if (errMsg.includes('already exists') || errMsg.includes('exists') || errMsg.includes('FtsExprAlreadyDefined')) {
        console.log('FTS index already exists (OK)');
      } else {
        // FTS is optional - log but don't fail
        console.log('FTS index creation skipped:', errMsg.substring(0, 200));
      }
    }
    
    console.log('Database initialization complete');
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

      try {
        await hydrate(db, latest.path);
      } catch (hydrationError) {
        console.error('Hydration failed, attempting schema migration instead...');

        // If hydration fails, try to load the backup data directly with schema migration
        const yaml = require('js-yaml');
        const fs = require('fs');
        const crypto = require('crypto');

        try {
          // First, remove any indices attached to the memory relation
          console.log("Fallback: Removing indices before dropping relation...");
          await removeMemoryIndices();
          await new Promise(resolve => setTimeout(resolve, 200));

          // Then, ensure the schema is correct by dropping and recreating the table
          try {
            await db.run('::remove memory');
            console.log("Fallback: Existing memory table removed for clean hydration...");
            // Add a small delay to ensure the removal is fully processed
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            // If removal fails, the table might not exist, which is fine
            console.log("Fallback: Memory table removal result (expected if table doesn't exist):", e.message);
          }

          // Create the new table with the correct schema
          const schema = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
          await db.run(schema);
          console.log("Fallback: Memory table created with correct schema...");

          const fileContent = fs.readFileSync(latest.path, 'utf8');
          const records = yaml.load(fileContent);

          if (Array.isArray(records) && records.length > 0) {
            // Process records with schema migration
            console.log(`Loading ${records.length} records with schema migration...`);

            const BATCH_SIZE = 100;
            let processed = 0;

            while (processed < records.length) {
              const batch = records.slice(processed, processed + BATCH_SIZE);

              const values = batch.map(r => [
                r.id || '',
                parseInt(r.timestamp) || Date.now(),
                r.content || '',
                r.source || '',
                r.type || 'text',
                r.hash || crypto.createHash('md5').update(r.content || '').digest('hex'),
                Array.isArray(r.buckets) ? r.buckets : (r.bucket ? [r.bucket] : ['core']),
                r.tags || '',
                JSON.stringify(r.epochs || [])  // Add epochs field with default empty array, ensuring it's a string
              ]);

              const q = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $values :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
              await db.run(q, { values });

              processed += batch.length;
              process.stdout.write(`Schema migration progress: ${processed}/${records.length}\r`);
            }

            console.log(`\n✅ Schema migration completed with ${records.length} records.`);

            // CRITICAL: Recreate FTS index after migration (Standard 053: CozoDB Pain Points)
            // FTS index does NOT survive backup/restore - must be recreated
            try {
              await db.run(`::fts create memory:content_fts {extractor: content, tokenizer: Simple, filters: [Lowercase]}`);
              console.log('✅ FTS index recreated after migration');
            } catch (ftsError) {
              if (!ftsError.message.includes('already exists')) {
                console.error('⚠️ FTS index recreation failed:', ftsError.message);
              }
            }
          }
        } catch (migrationError) {
          console.error('Schema migration also failed:', migrationError.message);
          console.log('Continuing with existing database state...');
        }
      }
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
