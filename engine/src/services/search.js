const { db } = require('../core/db');

// Basic search function as fallback when FTS fails
async function basicSearch(query, max_chars = 5000, buckets) {
  try {
    const useBuckets = Array.isArray(buckets) && buckets.length > 0;
    const searchQuery = `?[id, timestamp, content, source, type, buckets] := *memory{id, timestamp, content, source, type, buckets}`;
    
    const result = await db.run(searchQuery);

    let context = '';
    let charCount = 0;

    if (result.rows) {
      const filteredRows = result.rows.filter(row => {
        const [id, timestamp, content, source, type, b] = row;
        
        // Filter by bucket in JS for now to avoid Cozo syntax issues
        const bucketMatch = !useBuckets || b.some(x => buckets.includes(x));
        if (!bucketMatch) return false;

        return content.toLowerCase().includes(query.toLowerCase()) ||
               source.toLowerCase().includes(query.toLowerCase());
      });

      filteredRows.sort((a, b) => {
        const [a_id, a_timestamp, a_content, a_source, a_type, a_b] = a;
        const [b_id, b_timestamp, b_content, b_source, b_type, b_b] = b;
        const aContentMatch = a_content.toLowerCase().includes(query.toLowerCase());
        const bContentMatch = b_content.toLowerCase().includes(query.toLowerCase());
        if (aContentMatch && !bContentMatch) return -1;
        if (!aContentMatch && bContentMatch) return 1;
        return 0;
      });

      for (const row of filteredRows) {
        const [id, timestamp, content, source, type, b] = row;
        const entryText = `### Source: ${source}\n${content}\n\n`;
        if (charCount + entryText.length > max_chars) {
          const remainingChars = max_chars - charCount;
          context += entryText.substring(0, remainingChars);
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
    const targetBuckets = buckets || (bucket ? [bucket] : null);
    const useBuckets = Array.isArray(targetBuckets) && targetBuckets.length > 0;
    
    const baseK = deep ? 200 : 30;
    const k = Math.max(baseK, Math.ceil(max_chars / 500));

    // Sanitize query for CozoDB FTS: remove characters that might break the parser
    // Keeping alphanumeric, spaces, and basic punctuation that doesn't act as operators
    const sanitizedQuery = query.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!sanitizedQuery) {
        return await basicSearch(query, max_chars, targetBuckets);
    }

    const ftsQuery = `?[id, score] := ~memory:content_fts{id | query: $q, k: ${k}, bind_score: s}, score = s`;
    const ftsParams = { q: sanitizedQuery };
    let ftsResult;
    
    try {
        ftsResult = await db.run(ftsQuery, ftsParams);
    } catch (e) {
        console.error('FTS Error, falling back to basic:', e.message);
        return await basicSearch(query, max_chars, targetBuckets);
    }

    if (ftsResult.rows.length === 0) {
        return await basicSearch(query, max_chars, targetBuckets);
    }

    const ids = ftsResult.rows.map(row => row[0]);
    const scores = Object.fromEntries(ftsResult.rows);
    
    const contentQuery = `
      ?[id, content, source, buckets] := 
        *memory{id, content, source, buckets},
        is_in(id, $ids)
    `;
    
    const contentResult = await db.run(contentQuery, { ids });
    
    let allHits = [];
    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    for (const row of contentResult.rows) {
        const [id, content, source, b] = row;
        
        // Filter by bucket in JS
        const bucketMatch = !useBuckets || b.some(x => targetBuckets.includes(x));
        if (!bucketMatch) continue;

        let match;
        searchRegex.lastIndex = 0; 
        while ((match = searchRegex.exec(content)) !== null) {
            allHits.push({
                id, source, content, 
                start: match.index,
                end: match.index + match[0].length,
                score: scores[id]
            });
        }
    }

    if (allHits.length === 0) {
        return await basicSearch(query, max_chars, targetBuckets);
    }

    const rawWindowSize = Math.floor(max_chars / allHits.length);
    const windowSize = Math.min(Math.max(rawWindowSize, 300), 1500); 
    const padding = Math.floor(windowSize / 2);

    const docsMap = {};

    for (const hit of allHits) {
        if (!docsMap[hit.id]) {
            docsMap[hit.id] = { 
                source: hit.source, 
                score: hit.score, 
                ranges: [], 
                content: hit.content 
            };
        }
        
        const start = Math.max(0, hit.start - padding);
        const end = Math.min(hit.content.length, hit.end + padding);
        docsMap[hit.id].ranges.push({ start, end });
    }

    let finalContext = "";
    let totalCharsUsed = 0;
    
    const sortedDocs = Object.values(docsMap).sort((a, b) => b.score - a.score);

    for (const doc of sortedDocs) {
        if (totalCharsUsed >= max_chars) break;

        doc.ranges.sort((a, b) => a.start - b.start);
        const merged = [];
        if (doc.ranges.length > 0) {
            let current = doc.ranges[0];
            for (let i = 1; i < doc.ranges.length; i++) {
                if (doc.ranges[i].start <= current.end + 50) {
                    current.end = Math.max(current.end, doc.ranges[i].end);
                } else {
                    merged.push(current);
                    current = doc.ranges[i];
                }
            }
            merged.push(current);
        }

        const header = `### Source: ${doc.source} (Score: ${Math.round(doc.score)})\n`;
        if (totalCharsUsed + header.length > max_chars) break;
        finalContext += header;
        totalCharsUsed += header.length;

        for (const range of merged) {
            const snippet = doc.content.substring(range.start, range.end).replace(/\n/g, ' ');
            const entry = `...${snippet}...\n\n`;
            
            if (totalCharsUsed + entry.length > max_chars) break;
            finalContext += entry;
            totalCharsUsed += entry.length;
        }
        
        finalContext += "---\n";
    }

    return { context: finalContext };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

module.exports = {
    executeSearch,
    basicSearch
};
