const { CozoDb } = require('./src/core/cozo_loader');

// Initialize CozoDB with RocksDB backend
const db = new CozoDb('rocksdb', './context.db');

async function testConnection() {
  try {
    console.log('Testing database connection...');

    // Try to check existing relations
    try {
      console.log('Attempting to query system relations...');
      const schemaCheck = await db.run('?[name, kind, num_cols, num_rows] := *sys_relations{}');
      console.log('Schema check successful. Found relations:', schemaCheck.rows.length);
      console.log('All relations:', schemaCheck.rows);

      const memoryExists = schemaCheck.rows.some(row => row[0] === 'memory');
      console.log('Memory relation exists:', memoryExists);
    } catch (e) {
      console.log('Schema check failed:', e.message);
      console.log('Full error:', e);
    }

    // Try to create memory relation with "if not exists" approach
    try {
      console.log('Attempting to remove existing memory relation (if it exists)...');
      await db.run(':rm memory');
      console.log('Existing memory relation removed (if it existed)');
    } catch (e) {
      console.log('Memory relation removal result (expected if relation doesn\'t exist):', e.message);
    }

    // Now create the memory relation
    try {
      console.log('Attempting to create memory relation...');
      const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
      await db.run(schemaQuery);
      console.log('Memory relation created successfully');
    } catch (e) {
      console.log('Memory relation creation failed:', e.message);
      console.log('Full error:', e);
    }

    // Try to check the columns of the memory relation
    try {
      console.log('Attempting to check memory relation columns...');
      const columnsQuery = '?[col_name, col_type] := *columns{rel_name: "memory", col_name, col_type}';
      const columns = await db.run(columnsQuery);
      console.log('Memory relation columns:', columns.rows);
    } catch (e) {
      console.log('Column check failed:', e.message);
      console.log('Full error:', e);
    }

    // Close the database connection
    if (db && typeof db.close === 'function') {
      await db.close();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testConnection();