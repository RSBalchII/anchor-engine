const { db } = require('../../core/db');

// Basic search function as fallback when FTS fails
async function basicSearch(query, max_chars = 5000, buckets, deep = false) {
  try {
    const useBuckets = Array.isArray(buckets) && buckets.length > 0;
    const searchQuery = `?[id, timestamp, content, source, type, buckets, tags] := *memory{id, timestamp, content, source, type, buckets, tags}`;

    const result = await db.run(searchQuery);

    let context = '';
    let charCount = 0;

    if (result.rows) {
      const filteredRows = result.rows.filter(row => {
        const [id, timestamp, content, source, type, b, tags] = row;

        // Filter by bucket in JS for now to avoid Cozo syntax issues
        const bucketMatch = !useBuckets || b.some(x => buckets.includes(x));
        if (!bucketMatch) return false;

        // Check if query matches content, source, or tags
        const contentMatch = content.toLowerCase().includes(query.toLowerCase());
        const sourceMatch = source.toLowerCase().includes(query.toLowerCase());
        let tagsMatch = false;
        try {
          const parsedTags = JSON.parse(tags || '[]');
          if (Array.isArray(parsedTags)) {
            tagsMatch = parsedTags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
          }
        } catch (e) {
          // If tags can't be parsed, continue without tags matching
        }

        return contentMatch || sourceMatch || tagsMatch;
      });

      // Group by source for temporal folding
      const docsBySource = {};
      for (const row of filteredRows) {
        const [id, timestamp, content, source, type, b, tags] = row;

        if (!docsBySource[source]) {
          docsBySource[source] = [];
        }
        docsBySource[source].push({
          id, timestamp, content, source, type, buckets: b, tags: tags
        });
      }

      // Sort each source by timestamp (most recent first)
      for (const source in docsBySource) {
        docsBySource[source].sort((a, b) => b.timestamp - a.timestamp);
      }

      // Sort sources by the timestamp of their most recent document
      const sortedSources = Object.entries(docsBySource)
        .sort((a, b) => b[1][0].timestamp - a[1][0].timestamp);

      for (const [source, sourceDocs] of sortedSources) {
        const headDoc = sourceDocs[0]; // Most recent
        const historyDocs = sourceDocs.slice(1); // Older versions

        // Create header for this source
        const header = `### Source: ${headDoc.source}\n`;
        if (charCount + header.length > max_chars) {
          context += "\n... [Context Truncated by Budget]";
          break;
        }
        context += header;
        charCount += header.length;

        // Add history section if there are older versions
        if (historyDocs.length > 0 && !deep) {
          context += "**History:**\n";
          for (const histDoc of historyDocs) {
            const histLine = `- ${new Date(histDoc.timestamp).toISOString()}\n`;
            if (charCount + histLine.length > max_chars) {
              context += "\n... [History Truncated by Budget]";
              break;
            }
            context += histLine;
            charCount += histLine.length;
          }
          context += "\n";
        }

        // Add content for the head document
        const entryText = `${headDoc.content}\n\n`;
        if (charCount + entryText.length > max_chars) {
          const remainingChars = max_chars - charCount;
          context += entryText.substring(0, remainingChars);
          context += "\n... [Context Truncated by Budget]";
          break;
        }
        context += entryText;
        charCount += entryText.length;
      }
    }

    return { context: context || 'No results found.' };
  } catch (error) {
    console.error('Basic search error:', error);
    return { context: 'Search failed' };
  }
}

