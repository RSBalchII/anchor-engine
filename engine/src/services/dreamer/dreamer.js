/**
 * Dreamer Service - Markovian Memory Organization
 *
 * Implements Markovian reasoning for background memory organization.
 * Now features Deterministic Temporal Tagging to ground memories in time.
 * Updated to identify Epochs, Episodes, and Entities as part of the "Historian" transformation.
 */

const { db } = require('../../core/db');
const inference = require('../inference/inference');

/**
 * AsyncLock - Simple async-safe mutex for preventing concurrent execution
 * More robust than a simple boolean flag for async operations
 */
class AsyncLock {
    constructor() {
        this._locked = false;
        this._waiting = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (!this._locked) {
                this._locked = true;
                resolve();
            } else {
                this._waiting.push(resolve);
            }
        });
    }

    release() {
        if (this._waiting.length > 0) {
            const next = this._waiting.shift();
            next();
        } else {
            this._locked = false;
        }
    }

    get isLocked() {
        return this._locked;
    }
}

// Concurrency lock to prevent multiple dream cycles from running simultaneously
const dreamLock = new AsyncLock();

// Temporal helpers
const SEASONS = {
    0: 'Winter', 1: 'Winter', 2: 'Spring',
    3: 'Spring', 4: 'Spring', 5: 'Summer',
    6: 'Summer', 7: 'Summer', 8: 'Autumn',
    9: 'Autumn', 10: 'Autumn', 11: 'Winter'
};

const QUARTERS = {
    0: 'Q1', 1: 'Q1', 2: 'Q1',
    3: 'Q2', 4: 'Q2', 5: 'Q2',
    6: 'Q3', 7: 'Q3', 8: 'Q3',
    9: 'Q4', 10: 'Q4', 11: 'Q4'
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Generates deterministic tags based on the timestamp.
 * This grounds every memory in a deep temporal space.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string[]} - Array of temporal tags
 */
function generateTemporalTags(timestamp) {
    if (!timestamp) return [];

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return [];

    const tags = new Set();
    const monthIndex = date.getMonth();

    // 1. Core Date Units
    tags.add(date.getFullYear().toString());      // "2026"
    tags.add(MONTHS[monthIndex]);                 // "January"
    tags.add(DAYS[date.getDay()]);                // "Wednesday"

    // 2. Broad Temporal Buckets (for fuzzy search)
    tags.add(SEASONS[monthIndex]);                // "Winter"
    tags.add(QUARTERS[monthIndex]);               // "Q1"

    // 3. Time of Day (Optional granularity)
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) tags.add('Morning');
    else if (hour >= 12 && hour < 17) tags.add('Afternoon');
    else if (hour >= 17 && hour < 21) tags.add('Evening');
    else tags.add('Night');

    return Array.from(tags);
}

/**
 * Performs background memory organization using Markovian reasoning.
 * Processes memories in batches to handle large context files without OOM errors.
 * Updated to identify Epochs, Episodes, and Entities as part of the "Historian" transformation.
 *
 * @returns {Object} - Status object with analysis and update counts
 */
