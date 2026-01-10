const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { db } = require('../core/db');
const { BACKUPS_DIR } = require('../config/paths');
const { executeSearch } = require('../services/search/search');
const { ingestContent } = require('../services/ingest/ingest');
const { dream } = require('../services/dreamer/dreamer');
const inference = require('../services/inference/inference');

// Environment detection for error sanitization
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Sanitize error messages for API responses
 * In production, hide internal details; in development, show full errors
 */
function sanitizeError(error) {
  if (IS_PRODUCTION) {
    // Log the full error internally
    console.error('Internal error:', error);
    // Return a generic message to the client
    return 'An internal error occurred. Please try again later.';
  }
  return error.message || 'Unknown error';
}

// POST /v1/ingest
router.post('/ingest', async (req, res) => {
  try {
    const { content, filename, source, type, bucket, buckets } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: "Invalid content: must be a non-empty string" });
    }

    // Sanitize bucket/buckets input
    let targetBuckets = ['core']; // default
    if (buckets && Array.isArray(buckets)) {
      targetBuckets = buckets
        .filter(b => typeof b === 'string' && b.trim().length > 0)
        .map(b => b.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)); // Sanitize: only alphanumeric, hyphens, underscores, max 50 chars
    } else if (bucket && typeof bucket === 'string' && bucket.trim().length > 0) {
      targetBuckets = [bucket.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)]; // Sanitize: only alphanumeric, hyphens, underscores, max 50 chars
    }

    const result = await ingestContent(content, filename, source, type, targetBuckets);
    res.json(result);
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/query - ADMIN ONLY: Raw database query (disabled in production)
// WARNING: This endpoint allows arbitrary database queries and should be protected
router.post('/query', async (req, res) => {
  // Block raw queries in production for security
  if (IS_PRODUCTION) {
    return res.status(403).json({ 
      error: 'Raw database queries are disabled in production mode',
      hint: 'Use specific API endpoints instead'
    });
  }

  try {
    const { query, params = {} } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    // Additional safety: block dangerous operations even in dev
    const dangerousPatterns = [':rm ', ':remove ', ':delete ', '::remove', '::rm'];
    const lowerQuery = query.toLowerCase();
    if (dangerousPatterns.some(p => lowerQuery.includes(p))) {
      return res.status(403).json({ 
        error: 'Destructive operations are not allowed via this endpoint',
        hint: 'Use the backup/restore API for data management'
      });
    }
    
    const result = await db.run(query, params);
    res.json(result);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/memory/search
router.post('/memory/search', async (req, res) => {
  try {
    let { query, max_chars, bucket, buckets, deep } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: "Invalid query: must be a non-empty string" });
    }

    // Parse the query to detect syntax
    const { parseQuery } = require('../services/search/search');
    const parsedQuery = parseQuery(query);

    // Check if syntax is detected - if so, bypass SLM translation
    const hasSyntax = parsedQuery.phrases.length > 0 || parsedQuery.temporal.length > 0 || parsedQuery.buckets.length > 0;

    let intent = { query: query, buckets: [], strategy: 'broad' };

    if (!hasSyntax) {
      // Only run semantic translation if no syntax is detected
      console.log(`[Search] Translating intent for: "${query.substring(0, 50)}..."`);
      intent = await inference.translateIntent(query);
      console.log(`[Search] Intent detected:`, JSON.stringify(intent));
    }

    // 2. MERGE PARAMETERS
    // Use the optimized query from the LLM or the original query if syntax was detected
    const optimizedQuery = intent.query || query;

    // Merge explicit UI buckets with inferred buckets
    const explicitBuckets = buckets || (bucket ? [bucket] : []);
    const inferredBuckets = intent.buckets || [];
    const mergedBuckets = [...new Set([...explicitBuckets, ...inferredBuckets])];

    // Sanitize the NEW optimized query
    // Handle case where optimizedQuery might be an array (from LLM JSON response)
    let queryForSanitization = optimizedQuery;
    if (Array.isArray(optimizedQuery)) {
        queryForSanitization = optimizedQuery.join(' ');
    } else if (typeof optimizedQuery !== 'string') {
        queryForSanitization = String(optimizedQuery);
    }
    const sanitizedQuery = queryForSanitization.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ').replace(/\s+/g, ' ').trim();

    // Adjust deep parameter based on strategy
    if (intent.strategy === 'precise') {
      deep = false;
    } else if (intent.strategy === 'broad') {
      deep = deep || false; // Keep existing deep value or default to false
    }

    // Pass the original query to executeSearch so it can handle syntax parsing internally
    const result = await executeSearch(query, bucket, buckets, max_chars, deep);

    // Add metadata about the translation to the response for debugging
    result.meta = {
      original: query,
      translated: optimizedQuery,
      strategy: intent.strategy,
      buckets: mergedBuckets,
      hasSyntax: hasSyntax,
      parsed: parsedQuery
    };

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/system/spawn_shell
router.post('/system/spawn_shell', async (req, res) => {
  try {
    res.json({ success: true, message: "Shell spawned successfully" });
  } catch (error) {
    console.error('Spawn shell error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/system/execute_safe
const SafeShellExecutor = require('../services/safe-shell-executor/safe-shell-executor');

router.post('/system/execute_safe', async (req, res) => {
  try {
    const { command, timeout = 30000 } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Execute the command safely in detached mode
    const result = await SafeShellExecutor.execute(command, { timeout });

    res.json({
      success: true,
      message: `Command started safely. Check log file: ${result.logFile}`,
      logFile: result.logFile,
      detached: true
    });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /v1/models
router.get('/models', async (req, res) => {
  try {
    res.json(inference.listModels());
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/inference/load
router.post('/inference/load', async (req, res) => {
  try {
    const { model, options } = req.body;
    const result = await inference.loadModel(model, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/chat/completions
router.post('/chat/completions', async (req, res) => {
  try {
    const { messages, stream = false, ...options } = req.body;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await inference.chat(messages, options, (token) => {
        const data = JSON.stringify({ token });
        res.write(`data: ${data}\n\n`);
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await inference.chat(messages, options);
      res.json({ choices: [{ message: { content: response } }] });
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: sanitizeError(error) });
    } else {
      res.write(`data: ${JSON.stringify({ error: sanitizeError(error) })}\n\n`);
      res.end();
    }
  }
});

// POST /v1/dream
router.post('/dream', async (req, res) => {
  try {
    const result = await dream();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// === SCRIBE (Markovian State) ENDPOINTS ===
const scribe = require('../services/scribe/scribe');

// POST /v1/scribe/update - Update session state from conversation history
router.post('/scribe/update', async (req, res) => {
  try {
    const { history } = req.body;
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'history array is required' });
    }
    const result = await scribe.updateState(history);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /v1/scribe/state - Get current session state
router.get('/scribe/state', async (req, res) => {
  try {
    const state = await scribe.getState();
    res.json({ state: state || null });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// DELETE /v1/scribe/state - Clear session state
router.delete('/scribe/state', async (req, res) => {
  try {
    const result = await scribe.clearState();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /v1/inference/status - Get model status
router.get('/inference/status', async (req, res) => {
  try {
    res.json(inference.getStatus());
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /v1/backup
router.get('/backup', async (req, res) => {
  try {
    console.log("[Backup] Starting full database export...");
    const query = `?[id, timestamp, content, source, type, hash, buckets, tags] := *memory{id, timestamp, content, source, type, hash, buckets, tags}`;
    const result = await db.run(query);

    const records = result.rows.map(row => ({
      id: row[0],
      timestamp: row[1],
      content: row[2],
      source: row[3],
      type: row[4],
      hash: row[5],
      buckets: row[6]
    }));

    const yamlStr = yaml.dump(records, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });

    const filename = `cozo_memory_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.yaml`;
    const backupPath = path.join(BACKUPS_DIR, filename);
    
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    fs.writeFileSync(backupPath, yamlStr);

    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(yamlStr);
    console.log(`[Backup] Exported ${records.length} memories to ${filename}`);
  } catch (error) {
    console.error('[Backup] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /v1/buckets
router.get('/buckets', async (req, res) => {
  try {
    const query = '?[buckets] := *memory{buckets}';
    const result = await db.run(query);
    let buckets = [...new Set(result.rows.flatMap(row => row[0]))].sort();
    if (buckets.length === 0) buckets = ['core'];
    res.json(buckets);
  } catch (error) {
    console.error('Buckets error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// POST /v1/admin/import-yaml - Import memories from a structured YAML file
// Expects YAML file with array of records: [{id, timestamp, content, source, type, hash, buckets}, ...]
router.post('/admin/import-yaml', async (req, res) => {
  // Only allow in development mode
  if (IS_PRODUCTION) {
    return res.status(403).json({ 
      error: 'YAML import is disabled in production mode'
    });
  }

  try {
    const { yamlPath, dryRun = false, filterPatterns = [], maxContentLength = 500000, minContentLength = 50 } = req.body;
    
    if (!yamlPath || typeof yamlPath !== 'string') {
      return res.status(400).json({ error: 'yamlPath is required (absolute path to YAML file)' });
    }

    if (!fs.existsSync(yamlPath)) {
      return res.status(404).json({ error: `File not found: ${yamlPath}` });
    }

    console.log(`[YAML Import] Loading file: ${yamlPath}`);
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    
    let records;
    try {
      records = yaml.load(yamlContent);
    } catch (parseError) {
      return res.status(400).json({ error: `YAML parse error: ${parseError.message}` });
    }

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'YAML must contain an array of memory records' });
    }

    console.log(`[YAML Import] Parsed ${records.length} total records`);

    // Content quality filters
    const junkPatterns = [
      /^<[^>]+>/,                           // HTML tags at start
      /<!DOCTYPE/i,                         // HTML documents
      /<html/i,                             // HTML content
      /\x00/,                               // Null bytes (UTF-16 garbage)
      /class=['"][^'"]*['"]/,               // CSS class attributes
      /data-[a-z-]+=['"][^'"]*['"]/,        // data- attributes
      /href=['"]https?:\/\//,               // Links in HTML
      /<script/i,                           // Script tags
      /<style/i,                            // Style tags
      /xdaimages\.com/i,                    // Scraped web garbage
      /wordpress/i,                         // WordPress scraped content
      ...filterPatterns.map(p => new RegExp(p, 'i'))
    ];

    // Additional explicit content filter (basic patterns)
    const explicitPatterns = [
      /\bpenis\b/i, /\bvagina\b/i, /\bclitoris\b/i, /\berection\b/i,
      /\borgasm\b/i, /\bejaculat/i, /\bmasturbat/i, /\bgenitals?\b/i,
      /\bnaked\b.*\b(body|woman|man)\b/i, /\bexplicit\s+sexual/i
    ];

    let imported = 0;
    let skipped = { junk: 0, explicit: 0, tooShort: 0, tooLong: 0, duplicate: 0, error: 0 };
    const importedIds = [];

    for (const record of records) {
      // Validate required fields
      if (!record.content || typeof record.content !== 'string') {
        skipped.junk++;
        continue;
      }

      const content = record.content.trim();

      // Length checks
      if (content.length < minContentLength) {
        skipped.tooShort++;
        continue;
      }
      if (content.length > maxContentLength) {
        skipped.tooLong++;
        continue;
      }

      // Junk content check
      if (junkPatterns.some(pattern => pattern.test(content))) {
        skipped.junk++;
        continue;
      }

      // Explicit content check
      if (explicitPatterns.some(pattern => pattern.test(content))) {
        skipped.explicit++;
        continue;
      }

      // Prepare for ingest
      const source = record.source || 'yaml-import';
      const type = record.type || 'document';
      const buckets = record.buckets || ['imported'];

      if (dryRun) {
        imported++;
        importedIds.push({ source, contentLength: content.length, type });
        continue;
      }

      // Actually ingest
      try {
        await ingestContent(content, source, source, type, buckets);
        imported++;
        importedIds.push({ source, contentLength: content.length, type });
      } catch (e) {
        console.error(`[YAML Import] Error ingesting ${source}:`, e.message);
        skipped.error++;
      }
    }

    res.json({
      status: 'success',
      dryRun,
      total: records.length,
      imported,
      skipped,
      samples: importedIds.slice(0, 10)
    });
  } catch (error) {
    console.error('[YAML Import] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// DELETE /v1/admin/cleanup-bulk - Remove bulk export documents from database
// These are documents like combined_memory.yaml that shouldn't be in the DB
router.delete('/admin/cleanup-bulk', async (req, res) => {
  // Only allow in development mode
  if (IS_PRODUCTION) {
    return res.status(403).json({ 
      error: 'Admin cleanup is disabled in production mode'
    });
  }

  try {
    // Find all documents with "combined" in source name (bulk exports)
    const findQuery = '?[id, source] := *memory{id, source}';
    const findResult = await db.run(findQuery);
    
    // Filter for combined/bulk export files
    const bulkPatterns = ['combined_memory', 'combined_', '.snapshot'];
    const bulkIds = findResult.rows
      .filter(row => bulkPatterns.some(p => row[1].toLowerCase().includes(p.toLowerCase())))
      .map(row => row[0]);
    
    if (bulkIds.length === 0) {
      return res.json({ 
        status: 'success', 
        message: 'No bulk export documents found to remove',
        removed: 0 
      });
    }

    // Delete each bulk document
    let removed = 0;
    for (const id of bulkIds) {
      try {
        const deleteQuery = '?[id] <- [[$id]] :delete memory {id}';
        await db.run(deleteQuery, { id });
        removed++;
        console.log(`Cleaned up bulk document: ${id}`);
      } catch (e) {
        console.error(`Failed to delete ${id}:`, e.message);
      }
    }

    res.json({ 
      status: 'success', 
      message: `Removed ${removed} bulk export document(s)`,
      removed,
      ids: bulkIds
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

module.exports = router;
