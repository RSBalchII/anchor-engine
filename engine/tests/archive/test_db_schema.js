const { db, init } = require('./src/core/db');
const fs = require('fs');

async function testDbInit() {
  let output = 'Starting database initialization...\n';
  
  try {
    await init();
    output += 'Database initialization completed successfully\n';
    
    // Check if the schema has the epochs column
    try {
      const columnsQuery = '?[col_name, col_type] := *columns{rel_name: "memory", col_name, col_type}';
      const columns = await db.run(columnsQuery);
      output += 'Current memory table columns: ' + JSON.stringify(columns.rows, null, 2) + '\n';
      
      const hasEpochs = columns.rows.some(row => row[0] === 'epochs');
      output += 'Has epochs column: ' + hasEpochs + '\n';
      
      const hasBuckets = columns.rows.some(row => row[0] === 'buckets');
      output += 'Has buckets column: ' + hasBuckets + '\n';
      
      const hasTags = columns.rows.some(row => row[0] === 'tags');
      output += 'Has tags column: ' + hasTags + '\n';
    } catch (e) {
      output += 'Error checking columns: ' + e.message + '\n';
    }
  } catch (err) {
    output += 'Database initialization failed: ' + err.message + '\n';
    output += 'Full error: ' + JSON.stringify(err) + '\n';
  }
  
  // Write output to file
  fs.writeFileSync('./test_output.txt', output);
  console.log(output);
}

testDbInit();