async function dream() {
    // Check if a dream cycle is already running using async-safe lock
    if (dreamLock.isLocked) {
        console.log('🌙 Dreamer: Skipping cycle - previous cycle still running.');
        return {
            status: 'skipped',
            reason: 'Previous cycle still running'
        };
    }

    // Acquire the lock to prevent concurrent execution
    await dreamLock.acquire();

    try {
        console.log('🌙 Dreamer: Starting self-organization cycle...');

        // 1. Get all unique tags currently in DB
        const tagsQuery = '?[buckets] := *memory{buckets}';
        const tagsResult = await db.run(tagsQuery);
        const allTags = [...new Set(tagsResult.rows.flatMap(r => Array.isArray(r[0]) ? r[0] : []))];

        // 2. Find memories that might benefit from re-categorization
        // We now also look for memories that lack temporal tags (e.g., missing a 4-digit year)
        const untaggedQuery = '?[id, content, buckets, timestamp] := *memory{id, content, buckets, timestamp}';
        const allMemories = await db.run(untaggedQuery);

        const memoriesToAnalyze = allMemories.rows.filter(row => {
            const [id, content, buckets, timestamp] = row;

            // Always include memories with no buckets
            if (!buckets || buckets.length === 0) return true;

            // Include memories that only have 'core' or 'pending'
            if (buckets.length === 1 && (buckets[0] === 'core' || buckets[0] === 'pending')) return true;

            // CRITICAL: Check for missing temporal tags
            // If the memory has a timestamp but no Year tag (e.g. "2024"), it needs temporal grounding
            if (timestamp) {
                const year = new Date(timestamp).getFullYear().toString();
                if (!buckets.includes(year)) return true;
            }

            // Include memories with generic buckets
            const genericBuckets = ['core', 'misc', 'general', 'other', 'unknown'];
            const hasOnlyGenericBuckets = buckets.every(bucket => genericBuckets.includes(bucket));
            if (hasOnlyGenericBuckets) return true;

            return false;
        });

        console.log(`🌙 Dreamer: Found ${memoriesToAnalyze.length} memories to analyze.`);

        let updatedCount = 0;

        // Process in batches
        const batchSize = 10;
        for (let i = 0; i < memoriesToAnalyze.length; i += batchSize) {
            const batch = memoriesToAnalyze.slice(i, i + batchSize);

            for (const row of batch) {
                const [id, content, currentBuckets, timestamp] = row;
                try {
                    // A. Generate Semantic Tags (via LLM)
                    // We only call the LLM if we really need semantic understanding
                    // For pure temporal updates, we might skip this to save compute,
                    // but for now we'll do both to ensure maximum richness.
                    let newSemanticTags = [];

                    // Only ask LLM if we don't have rich tags yet
                    const meaningful = (currentBuckets || []).filter(b =>
                        !['core','pending'].includes(b) && !b.match(/^\d{4}$/) // Exclude years
                    );

                    if (meaningful.length < 2) {
                        newSemanticTags = await inference.generateTags(content, allTags);
                    }

                    // B. Generate Deterministic Temporal Tags
                    const temporalTags = generateTemporalTags(timestamp);

                    // C. Merge Tags
                    if ((Array.isArray(newSemanticTags) && newSemanticTags.length > 0) || temporalTags.length > 0) {

                        // Use original ID - CozoDB handles string escaping via parameters
                        const safeId = id.toString();

                        // Get current record details including epochs
                        // Using proper CozoDB syntax with parameter binding
                        const currentQuery = `?[timestamp, content, source, type, hash, buckets, tags, epochs] := *memory{id: $id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
                        const currentResult = await db.run(currentQuery, { id: safeId });

                        if (currentResult.rows.length > 0) {
                            const [dbTs, currentContent, currentSource, currentType, currentHash, currentBuckets, currentTags, currentEpochs] = currentResult.rows[0];

                            // Combine: Old + Semantic + Temporal
                            let combinedBuckets = [
                                ...new Set([
                                    ...(currentBuckets || []),
                                    ...newSemanticTags,
                                    ...temporalTags
                                ])
                            ];

                            // Cleanup: Remove 'pending' if we have other tags
                            if (combinedBuckets.length > 1) {
                                combinedBuckets = combinedBuckets.filter(b => b !== 'pending');
                            }
                            // Cleanup: Remove 'core' if we have specific tags (semantic or temporal)
                            // We keep core only if we have < 2 OTHER meaningful tags.
                            const hasRichTags = combinedBuckets.some(b => !['core', 'pending'].includes(b));
                            if (hasRichTags) {
                                combinedBuckets = combinedBuckets.filter(b => b !== 'core');
                            } else if (combinedBuckets.length === 0) {
                                combinedBuckets = ['core'];
                            }

                            // D. Database Transaction
                            // Delete old - use correct CozoDB syntax
                            const deleteQuery = `?[id] <- [[$id]] :delete memory {id}`;
                            await db.run(deleteQuery, { id: safeId });

                            // Insert new with epochs field
                            const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
                            await db.run(insertQuery, {
                                data: [[
                                    safeId,
                                    dbTs,
                                    currentContent,
                                    currentSource,
                                    currentType,
                                    currentHash,
                                    combinedBuckets,
                                    '',
                                    currentEpochs || '[]'  // Preserve existing epochs or use empty array
                                ]]
                            });

                            updatedCount++;

                            // Update local cache of tags
                            newSemanticTags.forEach(t => {
                                if (typeof t === 'string' && !allTags.includes(t)) allTags.push(t);
                            });
                        } else {
                            console.log(`🌙 Dreamer: Record with id ${safeId} not found, skipping.`);
                        }
                    }
                } catch (innerError) {
                    console.error(`🌙 Dreamer: Failed to process memory ${id}:`, innerError.message || innerError);
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // NEW: The Epochal Historian - Identify and synthesize Epochs, Episodes, and Entities
        await identifyHistoricalPatterns();

        // NEW: The Mirror Protocol - Create physical copy of AI Brain
        try {
            const mirror = require('../mirror/mirror');
            await mirror.createMirror();
        } catch (mirrorError) {
            console.error('🌙 Dreamer: Mirror Protocol failed:', mirrorError.message);
        }

        return {
            status: 'success',
            analyzed: memoriesToAnalyze.length,
            updated: updatedCount,
            total_tags: allTags.length
        };
    } catch (error) {
        console.error('🌙 Dreamer Fatal Error:', error.stack || error.message || error);
        throw error;
    } finally {
        dreamLock.release();
    }
}

/**
 * The Epochal Historian: Identify and synthesize Epochs, Episodes, and Entities
 * This function analyzes memories to identify:
 * - Epochs: High-level project arcs (e.g., "The Sovereign Migration")
 * - Episodes: Specific session events (e.g., "The Similarity Logic Fix")
 * - Entities: People (Rob, Dory), Places, and Key Decisions
 */
async function identifyHistoricalPatterns() {
    try {
        console.log('🌙 Dreamer: Running Epochal Historian analysis...');

        // Get recent memories for analysis
        // CozoDB syntax: :order and :limit use proper ORDER BY ... LIMIT syntax
        const recentMemoriesQuery = `?[id, content, buckets, timestamp, epochs] := *memory{id, content, buckets, timestamp, epochs} :limit 50 :order -timestamp`;
        const recentMemoriesResult = await db.run(recentMemoriesQuery);

        if (recentMemoriesResult.rows.length === 0) {
            console.log('🌙 Dreamer: No memories to analyze for historical patterns.');
            return;
        }

        // Prepare content for LLM analysis
        const memoriesForAnalysis = recentMemoriesResult.rows.map(row => ({
            id: row[0],
            content: row[1].substring(0, 1000), // Limit content to prevent token overflow
            buckets: row[2],
            timestamp: row[3],
            epochs: row[4]  // Include epochs in the analysis
        }));

        // Create a prompt for the LLM to identify Epochs, Episodes, and Entities
        const analysisPrompt = `
Analyze the following memories and identify:

1. EPOCHS: High-level project arcs or major themes (e.g., "The Sovereign Migration", "The Context Assembly Project")
2. EPISODES: Specific session events or focused work periods (e.g., "The Similarity Logic Fix", "The Schema Migration")
3. ENTITIES: People (names), Places, Organizations, and Key Decisions

Memories to analyze:
${memoriesForAnalysis.map((mem, idx) =>
    `[Memory ${idx+1}] ID: ${mem.id}\nTimestamp: ${new Date(mem.timestamp).toISOString()}\nBuckets: ${mem.buckets.join(', ')}\nContent: ${mem.content}\n---\n`).join('')}

Format your response as JSON with these keys:
- "epochs": array of epoch names
- "episodes": array of episode names
- "entities": array of entity names (people, places, decisions)
- "connections": array of objects with "epoch", "episode", "entity" connections`;

        // Use the inference service to analyze the memories
        const analysisResult = await inference.rawCompletion(analysisPrompt, { maxTokens: 500, temperature: 0.3 });

        try {
            // Try to parse the LLM response as JSON
            const parsedAnalysis = JSON.parse(analysisResult);

            // Save the synthesized summaries to a new #history bucket
            if (parsedAnalysis.epochs || parsedAnalysis.episodes || parsedAnalysis.entities) {
                const summaryContent = `Historical Analysis Summary:
Epochs: ${parsedAnalysis.epochs ? parsedAnalysis.epochs.join(', ') : 'None identified'}
Episodes: ${parsedAnalysis.episodes ? parsedAnalysis.episodes.join(', ') : 'None identified'}
Entities: ${parsedAnalysis.entities ? parsedAnalysis.entities.join(', ') : 'None identified'}

Connections: ${JSON.stringify(parsedAnalysis.connections || [], null, 2)}

Raw Analysis: ${analysisResult.substring(0, 2000)}`;

                const id = `historian_summary_${Date.now()}`;
                const timestamp = Date.now();
                const hash = require('crypto').createHash('md5').update(summaryContent).digest('hex');

                // Convert tags array to JSON string for storage
                const tagsJson = JSON.stringify(['historian', 'summary', 'epoch', 'episode', 'entity']);

                const insertQuery = `?[id, timestamp, content, source, type, hash, buckets, tags, epochs] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags, epochs}`;
                const params = {
                    data: [[id, timestamp, summaryContent, 'Epochal Historian', 'summary', hash, ['history'], tagsJson, '[]']]
                };

                await db.run(insertQuery, params);

                console.log(`🌙 Dreamer: Historical patterns identified and saved. Epochs: ${parsedAnalysis.epochs?.length || 0}, Episodes: ${parsedAnalysis.episodes?.length || 0}, Entities: ${parsedAnalysis.entities?.length || 0}`);
            }
        } catch (parseError) {
            console.error('🌙 Dreamer: Failed to parse LLM analysis result as JSON:', parseError.message);
            console.log('Raw analysis result:', analysisResult);
        }
    } catch (error) {
        console.error('🌙 Dreamer: Error in Epochal Historian analysis:', error.message);
    }
}

module.exports = { dream, isDreaming: () => dreamLock.isLocked };