async function executeSearch(query, bucket, buckets, max_chars = 5000, deep = false) {
  try {
    // 1. PARSE QUERY SYNTAX - Extract phrases, temporal tags, and bucket tags
    const parsedQuery = parseQuery(query);

    // Check if syntax is detected - if so, bypass SLM and use deterministic logic
    const hasSyntax = parsedQuery.phrases.length > 0 || parsedQuery.temporal.length > 0 || parsedQuery.buckets.length > 0;

    if (hasSyntax) {
      // Use syntax-based filtering
      return await executeSyntaxSearch(parsedQuery, bucket, buckets, max_chars, deep);
    } else {
      // ALWAYS use FTS search with BM25 scoring - fall back to basic only if FTS fails
      const targetBuckets = buckets || (bucket ? [bucket] : []);
      return await ftsSearch(query, max_chars, targetBuckets, deep);
    }
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

/**
 * FTS-based search with BM25 scoring - the primary search method
 * Falls back to basicSearch only if FTS fails
 */
async function ftsSearch(query, max_chars = 5000, buckets = [], deep = false) {
  try {
    // Sanitize query for CozoDB FTS
    const sanitizedQuery = query.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (!sanitizedQuery) {
      console.log('Empty query after sanitization, falling back to basicSearch');
      return await basicSearch(query, max_chars, buckets, deep);
    }

    const baseK = deep ? 200 : 50; // Get more results for scoring
    const k = Math.max(baseK, Math.ceil(max_chars / 500));

    // FTS query that returns results ordered by BM25 score
    const ftsQuery = `?[id, score] := ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s}, score = s`;
    
    let ftsResult;
    try {
      ftsResult = await db.run(ftsQuery, { q: sanitizedQuery });
    } catch (ftsError) {
      console.warn('FTS query failed, falling back to basicSearch:', ftsError.message);
      return await basicSearch(query, max_chars, buckets, deep);
    }

    if (!ftsResult.rows || ftsResult.rows.length === 0) {
      console.log('No FTS results, falling back to basicSearch');
      return await basicSearch(query, max_chars, buckets, deep);
    }

    // Sort by BM25 score (descending) - most relevant first
    const sortedResults = ftsResult.rows.sort((a, b) => b[1] - a[1]);
    
    // Extract just the IDs for the content lookup
    const ids = sortedResults.map(row => row[0]);
    
    // Build context from high-scoring results
    let context = '';
    let charCount = 0;
    const useBuckets = Array.isArray(buckets) && buckets.length > 0;

    for (let i = 0; i < ids.length && charCount < max_chars; i++) {
      const id = ids[i];
      const score = sortedResults[i][1];
      
      // Fetch full memory content
      const contentQuery = `?[id, timestamp, content, source, type, buckets, tags] := *memory{id, timestamp, content, source, type, buckets, tags}, id = $id`;
      const contentResult = await db.run(contentQuery, { id });
      
      if (!contentResult.rows || contentResult.rows.length === 0) continue;
      
      const [, timestamp, content, source, type, memBuckets, tags] = contentResult.rows[0];
      
      // Filter by bucket if specified
      if (useBuckets && !memBuckets.some(b => buckets.includes(b))) {
        continue;
      }
      
      // Build entry with relevance score
      const header = `### [Score: ${score.toFixed(1)}] ${source}\n`;
      const entryText = `${content}\n\n`;
      
      if (charCount + header.length + entryText.length > max_chars) {
        const remainingChars = max_chars - charCount - header.length;
        if (remainingChars > 100) {
          context += header;
          context += entryText.substring(0, remainingChars);
          context += "\n... [Context Truncated by Budget]";
        }
        break;
      }
      
      context += header;
      context += entryText;
      charCount += header.length + entryText.length;
    }

    if (!context) {
      return { context: 'No matching results found.' };
    }

    return { context };
  } catch (error) {
    console.error('FTS search error:', error);
    return await basicSearch(query, max_chars, buckets, deep);
  }
}

/**
 * Execute search based on parsed syntax (phrases, temporal tags, buckets)
 */
async function executeSyntaxSearch(parsedQuery, bucket, buckets, max_chars = 5000, deep = false) {
  // Combine parsed elements with existing bucket parameters
  const parsedBuckets = parsedQuery.buckets.map(b => b.toLowerCase()); // Normalize to lowercase
  const targetBuckets = buckets || (bucket ? [bucket] : []);
  const combinedBuckets = [...new Set([...targetBuckets, ...parsedBuckets])]; // Combine and deduplicate

  // Combine parsed temporal tags with existing temporal extraction
  const parsedTemporal = parsedQuery.temporal.map(t => t.toLowerCase()); // Normalize to lowercase
  const extractedTemporal = extractTemporalBucketsFromQuery(parsedQuery.keywords.join(' '));
  const allTemporal = [...new Set([...extractedTemporal, ...parsedTemporal])]; // Combine and deduplicate

  // Combine all target buckets
  const expandedTargetBuckets = [...new Set([...combinedBuckets, ...allTemporal])];

  // 2. DIRECT SEARCH (The "What") - 70% of budget
  const directBudget = Math.floor(max_chars * 0.7);
  const useBuckets = Array.isArray(expandedTargetBuckets) && expandedTargetBuckets.length > 0;
  const useTemporal = parsedTemporal.length > 0;

  const baseK = deep ? 200 : 30;
  const k = Math.max(baseK, Math.ceil(directBudget / 500));

  // Build search query from parsed elements
  // Use quoted phrases first, then keywords
  let searchTerms = [...parsedQuery.phrases, ...parsedQuery.keywords];
  let sanitizedQuery = searchTerms.join(' ').trim();

  // Sanitize query for CozoDB FTS: remove characters that might break the parser
  // Keeping alphanumeric, spaces, and basic punctuation that doesn't act as operators
  sanitizedQuery = sanitizedQuery.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!sanitizedQuery) {
      return await basicSearch(sanitizedQuery, max_chars, expandedTargetBuckets, deep);
  }

  // Build the CozoDB query with temporal and bucket filtering
  let ftsQuery;
  let ftsParams = { q: sanitizedQuery };

  if (useTemporal && useBuckets) {
    // Both temporal and bucket filtering
    ftsQuery = `?[id, score, timestamp, buckets] :=
      ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s},
      score = s,
      *memory{id, timestamp, buckets},
      is_in(id, $ids)`;
  } else if (useTemporal) {
    // Only temporal filtering
    ftsQuery = `?[id, score, timestamp] :=
      ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s},
      score = s,
      *memory{id, timestamp},
      is_in(id, $ids)`;
  } else if (useBuckets) {
    // Only bucket filtering
    ftsQuery = `?[id, score, buckets] :=
      ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s},
      score = s,
      *memory{id, buckets},
      is_in(id, $ids)`;
  } else {
    // No additional filtering, just FTS
    ftsQuery = `?[id, score] := ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s}, score = s`;
  }

  let ftsResult;

  try {
      ftsResult = await db.run(ftsQuery, ftsParams);
  } catch (e) {
      console.error('FTS Error, falling back to basic:', e.message);
      return await basicSearch(sanitizedQuery, max_chars, expandedTargetBuckets, deep);
  }

  if (ftsResult.rows.length === 0) {
      return await basicSearch(sanitizedQuery, max_chars, expandedTargetBuckets, deep);
  }

  // Apply temporal filtering if needed
  let filteredRows = ftsResult.rows;
  if (useTemporal) {
    filteredRows = filteredRows.filter(row => {
      const [id, score, timestamp, buckets] = row;
      // Check if the timestamp matches the requested temporal criteria
      if (parsedTemporal.length > 0) {
        const date = new Date(timestamp);
        for (const temporal of parsedTemporal) {
          // Check year
          if (/^\d{4}$/.test(temporal) && date.getFullYear().toString() === temporal) {
            return true;
          }
          // Check month
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                             'july', 'august', 'september', 'october', 'november', 'december'];
          if (monthNames.includes(temporal.toLowerCase()) &&
              monthNames[date.getMonth()].toLowerCase() === temporal.toLowerCase()) {
            return true;
          }
          // Add more temporal checks as needed
        }
        return false; // If none of the temporal criteria match, exclude this row
      }
      return true;
    });
  }

  // Apply bucket filtering if needed
  if (useBuckets) {
    filteredRows = filteredRows.filter(row => {
      const [id, score, timestamp, buckets] = row;
      // If buckets exist in the row, check if any match our target buckets
      if (buckets && Array.isArray(buckets)) {
        return buckets.some(x => expandedTargetBuckets.includes(x));
      }
      // If no buckets in the row but we're filtering, exclude it
      return expandedTargetBuckets.length === 0; // Only include if we're not filtering by buckets
    });
  }

  if (filteredRows.length === 0) {
    return { context: 'No results found matching all criteria.' };
  }

  const ids = filteredRows.map(row => row[0]);
  const scores = Object.fromEntries(filteredRows.map(row => [row[0], row[1]]));

  const contentQuery = `
    ?[id, content, source, buckets, timestamp, tags, epochs] :=
      *memory{id, content, source, buckets, timestamp, tags, epochs},
      is_in(id, $ids)
  `;

  const contentResult = await db.run(contentQuery, { ids });

  let allHits = [];

  // Create a combined search regex that looks for phrases and keywords
  const allSearchTerms = [...parsedQuery.phrases, ...parsedQuery.keywords];
  if (allSearchTerms.length > 0) {
      // Escape special regex characters in each term and join with OR
      const escapedTerms = allSearchTerms.map(term =>
          term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      const combinedPattern = escapedTerms.join('|');
      const searchRegex = new RegExp(combinedPattern, 'gi');

      for (const row of contentResult.rows) {
          const [id, content, source, b, timestamp, tags, epochs] = row;

          // Filter by bucket in JS - now using expanded target buckets
          const bucketMatch = !useBuckets || b.some(x => expandedTargetBuckets.includes(x));
          if (!bucketMatch) continue;

          // Filter by temporal in JS
          const temporalMatch = !useTemporal || parsedTemporal.some(temp => {
            const date = new Date(timestamp);
            // Check year
            if (/^\d{4}$/.test(temp) && date.getFullYear().toString() === temp) {
              return true;
            }
            // Check month
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                               'july', 'august', 'september', 'october', 'november', 'december'];
            if (monthNames.includes(temp.toLowerCase()) &&
                monthNames[date.getMonth()].toLowerCase() === temp.toLowerCase()) {
              return true;
            }
            return false;
          });

          if (!temporalMatch) continue;

          let match;
          searchRegex.lastIndex = 0;
          while ((match = searchRegex.exec(content)) !== null) {
              allHits.push({
                  id, source, content, timestamp, epochs,
                  start: match.index,
                  end: match.index + match[0].length,
                  score: scores[id]
              });
          }
      }
  }

  if (allHits.length === 0) {
      return await basicSearch(sanitizedQuery, max_chars, expandedTargetBuckets, deep);
  }

  const rawWindowSize = Math.floor(directBudget / allHits.length);
  const windowSize = Math.min(Math.max(rawWindowSize, 300), 1500);
  const padding = Math.floor(windowSize / 2);

  const docsMap = {};

  for (const hit of allHits) {
      if (!docsMap[hit.id]) {
          docsMap[hit.id] = {
              source: hit.source,
              score: hit.score,
              ranges: [],
              content: hit.content,
              buckets: hit.buckets, // Store buckets for tag harvesting
              timestamp: hit.timestamp, // Store timestamp for temporal folding
              tags: hit.tags // Store tags for semantic matching
          };
      }

      const start = Math.max(0, hit.start - padding);
      const end = Math.min(hit.content.length, hit.end + padding);
      docsMap[hit.id].ranges.push({ start, end });
  }

  let directContext = "";
  let directCharsUsed = 0;

  // Group docs by source for temporal folding
  const docsBySource = {};
  for (const doc of Object.values(docsMap)) {
      if (!docsBySource[doc.source]) {
          docsBySource[doc.source] = [];
      }
      docsBySource[doc.source].push(doc);
  }

  // Sort docs by source by score (highest first)
  for (const source in docsBySource) {
      docsBySource[source].sort((a, b) => b.score - a.score);
  }

  // Sort sources by highest score of their first (best) document
  const sortedSources = Object.entries(docsBySource)
      .sort((a, b) => b[1][0].score - a[1][0].score);

  for (const [source, sourceDocs] of sortedSources) {
      if (directCharsUsed >= directBudget) break;

      // Sort documents by timestamp (most recent first) for temporal folding
      sourceDocs.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp (most recent first)

      // Get the most recent document as the "head" (latest version)
      const headDoc = sourceDocs[0];

      // Prepare history info for "tail" (older versions)
      const historyInfo = sourceDocs.slice(1); // All except the first (head)

      // Process the head document (latest version) with full content
      headDoc.ranges.sort((a, b) => a.start - b.start);
      const merged = [];
      if (headDoc.ranges.length > 0) {
          let current = headDoc.ranges[0];
          for (let i = 1; i < headDoc.ranges.length; i++) {
              if (headDoc.ranges[i].start <= current.end + 50) {
                  current.end = Math.max(current.end, headDoc.ranges[i].end);
              } else {
                  merged.push(current);
                  current = headDoc.ranges[i];
              }
          }
          merged.push(current);
      }

      // Create header with source and score
      const header = `### Source: ${headDoc.source} (Score: ${Math.round(headDoc.score)})\n`;
      if (directCharsUsed + header.length > directBudget) {
          directContext += "\n... [Direct Context Truncated by Budget]";
          break;
      }
      directContext += header;
      directCharsUsed += header.length;

      // Add history section if there are older versions
      if (historyInfo.length > 0 && !deep) {
          directContext += "**History:**\n";
          for (const histDoc of historyInfo) {
              // For non-deep mode, just show timestamps and scores
              const histLine = `- ${new Date(histDoc.timestamp).toISOString()} (Score: ${Math.round(histDoc.score)})\n`;
              if (directCharsUsed + histLine.length > directBudget) {
                  directContext += "\n... [History Truncated by Budget]";
                  break;
              }
              directContext += histLine;
              directCharsUsed += histLine.length;
          }
          directContext += "\n";
      }

      // Add content snippets for the head document
      for (const range of merged) {
          const snippet = headDoc.content.substring(range.start, range.end).replace(/\n/g, ' ');
          const entry = `...${snippet}...\n\n`;

          if (directCharsUsed + entry.length > directBudget) {
              directContext += "\n... [Direct Context Truncated by Budget]";
              break;
          }
          directContext += entry;
          directCharsUsed += entry.length;
      }

      directContext += "---\n";
  }

  // 2. TAG HARVESTING - Extract unique tags from direct results
  const allBuckets = new Set();
  for (const doc of Object.values(docsMap)) {
      if (doc.buckets && Array.isArray(doc.buckets)) {
          doc.buckets.forEach(b => allBuckets.add(b));
      }
  }
  const tags = Array.from(allBuckets);

  // 3. ASSOCIATIVE SEARCH (The "Why") - 30% of budget
  const assocBudget = max_chars - directCharsUsed;
  let assocContext = "";

  if (tags.length > 0 && assocBudget > 500) {
      // Find files that share these tags BUT are not in direct results
      assocContext = await tagSearch(tags, ids, expandedTargetBuckets, assocBudget);
  }

  // 4. MERGE & FORMAT - Combine direct and associative results
  let finalContext = directContext;
  if (assocContext && assocContext.length > 0) {
      finalContext += `\n### ASSOCIATIVE CONTEXT (Related by Tags: ${tags.join(', ')})\n`;
      finalContext += assocContext;
  }

  return { context: finalContext || 'No results found.' };
}

