
import { db } from './src/core/db.js';

async function run() {
    await db.init();
    const res = await db.run('::columns memory');
    console.log('Columns:', res.rows);
}

run().catch(console.error);
