const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const { CozoDb } = require('./core/cozo_loader');

// Helper to calculate hash
function getHash(content) {
    return crypto.createHash('md5').update(content || '').digest('hex');
}

async function hydrate(db, filePath) {
    console.log(`💧 Hydrating Schema 2.0 from: ${filePath}`);
    
    try {
        // 1. Handle Schema with new columns
        // Since :rm and :drop might not work reliably in all CozoDB versions,
        // we'll try to work with the existing schema and handle missing columns gracefully

        // Try to create the table, but if it exists with a different schema, continue with the existing one
        try {
            await db.run(':rm memory');
            console.log("Existing memory table removed for clean hydration...");
            // Add a small delay to ensure the removal is fully processed
            await new Promise(resolve => setTimeout(resolve, 100));

            // Create the new table with the correct schema
            const schema = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
            await db.run(schema);
            console.log("Memory table created with correct schema...");
        } catch (schemaError) {
            // If schema creation fails due to conflict, continue with existing schema
            console.log("Using existing memory table schema due to conflict:", schemaError.message);
        }

        // FTS Update
        try {
            await db.run(`::fts create memory:content_fts {extractor: content, tokenizer: Simple, filters: [Lowercase]}`);
        } catch (e) {
            if (!e.message.includes('already exists')) console.error('FTS Error:', e.message);
        }

        // 2. Load Data
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const records = yaml.load(fileContent);
        
        if (!Array.isArray(records)) throw new Error("Invalid snapshot format");

        console.log(`Found ${records.length} memories. Upgrading...`);

        const BATCH_SIZE = 100;
        let processed = 0;

        while (processed < records.length) {
            const batch = records.slice(processed, processed + BATCH_SIZE);
            
            // Map legacy records to new format
            const values = batch.map(r => [
                r.id || '',                                    // Ensure id exists
                parseInt(r.timestamp) || Date.now(),          // Ensure timestamp exists
                r.content || '',                              // Ensure content exists
                r.source || '',                               // Ensure source exists
                r.type || 'text',                             // Ensure type exists
                r.hash || getHash(r.content || ''),           // Backfill hash
                Array.isArray(r.buckets) ? r.buckets : (r.bucket ? [r.bucket] : ['core']), // Handle multi-bucket
                r.tags || '',                                 // Backfill tags as empty string
                JSON.stringify(r.epochs || [])               // Add epochs field with default empty array, ensuring it's a string
            ]);

            const q = `
                ?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $values
                :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}
            `;
            
            console.log(`\n[Hydrate] Running batch ${processed} to ${processed + batch.length}...`);
            await db.run(q, { values });
            processed += batch.length;
            process.stdout.write(`Progress: ${processed}/${records.length}`);
        }

        console.log("\n✅ Hydration & Upgrade Complete.");

    } catch (e) {
        console.error("\n❌ Hydration Failed:", e.message);
    }
}

const isPkg = typeof process.pkg !== 'undefined';
const basePath = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..', '..');
const DB_PATH = path.join(basePath, 'context.db');

module.exports = { hydrate };

if (require.main === module) {
    const targetFile = process.argv[2];
    const db = new CozoDb('rocksdb', DB_PATH);
    if (!targetFile) { console.log("Usage: node src/hydrate.js <snapshot.yaml>"); process.exit(1); }
    hydrate(db, targetFile);
}
