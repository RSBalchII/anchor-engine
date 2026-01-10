const { db } = require('./src/core/db');

async function analyzeSearchIssue() {
  console.log('=== Analyzing Search Issue: "Dory" vs Codebase ===\n');

  // 1. Check for large codebase memories
  console.log('1. Looking for oversized or codebase memories...');
  const allMemories = await db.run('?[id, source, content] := *memory{id, source, content}');
  
  const codebaseMemories = allMemories.rows.filter(row => 
    row[1].toLowerCase().includes('codebase') || 
    row[1].toLowerCase().includes('anchor-memory')
  );
  
  console.log(`   Found ${codebaseMemories.length} codebase-related memories:`);
  codebaseMemories.forEach(row => {
    console.log(`   - ${row[1]} (${row[2].length} chars)`);
  });

  // 2. Check which memories contain "Dory"
  console.log('\n2. Memories containing "Dory" or "Dorinda":');
  const doryMemories = allMemories.rows.filter(row => 
    row[2].toLowerCase().includes('dory') || 
    row[2].toLowerCase().includes('dorinda')
  );
  
  console.log(`   Found ${doryMemories.length} memories with Dory/Dorinda:`);
  doryMemories.forEach(row => {
    const mentions = (row[2].match(/dory|dorinda/gi) || []).length;
    console.log(`   - ${row[1]} (${row[2].length} chars, ${mentions} mentions)`);
  });

  // 3. Test FTS query for "Dory"
  console.log('\n3. FTS query for "Dory":');
  try {
    const ftsResult = await db.run(
      '?[id, score] := ~memory:content_fts{id | query: $q, k: 10, bind_score: s}, score = s',
      { q: 'Dory' }
    );
    console.log(`   FTS returned ${ftsResult.rows.length} results`);
    
    // Get source for each FTS result
    for (const row of ftsResult.rows) {
      const sourceQuery = await db.run('?[source] := *memory{id, source}, id = $id', { id: row[0] });
      if (sourceQuery.rows.length > 0) {
        console.log(`   - Score ${row[1].toFixed(2)}: ${sourceQuery.rows[0][0]}`);
      }
    }
  } catch (e) {
    console.error('   FTS Error:', e.message);
  }

  // 4. Check if codebase memory contains "Dory"
  console.log('\n4. Does codebase memory contain "Dory"?');
  codebaseMemories.forEach(row => {
    const hasDory = row[2].toLowerCase().includes('dory');
    console.log(`   - ${row[1]}: ${hasDory ? 'YES (polluting results!)' : 'No'}`);
    if (hasDory) {
      // Find where "dory" appears
      const matches = row[2].matchAll(/dory/gi);
      for (const match of [...matches].slice(0, 3)) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(row[2].length, match.index + 30);
        console.log(`     Context: "...${row[2].substring(start, end)}..."`);
      }
    }
  });
}

analyzeSearchIssue().catch(console.error);
