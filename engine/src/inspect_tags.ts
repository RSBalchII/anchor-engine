
import { CozoDb } from 'cozo-node';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'context.db');
const db = new CozoDb('rocksdb', dbPath);

async function run() {
    try {
        const query = '?[tags] := *memory{tags} :limit 10';
        const result = await db.run(query);
        console.log('Tags sample:', JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