// Helper function for associative search based on shared tags
async function tagSearch(tags, excludeIds, targetBuckets, max_chars) {
    try {
        // Build query to find memories with matching tags but excluding direct matches
        let tagFilterQuery = '?[id, content, source, buckets, timestamp] := *memory{id, content, source, buckets, timestamp}, ';

        // Add tag matching condition - find memories that have at least one of the tags
        const tagConditions = tags.map(tag => `is_in("${tag}", buckets)`).join(' || ');
        tagFilterQuery += `${tagConditions}, `;

        // Exclude IDs from direct matches
        if (excludeIds.length > 0) {
            const excludeCondition = `!(is_in(id, ${JSON.stringify(excludeIds)}))`;
            tagFilterQuery += `${excludeCondition}`;
        }

        const result = await db.run(tagFilterQuery);

        // cozo-node returns { headers: [...], rows: [...] } - no .ok property
        if (!result.rows || result.rows.length === 0) {
            return '';
        }

        // Group results by source for temporal folding
        const docsBySource = {};
        for (const row of result.rows) {
            const [id, content, source, buckets, timestamp] = row;

            // Filter by target buckets if specified
            const useBuckets = Array.isArray(targetBuckets) && targetBuckets.length > 0;
            const bucketMatch = !useBuckets || buckets.some(x => targetBuckets.includes(x));
            if (!bucketMatch) continue;

            if (!docsBySource[source]) {
                docsBySource[source] = [];
            }
            docsBySource[source].push({
                id, content, source, buckets, timestamp
            });
        }

        // Sort each source by timestamp (most recent first)
        for (const source in docsBySource) {
            docsBySource[source].sort((a, b) => b.timestamp - a.timestamp);
        }

        let context = '';
        let charCount = 0;

        // Process each source with temporal folding
        for (const source in docsBySource) {
            const sourceDocs = docsBySource[source];
            const headDoc = sourceDocs[0]; // Most recent
            const historyDocs = sourceDocs.slice(1); // Older versions

            // Create header for this source
            const header = `### Related: ${headDoc.source} (Tag Match)\n`;
            if (charCount + header.length > max_chars) {
                context += "\n... [Associative Context Truncated by Budget]";
                break;
            }
            context += header;
            charCount += header.length;

            // Add history section if there are older versions
            if (historyDocs.length > 0) {
                context += "**History:**\n";
                for (const histDoc of historyDocs) {
                    const histLine = `- ${new Date(histDoc.timestamp).toISOString()}\n`;
                    if (charCount + histLine.length > max_chars) {
                        context += "\n... [History Truncated by Budget]";
                        break;
                    }
                    context += histLine;
                    charCount += histLine.length;
                }
                context += "\n";
            }

            // Add content for the head document
            const entryText = `${headDoc.content}\n\n`;

            if (charCount + entryText.length > max_chars) {
                const remainingChars = max_chars - charCount;
                context += entryText.substring(0, remainingChars);
                context += "\n... [Associative Context Truncated by Budget]";
                break;
            }

            context += entryText;
            charCount += entryText.length;
        }

        return context;
    } catch (error) {
        console.error('Tag search error:', error);
        return '';
    }
}

