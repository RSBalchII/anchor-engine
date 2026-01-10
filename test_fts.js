const path = require('path');
const dbPath = path.join(__dirname, 'engine', 'context.db');
process.env.ECE_DB_PATH = dbPath;

const { db, init } = require('./engine/src/core/db');

async function test() {
    await init();
    
    // Test raw FTS query for "Coda"
    console.log('\n=== Testing FTS for "Coda" ===');
    try {
        const result = await db.run('?[id, score] := ~memory:content_fts{id | query: $q, k: 10, bind_score: s}, score = s', { q: 'Coda' });
        console.log('FTS Results:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('Top 3 scores:', result.rows.slice(0, 3).map(r => ({ id: r[0].substring(0, 40), score: r[1] })));
        }
    } catch (e) {
        console.log('FTS Error:', e.message);
    }
    
    // Test raw FTS query for "Dory"
    console.log('\n=== Testing FTS for "Dory" ===');
    try {
        const result = await db.run('?[id, score] := ~memory:content_fts{id | query: $q, k: 10, bind_score: s}, score = s', { q: 'Dory' });
        console.log('FTS Results:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('Top 3 scores:', result.rows.slice(0, 3).map(r => ({ id: r[0].substring(0, 40), score: r[1] })));
        }
    } catch (e) {
        console.log('FTS Error:', e.message);
    }
    
    // Check memory count
    console.log('\n=== Memory Count ===');
    const count = await db.run('?[count(id)] := *memory{id}');
    console.log('Total memories:', count.rows[0][0]);
    
    // Check FTS index
    console.log('\n=== Checking FTS Index ===');
    try {
        // Try a simple test
        const test = await db.run('?[id, score] := ~memory:content_fts{id | query: $q, k: 5, bind_score: s}, score = s', { q: 'the' });
        console.log('FTS for "the" returned:', test.rows.length, 'results');
    } catch (e) {
        console.log('FTS Index Error:', e.message);
    }

    process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
