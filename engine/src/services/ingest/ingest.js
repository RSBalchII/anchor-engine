const crypto = require('crypto');
const { db } = require('../../core/db');

// Maximum content size: 500KB (See Standard 053: CozoDB Pain Points)
// Oversized content poisons FTS search by matching every query
const MAX_CONTENT_SIZE = 500000;

// Calculate Jaccard similarity between two strings
function calculateJaccardSimilarity(str1, str2) {
  // Tokenize strings into sets of words
  const set1 = new Set(str1.toLowerCase().match(/\w+/g) || []);
  const set2 = new Set(str2.toLowerCase().match(/\w+/g) || []);

  // Find intersection
  const intersection = new Set([...set1].filter(x => set2.has(x)));

  // Find union
  const union = new Set([...set1, ...set2]);

  // Calculate Jaccard similarity coefficient
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Calculate difference between two strings
function calculateDifference(original, updated) {
  // Simple difference calculation - find what was added
  const originalWords = new Set(original.toLowerCase().match(/\w+/g) || []);
  const updatedWords = updated.toLowerCase().match(/\w+/g) || [];

  const addedWords = updatedWords.filter(word => !originalWords.has(word));

  // Return the added content as a summary
  return addedWords.join(' ').substring(0, 1000); // Limit to 1000 chars
}

async function ingestContent(content, filename, source, type = 'text', buckets = ['core'], tags = []) {
  if (!content) throw new Error('Content required');

  // Enforce max content size (Standard 053: CozoDB Pain Points)
  if (content.length > MAX_CONTENT_SIZE) {
    console.warn(`⚠️ Rejecting oversized content: ${filename || source} (${(content.length / 1024 / 1024).toFixed(2)} MB > 500KB limit)`);
    return {
      status: 'rejected',
      reason: 'oversized',
      message: `Content exceeds 500KB limit (${(content.length / 1024 / 1024).toFixed(2)} MB). Large files poison FTS search.`
    };
  }

  const hash = crypto.createHash('md5').update(content).digest('hex');

  // Step A: Check if SHA-256 hash exists
  const hashCheckQuery = `?[id, content] := *memory{id, content, hash}, hash = $hash`;
  let hashCheckResult;
  try {
    hashCheckResult = await db.run(hashCheckQuery, { hash });
  } catch (error) {
    throw new Error(`Database hash check failed: ${error.message}`);
  }

  // cozo-node returns { headers: [...], rows: [...] } - check rows directly
  if (hashCheckResult.rows && hashCheckResult.rows.length > 0) {
      return {
          status: 'skipped',
          id: hashCheckResult.rows[0][0],
          message: 'Exact content already exists. Skipped.'
      };
  }

  // Step B: If Hash differs but Filename exists, calculate Jaccard Similarity
  if (filename) {
    const filenameCheckQuery = `?[id, content, hash] := *memory{id, content, hash, source}, source = $source`;
    let filenameCheckResult;
    try {
      filenameCheckResult = await db.run(filenameCheckQuery, { source: filename });
    } catch (error) {
      throw new Error(`Database filename check failed: ${error.message}`);
    }

    if (filenameCheckResult.rows && filenameCheckResult.rows.length > 0) {
      // Get the most recent content with this filename
      const existingRow = filenameCheckResult.rows[0];
      const existingId = existingRow[0];
      const existingContent = existingRow[1];
      const existingHash = existingRow[2];

      // Step C: Calculate Jaccard Similarity
      const similarity = calculateJaccardSimilarity(content, existingContent);

      if (similarity > 0.8) { // 80% similarity threshold
        // Step C: Append to existing memory
        const delta = calculateDifference(existingContent, content);

        if (delta.trim() !== '') {
          // Update the existing content by appending the delta
          const updatedContent = `${existingContent}\n\n---\n[Update: ${new Date().toISOString()}]\n${delta}`;
          const updatedHash = crypto.createHash('md5').update(updatedContent).digest('hex');

          // Fetch existing record details
          const fetchQuery = `?[timestamp, source, type, buckets, tags] := *memory{id: mem_id, timestamp, source, type, buckets, tags}, mem_id == $id`;
          const fetchResult = await db.run(fetchQuery, { id: existingId });

          if (fetchResult.rows.length > 0) {
            const [timestamp, existingSource, existingType, existingBuckets, existingTags] = fetchResult.rows[0];

            // Update the existing record with new content
            const deleteQuery = `?[id] <- [[$id]] :delete memory {id}`;
            await db.run(deleteQuery, { id: existingId });

            // Re-insert with updated content
            const updatedTags = JSON.stringify(tags); // Use new tags if provided, otherwise keep existing
            const epochsJson = JSON.stringify([]); // Default empty epochs array

            const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
            const params = {
              data: [[ existingId, timestamp, updatedContent, existingSource, existingType, updatedHash, existingBuckets, updatedTags, epochsJson ]]
            };

            await db.run(insertQuery, params);

            return {
              status: 'updated',
              id: existingId,
              message: `Content updated with ${Math.round(similarity * 100)}% similarity to existing content. Delta appended.`
            };
          }
        }
      }
    }
  }

  // Step D: If similarity is <80% or no existing filename found, create new memory entry
  const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const timestamp = Date.now();

  // Convert tags array to JSON string for storage
  const tagsJson = JSON.stringify(tags);
  const epochsJson = JSON.stringify([]); // Default empty epochs array

  const query = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :insert memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
  const params = {
    data: [[ id, timestamp, content, source || filename || 'unknown', type, hash, buckets, tagsJson, epochsJson ]]
  };

  try {
    await db.run(query, params);
  } catch (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  return { status: 'success', id, message: 'Ingested.' };
}

module.exports = {
    ingestContent
};
