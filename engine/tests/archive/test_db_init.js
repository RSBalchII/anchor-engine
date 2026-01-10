const { db, init } = require('./src/core/db');

async function testDbInit() {
  console.log('Starting database initialization...');
  try {
    await init();
    console.log('Database initialization completed successfully');
    
    // Check if the schema has the epochs column
    try {
      const columnsQuery = '?[col_name, col_type] := *columns{rel_name: "memory", col_name, col_type}';
      const columns = await db.run(columnsQuery);
      console.log('Current memory table columns:', JSON.stringify(columns.rows, null, 2));
      
      const hasEpochs = columns.rows.some(row => row[0] === 'epochs');
      console.log('Has epochs column:', hasEpochs);
      
      const hasBuckets = columns.rows.some(row => row[0] === 'buckets');
      console.log('Has buckets column:', hasBuckets);
      
      const hasTags = columns.rows.some(row => row[0] === 'tags');
      console.log('Has tags column:', hasTags);
    } catch (e) {
      console.error('Error checking columns:', e.message);
    }
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.error('Full error:', err);
  }
}

testDbInit();