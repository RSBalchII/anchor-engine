const { db, init } = require('./src/core/db');

async function testDreamer() {
  let output = 'Starting database initialization for Dreamer test...\n';
  
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
      
      // Test that we can insert a record with all required fields
      const testId = 'test_dreamer_' + Date.now();
      const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
      await db.run(insertQuery, {
        $data: [[
          testId,
          Date.now(),
          'Test content for dreamer service',
          'test_source',
          'test_type',
          require('crypto').createHash('md5').update('Test content for dreamer service').digest('hex'),
          ['test_bucket'],
          '[]',
          '[]'
        ]]
      });
      output += 'Successfully inserted test record with all fields\n';
      
      // Now try to run a simplified version of the dreamer query to check syntax
      const safeId = testId.replace(/[^a-zA-Z0-9_]/g, '_');
      const currentQuery = `?[timestamp, content, source, type, hash, epochs] := *memory{id, timestamp, content, source, type, hash, epochs}, id == $id_param`;
      const currentResult = await db.run(currentQuery, { $id_param: safeId });
      output += 'Successfully executed dreamer-style query with ' + currentResult.rows.length + ' results\n';
      
      // Test the delete query syntax
      const deleteQuery = `:delete memory := [id: $del_id]`;
      await db.run(deleteQuery, { $del_id: safeId });
      output += 'Successfully executed delete query\n';
      
    } catch (e) {
      output += 'Error during dreamer test: ' + e.message + '\n';
      output += 'Stack: ' + e.stack + '\n';
    }
  } catch (err) {
    output += 'Database initialization failed: ' + err.message + '\n';
    output += 'Full error: ' + JSON.stringify(err) + '\n';
  }
  
  // Write output to file
  const fs = require('fs');
  fs.writeFileSync('./dreamer_test_output.txt', output);
  console.log(output);
}

testDreamer();