/**
 * Parse query string to extract quoted phrases, temporal tags (@), and bucket tags (#)
 * @param {string} query - The raw query string to parse
 * @returns {Object} - Object containing: phrases (quoted), temporal (with @), buckets (with #), and remaining keywords
 */
function parseQuery(query) {
    const result = {
        phrases: [],      // Quoted phrases like "Project Sybil"
        temporal: [],     // Temporal tags like @today, @week, @month
        buckets: [],      // Bucket tags like #work, #personal
        keywords: []      // Remaining keywords after parsing
    };

    // Extract quoted phrases first
    const quoteRegex = /"([^"]+)"/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(query)) !== null) {
        result.phrases.push(quoteMatch[1]);
    }

    // Remove quoted phrases to process the rest
    let remainingQuery = query.replace(/"[^"]+"/g, '');

    // Extract temporal tags (@...)
    // Updated to handle special notations like @--- (for 2025) along with regular word-based tags
    const temporalRegex = /@([a-zA-Z0-9]+|---)/g;
    let temporalMatch;
    while ((temporalMatch = temporalRegex.exec(remainingQuery)) !== null) {
        result.temporal.push(temporalMatch[1]);
    }

    // Remove temporal tags - using same pattern as extraction
    remainingQuery = remainingQuery.replace(/@([a-zA-Z0-9]+|---)/g, '');

    // Extract bucket tags (#...)
    const bucketRegex = /#(\w+)/g;
    let bucketMatch;
    while ((bucketMatch = bucketRegex.exec(remainingQuery)) !== null) {
        result.buckets.push(bucketMatch[1]);
    }

    // Remove bucket tags
    remainingQuery = remainingQuery.replace(/#\w+/g, '');

    // Extract remaining keywords (remove extra whitespace and split)
    result.keywords = remainingQuery
        .split(/\s+/)
        .filter(keyword => keyword.length > 0);

    return result;
}

