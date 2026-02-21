
import { db } from './packages/anchor-engine/engine/src/core/db.js';

async function debugSearch() {
    console.log("🔍 Debugging 'STAR Algorithm' Search...");

    try {
        // 1. Check Atom Positions (Exact Match)
        console.log("\n--- 1. Atom Check (Exact) ---");
        const atoms = await db.run(`
      SELECT atom_label, compound_id, byte_offset 
      FROM atom_positions 
      WHERE lower(atom_label) = 'star' 
      LIMIT 5
    `);
        console.log("Atoms found:", atoms.rows);

        // 2. Check FTS (Simple)
        console.log("\n--- 2. FTS Check (Simple) ---");
        const fts = await db.run(`
      SELECT id, content 
      FROM molecules 
      WHERE to_tsvector('simple', content) @@ to_tsquery('simple', 'star & algorithm')
      LIMIT 2
    `);
        console.log("FTS Matches:", fts.rows ? fts.rows.length : 0);
        if (fts.rows && fts.rows.length > 0) {
            console.log("Sample:", fts.rows[0].content.substring(0, 100));
        }

        // 3. Check ILIKE (Ground Truth)
        console.log("\n--- 3. ILIKE Check (Slow) ---");
        const ilike = await db.run(`
      SELECT id, content 
      FROM molecules 
      WHERE content ILIKE '%star algorithm%'
      LIMIT 2
    `);
        console.log("ILIKE Matches:", ilike.rows ? ilike.rows.length : 0);
        if (ilike.rows && ilike.rows.length > 0) {
            console.log("Sample:", ilike.rows[0].content.substring(0, 100));
        }

    } catch (err) {
        console.error("❌ Error:", err);
    }
}

debugSearch();
