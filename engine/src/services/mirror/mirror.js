/**
 * Mirror Protocol Service
 *
 * Creates a human-readable physical copy of the "AI Brain" by exporting
 * the entire CozoDB memory relation to files in the context/mirrored_brain directory.
 *
 * On every Dreamer cycle completion, exports the entire CozoDB memory relation.
 * Writes to: context/mirrored_brain/[Bucket]/[Year]/[Memory_ID].[ext]
 * File format: Frontmatter (Tags/Timestamp) + Content.
 *
 * Supports bidirectional synchronization: changes to mirrored files are
 * automatically synced back to the database via the file watcher.
 */

const fs = require('fs');
const path = require('path');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);
const { db } = require('../../core/db');
const { BASE_PATH } = require('../../config/paths');
const configValues = require('../../config/app'); // Import centralized config

// Path to the mirrored brain directory
const MIRRORED_BRAIN_PATH = path.join(BASE_PATH, 'context', 'mirrored_brain');

/**
 * Streaming transform to process memories and write to disk
 */
class MemoryToMirrorTransform extends Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    this.options = options;
    this.filesProcessed = 0;
  }

  _transform(memoryRow, encoding, callback) {
    try {
      const [id, timestamp, content, source, type, hash, buckets, tags] = memoryRow;

      // Parse tags from JSON string if they exist
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
          if (!Array.isArray(parsedTags)) {
            parsedTags = [];
          }
        } catch (e) {
          console.warn(`🪞 Mirror Protocol: Failed to parse tags for memory ${id}:`, e.message);
        }
      }

      // Use the first bucket as the primary directory, or 'unsorted' if no buckets
      const primaryBucket = (Array.isArray(buckets) && buckets.length > 0) ? buckets[0] : 'unsorted';

      // Sanitize bucket name for filesystem
      const sanitizedBucket = primaryBucket.replace(/[^a-zA-Z0-9-_]/g, '_');

      // Create bucket directory if it doesn't exist
      const bucketPath = path.join(MIRRORED_BRAIN_PATH, sanitizedBucket);
      if (!fs.existsSync(bucketPath)) {
        fs.mkdirSync(bucketPath, { recursive: true });
      }

      // Create a subdirectory based on year from timestamp (for Epoch organization)
      const year = new Date(timestamp).getFullYear();
      const yearPath = path.join(bucketPath, year.toString());
      if (!fs.existsSync(yearPath)) {
        fs.mkdirSync(yearPath, { recursive: true });
      }

      // Determine file extension based on content type
      let fileExtension = '.md'; // default to markdown
      if (type) {
          switch(type.toLowerCase()) {
              case 'json':
                  fileExtension = '.json';
                  break;
              case 'text':
              case 'txt':
                  fileExtension = '.txt';
                  break;
              case 'markdown':
              case 'md':
                  fileExtension = '.md';
                  break;
              case 'javascript':
              case 'js':
                  fileExtension = '.js';
                  break;
              case 'typescript':
              case 'ts':
                  fileExtension = '.ts';
                  break;
              case 'python':
              case 'py':
                  fileExtension = '.py';
                  break;
              case 'html':
                  fileExtension = '.html';
                  break;
              case 'css':
                  fileExtension = '.css';
                  break;
              default:
                  fileExtension = '.md'; // default to markdown
          }
      }

      // Create the file path with appropriate extension
      const sanitizedId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `${sanitizedId}${fileExtension}`;
      const filePath = path.join(yearPath, fileName);

      // Create frontmatter with metadata
      const frontmatter = [
        '---',
        `id: ${id}`,
        `timestamp: ${timestamp}`,
        `date: ${new Date(timestamp).toISOString()}`,
        `source: ${source || 'unknown'}`,
        `type: ${type || 'text'}`,
        `hash: ${hash || 'unknown'}`,
        `buckets: ${Array.isArray(buckets) ? JSON.stringify(buckets) : '[]'}`,
        `tags: ${JSON.stringify(parsedTags)}`,
        '---'
      ].join('\n');

      // Combine frontmatter and content
      // Ensure content ends with a newline for better readability
      const fileContent = `${frontmatter}\n\n${content || ''}\n`;

      // Write the file
      fs.writeFileSync(filePath, fileContent, 'utf8');

      this.filesProcessed++;
      callback(null, { id, filePath }); // Pass along the processed memory info
    } catch (error) {
      callback(error);
    }
  }
}

/**
 * Export the entire CozoDB memory relation to physical markdown files using streaming
 * This is called at the end of each Dreamer cycle
 */
