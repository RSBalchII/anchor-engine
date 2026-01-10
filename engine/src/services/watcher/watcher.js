const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { db } = require('../../core/db');
const { CONTEXT_DIR, BASE_PATH } = require('../../config/paths');
const configValues = require('../../config/app'); // Import centralized config
const { createMirror, MIRRORED_BRAIN_PATH } = require('../mirror/mirror');

// Processing queue to prevent race conditions
let queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) {
    return;
  }

  isProcessing = true;

  while (queue.length > 0) {
    const filePath = queue.shift();
    await handleFileChangeInternal(filePath);
  }

  isProcessing = false;
}

function addToQueue(filePath) {
  // Path safety: Check for directory traversal
  const normalizedPath = path.normalize(filePath);
  const relativePath = path.relative(CONTEXT_DIR, normalizedPath);

  // If relative path starts with '..' it means the normalized path is outside CONTEXT_DIR
  if (relativePath.startsWith('..')) {
    console.error(`Security: Attempted directory traversal detected with path: ${filePath}`);
    return;
  }

  queue.push(filePath);
  processQueue();
}

async function handleFileChangeInternal(filePath) {
  // Skip backup files
  if (filePath.includes('cozo_memory_snapshot_')) return;

  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) return;

    if (stats.size > 100 * 1024 * 1024) { // Skip files > 100MB
      console.log(`Skipping large file: ${filePath} (${stats.size} bytes)`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.txt', '.md', '.json', '.yaml', '.yml', '.js', '.ts', '.py', '.html', '.css', '.bat', '.ps1', '.sh'];
    if (!textExtensions.includes(ext) && ext !== '') {
      return;
    }

    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(CONTEXT_DIR, filePath);

    // ═══════════════════════════════════════════════════════════════════════════
    // CORPUS FILE DETECTION: Check if this is a read_all.js output (combined_context.yaml)
    // Format: { project_structure: "...", files: [{path, content}, ...] }
    // ═══════════════════════════════════════════════════════════════════════════
    if ((ext === '.yaml' || ext === '.yml') && content.includes('project_structure:') && content.includes('files:')) {
      console.log(`📚 Detected corpus file: ${relPath} - extracting individual files...`);
      await ingestCorpusFile(filePath, content, relPath);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STANDARD FILE INGESTION
    // ═══════════════════════════════════════════════════════════════════════════
    const hash = crypto.createHash('md5').update(content).digest('hex');

    // Auto-Bucket Logic: Top-level folder name = Bucket (only if not in root)
    // For files in root context directory, assign to 'pending' bucket to allow dreamer to categorize properly
    const pathParts = relPath.split(path.sep);
    const buckets = pathParts.length > 1 ? [pathParts[0]] : ['pending'];

    // Deduplication Check (cozo-node returns { headers, rows }, not { ok, rows })
    const checkQuery = `?[id] := *memory{id, hash}, hash = $hash`;
    const check = await db.run(checkQuery, { hash: hash });

    if (check.rows && check.rows.length > 0) {
        return;
    }

    // Generate a unique ID based on the relative path and timestamp to prevent overwrites
    const id = `file_${Buffer.from(relPath).toString('base64').replace(/=/g, '')}_${Date.now()}`;

    // Using :put to add new record (no overwrite since ID is now unique)
    const query = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
    const params = {
      data: [[ id, Date.now(), content, relPath, ext || 'text', hash, buckets, '', '[]' ]]
    };

    await db.run(query, params);
    console.log(`Ingested: ${relPath}`);

    // Trigger mirror protocol to update file system representation
    try {
      await createMirror();
    } catch (mirrorError) {
      console.error('Mirror Protocol error after ingestion:', mirrorError.message);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

async function handleFileChange(filePath) {
  addToQueue(filePath);
}

/**
 * Sync changes from mirrored files back to the database
 */
async function syncMirrorFileToDb(filePath) {
  // Check if this is a mirrored brain file
  if (!filePath.startsWith(MIRRORED_BRAIN_PATH)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if it's a markdown file with frontmatter
    if (path.extname(filePath) === '.md' && content.startsWith('---')) {
      // Parse frontmatter
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatterStr = content.substring(3, frontmatterEnd).trim();
        const frontmatter = yaml.load(frontmatterStr);

        // Update the corresponding database entry
        const updateQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- [[$id, $timestamp, $content, $source, $type, $hash, $buckets, $tags, $epochs]] :replace memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;

        // Calculate new hash for the updated content
        const newHash = crypto.createHash('md5').update(content.substring(frontmatterEnd + 3).trim()).digest('hex');

        await db.run(updateQuery, {
          id: frontmatter.id,
          timestamp: frontmatter.timestamp,
          content: content.substring(frontmatterEnd + 3).trim(), // Content after frontmatter
          source: frontmatter.source,
          type: frontmatter.type,
          hash: newHash,
          buckets: frontmatter.buckets || [],
          tags: frontmatter.tags || [],
          epochs: JSON.stringify(frontmatter.epochs || [])
        });

        console.log(`Updated database entry from mirrored file: ${filePath}`);
      }
    } else {
      // For non-markdown files, we need to extract the ID from the file path
      // Format: MIRRORED_BRAIN_PATH/bucket/year/filename_with_id.ext
      const relativePath = path.relative(MIRRORED_BRAIN_PATH, filePath);
      const pathParts = relativePath.split(path.sep);
      if (pathParts.length >= 3) {
        const fileName = path.basename(filePath, path.extname(filePath)); // Get filename without extension

        // Find the corresponding database entry by ID (embedded in filename)
        const findQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] := *memory{id: mem_id, timestamp, content, source, type, hash, buckets, tags, epochs}, mem_id == $id`;
        const result = await db.run(findQuery, { id: fileName });

        if (result.rows.length > 0) {
          // Update the database entry with the new content
          const [id, timestamp, oldContent, source, type, oldHash, buckets, tags, epochs] = result.rows[0];

          const newContent = fs.readFileSync(filePath, 'utf8');
          const newHash = crypto.createHash('md5').update(newContent).digest('hex');

          const updateQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- [[$id, $timestamp, $content, $source, $type, $newHash, $buckets, $tags, $epochs]] :replace memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;

          await db.run(updateQuery, {
            id: id,
            timestamp: timestamp,
            content: newContent,
            source: source,
            type: type || path.extname(filePath).substring(1), // Use file extension as type
            newHash: newHash,
            buckets: buckets,
            tags: tags,
            epochs: epochs  // Use the existing epochs value
          });

          console.log(`Updated database entry from mirrored file: ${filePath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing mirrored file to database ${filePath}:`, error.message);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CORPUS FILE INGESTION
 * Handles read_all.js output format: { project_structure, files: [{path, content}, ...] }
 * Extracts each file as individual memory, with semantic deduplication
 * ═══════════════════════════════════════════════════════════════════════════════
 */
async function ingestCorpusFile(filePath, rawContent, relPath) {
  const MAX_CONTENT_SIZE = 500000; // 500KB limit per file (Standard 053)
  
  let corpus;
  try {
    corpus = yaml.load(rawContent);
  } catch (e) {
    console.error(`Failed to parse corpus file ${relPath}:`, e.message);
    return;
  }

  if (!corpus || !corpus.files || !Array.isArray(corpus.files)) {
    console.error(`Invalid corpus format in ${relPath}: missing files array`);
    return;
  }

  const projectName = corpus.project_structure 
    ? path.basename(corpus.project_structure) 
    : path.basename(relPath, path.extname(relPath));
  
  console.log(`📚 Corpus: "${projectName}" with ${corpus.files.length} files`);

  let ingested = 0, skipped = 0, updated = 0, rejected = 0;

  for (const file of corpus.files) {
    if (!file.path || !file.content) {
      skipped++;
      continue;
    }

    const content = file.content;
    const sourcePath = `${projectName}/${file.path}`;
    const ext = path.extname(file.path).toLowerCase() || '.txt';

    // Enforce size limit
    if (content.length > MAX_CONTENT_SIZE) {
      console.log(`  ⚠️ Skipping oversized: ${file.path} (${(content.length/1024).toFixed(1)}KB)`);
      rejected++;
      continue;
    }

    const hash = crypto.createHash('md5').update(content).digest('hex');

    // Check for exact duplicate by hash
    const hashCheck = await db.run(`?[id] := *memory{id, hash}, hash = $hash`, { hash });
    if (hashCheck.rows && hashCheck.rows.length > 0) {
      skipped++;
      continue;
    }

    // Check for semantic similarity by source path
    const sourceCheck = await db.run(
      `?[id, content, timestamp] := *memory{id, content, timestamp, source}, source = $source :limit 1 :order -timestamp`,
      { source: sourcePath }
    );

    if (sourceCheck.rows && sourceCheck.rows.length > 0) {
      const [existingId, existingContent, existingTimestamp] = sourceCheck.rows[0];
      
      // Calculate Jaccard similarity
      const set1 = new Set((existingContent || '').toLowerCase().match(/\w+/g) || []);
      const set2 = new Set(content.toLowerCase().match(/\w+/g) || []);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0.8) {
        // 80%+ similar - skip (already have essentially the same content)
        skipped++;
        continue;
      } else if (similarity > 0.5) {
        // 50-80% similar - this is a meaningful update, create new version
        // The search will use temporal folding to show latest
        console.log(`  📝 New version: ${file.path} (${Math.round(similarity * 100)}% similar)`);
      }
    }

    // Create new memory entry
    const id = `corpus_${Buffer.from(sourcePath).toString('base64').replace(/[=/+]/g, '').substring(0, 40)}_${Date.now()}`;
    const buckets = [projectName.toLowerCase().replace(/[^a-z0-9]/g, '_'), 'codebase'];

    const query = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
    const params = {
      data: [[id, Date.now(), content, sourcePath, ext, hash, buckets, '[]', '[]']]
    };

    try {
      await db.run(query, params);
      ingested++;
    } catch (e) {
      console.error(`  ❌ Failed to ingest ${file.path}:`, e.message);
      rejected++;
    }
  }

  console.log(`📚 Corpus "${projectName}" complete: ${ingested} ingested, ${updated} updated, ${skipped} skipped, ${rejected} rejected`);

  // Trigger mirror protocol to update file system representation
  try {
    await createMirror();
  } catch (mirrorError) {
    console.error('Mirror Protocol error after corpus ingestion:', mirrorError.message);
  }
}

function setupFileWatcher() {
  // Ensure context directory exists
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  // Watch both the main context directory and the mirrored brain directory
  const watchPaths = [CONTEXT_DIR];

  // Add mirrored brain path if it exists
  if (fs.existsSync(MIRRORED_BRAIN_PATH)) {
    watchPaths.push(MIRRORED_BRAIN_PATH);
  }

  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      /cozo_memory_snapshot_.*\.yaml$/,
      /.*\.tmp$/, // ignore temporary files
      /.*\.swp$/,  // ignore swap files
      /mirrored_brain[\/\\]/, // ignore mirrored brain directory to prevent recursive loops
      ...configValues.WATCHER_IGNORE_PATTERNS // Add centralized ignore patterns
    ],
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', filePath => {
      // Check if this is a mirrored brain file
      if (filePath.startsWith(MIRRORED_BRAIN_PATH)) {
        // For mirrored files, we don't ingest them back to DB, just update if needed
        syncMirrorFileToDb(filePath);
      } else {
        handleFileChange(filePath);
      }
    })
    .on('change', filePath => {
      // Check if this is a mirrored brain file
      if (filePath.startsWith(MIRRORED_BRAIN_PATH)) {
        syncMirrorFileToDb(filePath);
      } else {
        handleFileChange(filePath);
      }
    })
    .on('unlink', async filePath => {
      // Handle file deletion - if it's a mirrored file, remove from DB
      if (filePath.startsWith(MIRRORED_BRAIN_PATH)) {
        try {
          // Extract ID from the filename
          const fileName = path.basename(filePath, path.extname(filePath));

          // Remove the corresponding database entry
          const deleteQuery = `?[id] <- [[$id]] :delete memory {id}`;
          await db.run(deleteQuery, { id: fileName });

          console.log(`Removed database entry for deleted mirrored file: ${filePath}`);
        } catch (error) {
          console.error(`Error removing database entry for deleted file ${filePath}:`, error.message);
        }
      }
    })
    .on('error', error => console.error('Watcher error:', error));

  console.log('File watcher initialized for context directory and mirrored brain');
}

module.exports = {
    setupFileWatcher
};
