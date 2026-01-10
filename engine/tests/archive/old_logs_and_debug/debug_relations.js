const { CozoDb } = require('./src/core/cozo_loader');
const { DB_PATH } = require('./src/config/paths');

console.log('Initializing CozoDB with path:', DB_PATH);

// Initialize CozoDB with RocksDB backend
const db = new CozoDb('rocksdb', DB_PATH);

async function checkRelations() {
  try {
    console.log('Checking existing relations...');
    // Check existing relations
    const relationsResult = await db.run('::relations');
    console.log('Current relations in database:', relationsResult);

    console.log('Attempting to drop memory relation...');
    // Try to explicitly drop the memory relation if it exists
    try {
      const dropResult = await db.run(':drop memory');
      console.log('Drop result:', dropResult);
    } catch (dropError) {
      console.log('Drop failed (might not exist):', dropError.message);
    }

    console.log('Checking relations after attempted drop...');
    // Check relations again
    const relationsResultAfter = await db.run('::relations');
    console.log('Relations after attempted drop:', relationsResultAfter);

    console.log('Attempting to create memory relation with schema...');
    // Now try to create the memory relation with the schema
    try {
      const schemaQuery = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
      const createResult = await db.run(schemaQuery);
      console.log('Schema creation result:', createResult);
    } catch (createError) {
      console.error('Schema creation error:', createError);
    }

    console.log('Checking final relations...');
    // Final check of relations
    const finalRelations = await db.run('::relations');
    console.log('Final relations:', finalRelations);

  } catch (error) {
    console.error('Error in debug script:', error);
  } finally {
    console.log('Closing database connection...');
    // Close the database connection
    if (db && typeof db.close === 'function') {
      try {
        await db.close();
        console.log('Database connection closed');
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
  }
}

checkRelations().catch(err => console.error('Unhandled error:', err));