async function mirrorToDisk() {
  try {
    console.log('🪞 Mirror Protocol: Starting brain mirroring process...');

    // Clean up the mirrored brain directory first to ensure it reflects current DB state
    if (fs.existsSync(MIRRORED_BRAIN_PATH)) {
      fs.rmSync(MIRRORED_BRAIN_PATH, { recursive: true, force: true });
    }

    // Ensure the mirrored brain directory exists
    fs.mkdirSync(MIRRORED_BRAIN_PATH, { recursive: true });

    // Query all memories from the database
    const query = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] := *memory{id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
    const result = await db.run(query);

    // cozo-node returns { headers: [...], rows: [...] } on success
    // Check if we have rows (not result.ok - that's not in cozo-node API)
    if (!result.rows || result.rows.length === 0) {
      console.log('🪞 Mirror Protocol: No memories to mirror.');
      return { status: 'success', message: 'No memories to mirror' };
    }

    console.log(`🪞 Mirror Protocol: Mirroring ${result.rows.length} memories to disk...`);

    // Process memories in batches to prevent memory issues with large datasets
    const batchSize = configValues.MIRROR_BATCH_SIZE;
    let filesProcessed = 0;

    // Process memories in batches
    for (let i = 0; i < result.rows.length; i += batchSize) {
      const batch = result.rows.slice(i, i + batchSize);

      // Process each memory in the batch
      for (const row of batch) {
        try {
          const [id, timestamp, content, source, type, hash, buckets, tags, epochs] = row;

          // Parse tags from JSON string if they exist
          let parsedTags = [];
          if (tags) {
            try {
              parsedTags = JSON.parse(tags);
              if (!Array.isArray(parsedTags)) {
                parsedTags = [];
              }
            } catch (e) {
              console.warn(`🪞 Mirror Protocol: Failed to parse tags for memory ${id}:`, e.message);
            }
          }

          // Parse epochs from JSON string if they exist
          let parsedEpochs = [];
          if (epochs) {
            try {
              parsedEpochs = JSON.parse(epochs);
              if (!Array.isArray(parsedEpochs)) {
                parsedEpochs = [];
              }
            } catch (e) {
              console.warn(`🪞 Mirror Protocol: Failed to parse epochs for memory ${id}:`, e.message);
            }
          }

          // Use the first bucket as the primary directory, or 'unsorted' if no buckets
          const primaryBucket = (Array.isArray(buckets) && buckets.length > 0) ? buckets[0] : 'unsorted';

          // Sanitize bucket name for filesystem
          const sanitizedBucket = primaryBucket.replace(/[^a-zA-Z0-9-_]/g, '_');

          // Create bucket directory if it doesn't exist
          const bucketPath = path.join(MIRRORED_BRAIN_PATH, sanitizedBucket);
          if (!fs.existsSync(bucketPath)) {
            fs.mkdirSync(bucketPath, { recursive: true });
          }

          // Prioritize Epochs for directory structure, fallback to Year if no Epochs
          let targetPath;
          if (parsedEpochs.length > 0) {
            // Use the first epoch as the directory name
            const epochName = parsedEpochs[0].replace(/[^a-zA-Z0-9-_]/g, '_');

            // Check if the epoch contains episode information for further decomposition
            let epochSubPath = epochName;
            if (parsedEpochs.length > 1) {
              // If there are multiple epoch values, the second might be an episode
              const episodeName = parsedEpochs[1].replace(/[^a-zA-Z0-9-_]/g, '_');
              epochSubPath = path.join(epochName, 'Episodes', episodeName);
            }

            targetPath = path.join(bucketPath, 'Epochs', epochSubPath);
          } else {
            // Fallback to Year structure if no Epochs assigned by Dreamer
            const year = new Date(timestamp).getFullYear();
            targetPath = path.join(bucketPath, 'Years', year.toString());
          }

          // Create the target directory if it doesn't exist
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }

          // Determine file extension based on content type
          let fileExtension = '.md'; // default to markdown
          if (type) {
              switch(type.toLowerCase()) {
                  case 'json':
                      fileExtension = '.json';
                      break;
                  case 'text':
                  case 'txt':
                      fileExtension = '.txt';
                      break;
                  case 'markdown':
                  case 'md':
                      fileExtension = '.md';
                      break;
                  case 'javascript':
                  case 'js':
                      fileExtension = '.js';
                      break;
                  case 'typescript':
                  case 'ts':
                      fileExtension = '.ts';
                      break;
                  case 'python':
                  case 'py':
                      fileExtension = '.py';
                      break;
                  case 'html':
                      fileExtension = '.html';
                      break;
                  case 'css':
                      fileExtension = '.css';
                      break;
                  default:
                      fileExtension = '.md'; // default to markdown
              }
          }

          // Create the file path with appropriate extension
          const sanitizedId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
          const fileName = `${sanitizedId}${fileExtension}`;
          const filePath = path.join(targetPath, fileName);

          // Create frontmatter with metadata
          const frontmatter = [
            '---',
            `id: ${id}`,
            `timestamp: ${timestamp}`,
            `date: ${new Date(timestamp).toISOString()}`,
            `source: ${source || 'unknown'}`,
            `type: ${type || 'text'}`,
            `hash: ${hash || 'unknown'}`,
            `buckets: ${Array.isArray(buckets) ? JSON.stringify(buckets) : '[]'}`,
            `tags: ${JSON.stringify(parsedTags)}`,
            `epochs: ${JSON.stringify(parsedEpochs)}`,
            '---'
          ].join('\n');

          // Combine frontmatter and content
          // Ensure content ends with a newline for better readability
          const fileContent = `${frontmatter}\n\n${content || ''}\n`;

          // Write the file using streaming writer to prevent OOM errors on large datasets
          const writeStream = fs.createWriteStream(filePath, {
            encoding: 'utf8',
            highWaterMark: configValues.MIRROR_STREAM_BUFFER_SIZE
          });

          writeStream.write(fileContent);
          writeStream.end();

          // Wait for the stream to finish
          await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          filesProcessed++;
        } catch (fileError) {
          console.error(`🪞 Mirror Protocol: Failed to create mirror file for memory:`, fileError.message);
        }
      }
    }

    console.log(`🪞 Mirror Protocol: Successfully mirrored ${filesProcessed} memories to ${MIRRORED_BRAIN_PATH}`);
    return {
      status: 'success',
      message: `Mirrored ${filesProcessed} memories`,
      path: MIRRORED_BRAIN_PATH
    };

  } catch (error) {
    console.error('🪞 Mirror Protocol: Fatal error during mirroring:', error.message);
    throw error;
  }
}

/**
 * Legacy function kept for backward compatibility
 */
async function createMirror() {
  return mirrorToDisk();
}

module.exports = {
  mirrorToDisk,
  createMirror, // Kept for backward compatibility
  MIRRORED_BRAIN_PATH
};