// Helper function to extract temporal buckets from query
function extractTemporalBucketsFromQuery(query) {
    const lowerQuery = query.toLowerCase();
    const temporalTerms = [];

    // Month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december'];
    const seasons = ['spring', 'summer', 'autumn', 'fall', 'winter'];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const quarters = ['q1', 'q2', 'q3', 'q4'];

    // Check for months
    for (const month of months) {
        if (lowerQuery.includes(month)) {
            temporalTerms.push(month.charAt(0).toUpperCase() + month.slice(1)); // Capitalize first letter
        }
    }

    // Check for seasons
    for (const season of seasons) {
        if (lowerQuery.includes(season)) {
            temporalTerms.push(season.charAt(0).toUpperCase() + season.slice(1)); // Capitalize first letter
        }
    }

    // Check for days
    for (const day of days) {
        if (lowerQuery.includes(day)) {
            temporalTerms.push(day.charAt(0).toUpperCase() + day.slice(1)); // Capitalize first letter
        }
    }

    // Check for quarters
    for (const quarter of quarters) {
        if (lowerQuery.includes(quarter)) {
            temporalTerms.push(quarter.toUpperCase());
        }
    }

    // Check for years (4-digit numbers)
    const yearMatches = query.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
        for (const year of yearMatches) {
            temporalTerms.push(year);
        }
    }

    return temporalTerms;
}

module.exports = {
    executeSearch,
    basicSearch,
    parseQuery
};
