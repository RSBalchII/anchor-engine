# Standard 053: CozoDB Pain Points & Lessons Learned

> **Status**: CRITICAL REFERENCE  
> **Last Updated**: January 9, 2026  
> **Pain Level**: 🔥🔥🔥🔥🔥 (We've been through the ringer)

This document consolidates all CozoDB-specific gotchas, pain points, and hard-won lessons from the ECE project. Reference this BEFORE writing any CozoDB queries.

---

## Table of Contents
1. [Query Result Format](#1-query-result-format-cozo-node)
2. [FTS Index Does NOT Survive Backup/Restore](#2-fts-index-does-not-survive-backuprestore)
3. [Order and Limit Syntax](#3-order-and-limit-syntax)
4. [Index Must Be Dropped BEFORE Relation](#4-index-must-be-dropped-before-relation)
5. [Parameter Binding Syntax](#5-parameter-binding-syntax)
6. [FTS Query Syntax](#6-fts-query-syntax)
7. [Schema Creation Syntax](#7-schema-creation-syntax)
8. [Insert vs Put vs Replace](#8-insert-vs-put-vs-replace)
9. [Oversized Content Will Poison Your Search](#9-oversized-content-will-poison-your-search)
10. [System Commands Reference](#10-system-commands-reference)
11. [Common Error Messages & Solutions](#11-common-error-messages--solutions)
12. [Debugging Queries](#12-debugging-queries)
13. [**Search Algorithm Tuning**](#13-search-algorithm-tuning) ⭐ NEW
14. [**Buckets vs Tags: Semantic Distinction**](#14-buckets-vs-tags-semantic-distinction) ⭐ NEW
15. [**Schema Introspection**](#15-schema-introspection) ⭐ NEW

---

## 1. Query Result Format (cozo-node)

### ❌ WRONG - What You Might Expect
```javascript
const result = await db.run(query);
if (result.ok) {  // WRONG!
    console.log(result.rows);
}
```

### ✅ CORRECT - What CozoDB Actually Returns
```javascript
const result = await db.run(query);
// Result format: { headers: ['col1', 'col2'], rows: [[val1, val2], ...] }
if (result.rows && result.rows.length > 0) {
    console.log(result.rows);
}
```

**Pain Point**: CozoDB returns `{ headers: [...], rows: [...] }`, NOT `{ ok: true, rows: [...] }`. There is no `.ok` property. Checking `result.ok` will always be `undefined`.

---

## 2. FTS Index Does NOT Survive Backup/Restore

### The Problem
When you backup a CozoDB database to YAML and restore it, the **FTS index is NOT included**. The relation data is restored, but the index must be recreated.

### The Fix
Always recreate the FTS index after hydration:

```javascript
// After restoring from backup
async function ensureFTSIndex() {
    try {
        await db.run('::fts create memory:content_fts { extractor: content, tokenizer: Simple, filters: [Lowercase] }');
        console.log('FTS index created');
    } catch (e) {
        // Index might already exist
        if (!e.message.includes('already exists')) {
            console.error('FTS creation failed:', e.message);
        }
    }
}
```

**Pain Point**: Your search will silently fail or return no results after a backup restore. The error message `Index content_fts not found on relation memory` is your clue.

---

## 3. Order and Limit Syntax

### ❌ WRONG - Invalid Syntax
```datalog
?[id, content] := *memory{id, content} :order -timestamp :limit 50
```

### ✅ CORRECT - Proper CozoDB Syntax  
```datalog
?[id, content, timestamp] := *memory{id, content, timestamp} :limit 50 :order -timestamp
```

**Pain Points**:
1. `:limit` should come BEFORE `:order` 
2. The column you're ordering by (`timestamp`) MUST be in the output projection `?[...]`
3. `-timestamp` means descending order, `timestamp` means ascending

---

## 4. Index Must Be Dropped BEFORE Relation

### The Problem
CozoDB will refuse to drop a relation if it has indices attached.

### The Fix
```javascript
async function removeMemoryRelation() {
    // FIRST: Drop all indices
    const ftsIndexNames = ['memory:content_fts', 'content_fts'];
    for (const indexName of ftsIndexNames) {
        try {
            await db.run(`::fts drop ${indexName}`);
        } catch (e) {
            // Index might not exist, continue
        }
    }
    
    // THEN: Drop the relation
    await db.run('::remove memory');
}
```

**Pain Point**: You'll get cryptic errors about "relation in use" or similar if you try to drop a relation with active indices.

---

## 5. Parameter Binding Syntax

### ❌ WRONG - Template Literal Injection (SQL Injection Risk!)
```javascript
const query = `?[id] := *memory{id, content}, content like '%${searchTerm}%'`;
```

### ✅ CORRECT - Proper Parameter Binding
```javascript
const query = `?[id, score] := ~memory:content_fts{id | query: $q, k: 10, bind_score: s}, score = s`;
const result = await db.run(query, { q: searchTerm });
```

**Pain Points**:
1. Use `$paramName` in the query, then pass `{ paramName: value }` as second argument
2. For bulk inserts: `?[...] <- $data :put relation {...}` with `{ data: [[row1], [row2]] }`

---

## 6. FTS Query Syntax

### Basic FTS Query
```datalog
?[id, score] := ~memory:content_fts{id | query: $q, k: 10, bind_score: s}, score = s
```

**Breakdown**:
- `~memory:content_fts` - The FTS index (tilde prefix!)
- `{id | ...}` - Output columns before the pipe
- `query: $q` - The search query parameter
- `k: 10` - Number of results (top-k)
- `bind_score: s` - Bind the relevance score to variable `s`
- `score = s` - Project the score into output

### FTS with Join to Get Full Content
```datalog
?[id, score, content, timestamp] := 
    ~memory:content_fts{id | query: $q, k: 20, bind_score: s}, 
    score = s,
    *memory{id, content, timestamp}
```

---

## 7. Schema Creation Syntax

### ❌ WRONG - Multi-line with Line Breaks
```javascript
const query = `
:create memory {
    id: String =>
    timestamp: Int,
    content: String
}`;
```

### ✅ CORRECT - Single Line or Escaped
```javascript
const query = ':create memory {id: String => timestamp: Int, content: String, source: String, type: String, hash: String, buckets: [String], tags: String, epochs: String}';
```

**Pain Point**: CozoDB's parser can be finicky about line breaks in schema definitions. Keep it on one line or be very careful with escaping.

---

## 8. Insert vs Put vs Replace

| Command | Behavior |
|---------|----------|
| `:insert` | Fails if key exists |
| `:put` | Upsert - insert or update |
| `:replace` | Same as `:put` |
| `:rm` | Delete matching rows |

### Bulk Insert Pattern
```javascript
const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
const params = {
    data: [
        [id1, ts1, content1, source1, type1, hash1, buckets1, tags1, epochs1],
        [id2, ts2, content2, source2, type2, hash2, buckets2, tags2, epochs2],
    ]
};
await db.run(insertQuery, params);
```

---

## 9. Oversized Content Will Poison Your Search

### The Problem
If you ingest large files (multi-MB), they will:
1. Match almost every search query (they contain lots of text)
2. Consume your entire context budget
3. Make FTS scores meaningless

### The Rule
**Maximum content size: 500KB** (500,000 characters)

### The Fix
Filter during ingestion:
```javascript
const MAX_CONTENT_SIZE = 500000; // 500KB

async function ingestContent(content, source) {
    if (content.length > MAX_CONTENT_SIZE) {
        console.warn(`Rejecting oversized content: ${source} (${(content.length/1024/1024).toFixed(2)} MB)`);
        return { status: 'rejected', reason: 'oversized' };
    }
    // ... proceed with ingestion
}
```

### Cleanup Query
```javascript
// Find and delete oversized memories
const r = await db.run('?[id, source, content] := *memory{id, source, content}');
const oversized = r.rows.filter(row => row[2].length > 500000);
for (const row of oversized) {
    await db.run('?[id] <- [[$id]] :rm memory {id}', { id: row[0] });
}
```

---

## 10. System Commands Reference

| Command | Purpose |
|---------|---------|
| `::relations` | List all relations |
| `::columns` | List all columns (queryable) |
| `::indices` | List all indices (may not work in all versions) |
| `::fts create <name> {...}` | Create FTS index |
| `::fts drop <name>` | Drop FTS index |
| `::remove <relation>` | Drop a relation |

### Check if Relation Exists
```javascript
const relations = await db.run('::relations');
const exists = relations.rows.some(row => row[0] === 'memory');
```

### Check Column Metadata
```datalog
?[col_name] := *columns{rel_name: 'memory', col_name}
```

---

## 11. Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Index content_fts not found on relation memory` | FTS index missing (after restore) | Recreate with `::fts create` |
| `Unknown error` | Usually bad query syntax | Check parameter binding, column names |
| `relation in use` | Trying to drop relation with indices | Drop indices first |
| `already exists` | Creating duplicate relation/index | Use `if not exists` or catch error |
| `column not found` | Column name mismatch | Check schema with `::columns` |

---

## 12. Debugging Queries

### Log Query + Params Before Execution
```javascript
async function safeRun(query, params = {}) {
    console.log('CozoDB Query:', query);
    console.log('CozoDB Params:', JSON.stringify(params));
    try {
        const result = await db.run(query, params);
        console.log('CozoDB Result:', JSON.stringify(result).substring(0, 500));
        return result;
    } catch (e) {
        console.error('CozoDB Error:', e.message);
        throw e;
    }
}
```

---

## 13. Search Algorithm Tuning

### The Problem: Timestamp vs Relevance
Plain queries (no special syntax like `"quotes"`, `@temporal`, or `#bucket`) were falling back to `basicSearch()` which:
1. Loads ALL memories into JavaScript
2. Filters by simple `content.includes(query)`
3. Groups by source and sorts by **timestamp** (newest first)

This meant a **recent codebase file** with 1 mention of "Dory" would appear BEFORE a **personal memory** with 26 mentions of "Dory".

### The Fix: FTS-First Search
All queries now use `ftsSearch()` which:
1. Uses CozoDB's BM25 FTS for relevance scoring
2. Sorts results by **BM25 score** (most relevant first)
3. Falls back to `basicSearch()` only if FTS fails

```javascript
// New ftsSearch function in search.js
async function ftsSearch(query, max_chars = 5000, buckets = [], deep = false) {
    const ftsQuery = `?[id, score] := ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s}, score = s`;
    const ftsResult = await db.run(ftsQuery, { q: sanitizedQuery });
    
    // Sort by BM25 score (descending) - most relevant first
    const sortedResults = ftsResult.rows.sort((a, b) => b[1] - a[1]);
    // ... build context from high-scoring results
}
```

### Search Budget Ratios
The `executeSyntaxSearch` function (for queries with special syntax) uses a 70/30 split:
- **70% Direct Context**: BM25-scored results matching the exact query
- **30% Associative Context**: Related documents discovered via shared tags/buckets

When tuning the algorithm, consider:
1. **k parameter**: Number of FTS results to retrieve (default: 50 normal, 200 deep)
2. **Window size**: How much context around each hit (300-1500 chars)
3. **Score threshold**: Minimum BM25 score to include (currently none)

### Debugging Search Relevance
```javascript
// Check what's winning the scoring
const ftsQuery = `?[id, score] := ~memory:content_fts{id | query: $q, k: 50, bind_score: s}, score = s`;
const result = await db.run(ftsQuery, { q: 'Dory' });
result.rows.sort((a, b) => b[1] - a[1]);
console.log('Top 10 by score:', result.rows.slice(0, 10));
```

---

## 14. Buckets vs Tags: Semantic Distinction

### Buckets = User-Facing Directory Structure

**Purpose**: Buckets define WHERE memories live in the physical file system mirror and allow users to **dilate search scope** by enabling/disabling specific categories.

**Characteristics**:
- **Visible to users** in the UI as toggleable chips
- **Correspond to directories** in `context/mirrored_brain/`
- **User-controlled filtering** - select which buckets to include in search
- **Coarse-grained** - top-level categorization (e.g., "conversations", "coding-notes", "life-events")

**Schema**: `buckets: [String]` - Array of bucket names per memory

**Example Buckets**:
```
core                    -> context/mirrored_brain/core/
conversations          -> context/mirrored_brain/conversations/
coding-notes           -> context/mirrored_brain/coding-notes/
life-events            -> context/mirrored_brain/life-events/
```

**UI Behavior**: The dropdown in the interface allows users to toggle buckets ON/OFF to expand or narrow their search scope. With no buckets selected, search runs across ALL memories.

### Tags = Internal Similarity Metadata

**Purpose**: Tags are **unseen to users** but used internally for **associative search** - finding related memories that share conceptual similarity.

**Characteristics**:
- **Hidden from users** - no UI controls
- **Auto-generated or extracted** from content
- **Fine-grained** - semantic concepts, entities, topics
- **Used for "Why" context** - the 30% associative budget in syntax search

**Schema**: `tags: String` - JSON array stored as string (e.g., `'["ai", "memory", "personal"]'`)

**How Tags Power Associative Search**:
```javascript
// In executeSyntaxSearch, after getting direct results:

// 1. Harvest tags from direct results
const allBuckets = new Set();
for (const doc of Object.values(docsMap)) {
    if (doc.buckets && Array.isArray(doc.buckets)) {
        doc.buckets.forEach(b => allBuckets.add(b));
    }
}
const tags = Array.from(allBuckets);

// 2. Find related documents via shared tags (30% of budget)
if (tags.length > 0 && assocBudget > 500) {
    assocContext = await tagSearch(tags, ids, expandedTargetBuckets, assocBudget);
}
```

### Summary Table

| Aspect | Buckets | Tags |
|--------|---------|------|
| **User Visibility** | ✅ Visible, toggleable | ❌ Hidden |
| **Purpose** | Filter/dilate search scope | Find related memories |
| **Granularity** | Coarse (directories) | Fine (concepts) |
| **Storage** | `[String]` array | JSON string |
| **Controls** | UI chips/dropdowns | Automatic |
| **Budget Use** | 70% direct context | 30% associative |

### Best Practice
- **Buckets**: Keep to ~10-20 top-level categories matching your knowledge domains
- **Tags**: Let the system auto-extract from content; don't expose to users
- **UI**: Only show bucket filtering; tags work behind the scenes

---

## 15. Schema Introspection

### The Problem
When checking if a column exists in a relation, you might try to query a system `*columns` relation:

```javascript
// ❌ WRONG - This relation doesn't exist
const columnCheckQuery = `?[col_name] := *columns{rel_name: 'memory', col_name}`;
const columnResult = await db.run(columnCheckQuery);  // FAILS!
```

This causes schema migration to run on **every startup** because the check always fails.

### ✅ CORRECT - Use System Commands
CozoDB provides system commands (prefixed with `::`) for introspection:

```javascript
// Use ::columns <relation_name> to get column metadata
const columnResult = await db.run('::columns memory');
// Returns: { headers: ['column', 'type', 'nullable', ...], rows: [['id', 'String', ...], ...] }

const hasEpochsColumn = columnResult.rows.some(row => row[0] === 'epochs');
if (hasEpochsColumn) {
    console.log('Schema already includes epochs column');
} else {
    await performSchemaMigration();
}
```

### Fallback: Probe Query
If `::columns` fails, use a probe query:

```javascript
try {
    // Try to reference the column - if it fails, column doesn't exist
    await db.run('?[epochs] := *memory{epochs}, epochs = ""', {});
    console.log('Column exists');
} catch (probeError) {
    console.log('Column does not exist, migrating...');
    await performSchemaMigration();
}
```

### System Commands Reference (Extended)

| Command | Purpose | Example |
|---------|---------|--------|
| `::relations` | List all relations | `await db.run('::relations')` |
| `::columns <rel>` | List columns of relation | `await db.run('::columns memory')` |
| `::indices <rel>` | List indices on relation | `await db.run('::indices memory')` |
| `::fts list` | List FTS indices | `await db.run('::fts list')` |
| `::remove <rel>` | Drop a relation | `await db.run('::remove memory')` |

**Pain Point**: Schema migration running every startup wastes ~5-10 seconds and recreates the FTS index unnecessarily. Always use proper introspection!

---

## Summary: The Golden Rules

1. **Result format is `{ headers, rows }` not `{ ok, rows }`**
2. **FTS index must be recreated after backup restore**
3. **`:limit` before `:order`, and order column must be in projection**
4. **Drop indices before dropping relations**
5. **Use parameter binding, never template literal injection**
6. **Max content size: 500KB**
7. **Keep schema definitions on one line**
8. **Always check `result.rows.length` not `result.ok`**
9. **Always use FTS with BM25 scoring for search - never timestamp-only sorting** ⭐
10. **Buckets = user-visible scope filter; Tags = hidden similarity metadata** ⭐
11. **Use `::columns <rel>` for schema introspection, not `*columns{...}`** ⭐

---

## Related Standards
- [033-cozodb-syntax-compliance.md](033-cozodb-syntax-compliance.md) - Basic syntax requirements
- [031-ghost-engine-stability-fix.md](../10-ARCH/031-ghost-engine-stability-fix.md) - FTS failure handling
- [037-database-hydration-snapshot-portability.md](037-database-hydration-snapshot-portability.md) - Backup/restore workflow
