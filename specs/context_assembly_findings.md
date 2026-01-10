# Context Assembly Experiment Findings & Analysis

## Executive Summary

The Context Assembly Experiments revealed that the system's primary bottleneck is in the **Retrieval Layer**, not the **Inference Layer**. Natural language queries like "I need to study python concepts and gotchas to prepare for my interview tomorrow" returned 0 sources across all context sizes, scoring 1/10 on SLM comprehension. Conversely, simple keyword queries like "Jade" achieved 9.5/10 scores consistently.

## Key Findings

### 1. The FTS Trap Confirmed
- Natural language queries failed to retrieve any content from the database
- The semantic intent translation (Standard 042) is not effectively converting natural language to searchable keywords
- This confirms that the issue is in the retrieval step, not the model's comprehension ability

### 2. Garbage In, Garbage Out Principle
- When the system has relevant data, even the 1.5B model achieves excellent comprehension scores (9.5/10)
- The failure occurs when no relevant content is retrieved, not when the model cannot understand retrieved content

### 3. Schema Evolution Rationale
- The original schema used a single `bucket: String` field which limited memories to one category
- To enable multi-dimensional categorization, the schema was updated to `buckets: [String]` allowing memories to belong to multiple categories
- A `tags: String` field was added to store semantic tags as JSON-formatted arrays for enhanced search capabilities
- An `epochs: String` field was added to store epochal classifications as JSON-formatted arrays for hierarchical organization (Epochs -> Episodes -> Propositions)
- The CozoDB query syntax was updated from `:=` to `<-` for data retrieval operations to resolve parser errors during schema migrations
- These changes enable more sophisticated associative context windowing (Standard 046), temporal folding (Standard 047), and epochal organization (Standard 048)
- This proves that retrieval quality is more important than model size for performance

### 4. Efficiency Baseline Established
- **5,000-10,000 characters** is the optimal efficiency window
- Simple keyword queries perform best in this range
- Larger context windows don't necessarily improve comprehension and may reduce relevance

### 5. Epochal Historian Impact
- The introduction of the Epochal Historian (recursive decomposition: Epochs -> Episodes -> Propositions) significantly improves contextual organization
- Memories are now categorized hierarchically, enabling more precise retrieval
- The system can now identify and group related memories across time periods into coherent epochs
- This reduces noise in search results and improves relevance by providing semantic context layers

## Scaling Recommendations

### For Small Models (1.5B)
- Maintain strict 5k-10k character limits to prevent attention drift
- Use precise search strategy with exact keyword matching
- Apply aggressive temporal folding to save tokens
- Leverage epochal classification to reduce search scope

### For Large Models (14B+)
- Expand to 25k-50k character windows while maintaining thought units
- Use broad search strategy with fuzzy matching tolerance
- Apply relaxed temporal folding to show more historical context
- Increase associative search budget from 30% to 50% of the character budget
- Utilize epochal boundaries to maintain coherence across large contexts

### Critical Implementation Points
1. **Semantic Intent Translation Priority**: The system must prioritize semantic intent translation over raw keyword matching
2. **Translation Validation**: All natural language queries must be validated through the `translateIntent` function before hitting the database
3. **Fallback Protocol**: If semantic translation fails, the system must log the failure and attempt keyword expansion before returning zero results
4. **Epochal Classification**: The Dreamer service should regularly classify memories into epochs, episodes, and propositions for improved retrieval

## Diagnostic Protocol

When SLM comprehension scores are low:
1. First diagnose the retrieval layer before assuming inference issues
2. Check if the system is retrieving relevant data before concluding the model cannot understand it
3. Distinguish between "no relevant data retrieved" vs "model cannot understand retrieved data"
4. Optimize retrieval algorithms before upgrading inference models
5. Verify epochal classifications are being applied correctly to enable hierarchical search

## Implementation Guidelines

### For Natural Language Queries
- Verify that `inference.translateIntent()` is properly converting queries into optimized keywords and inferred buckets
- Implement fallback keyword extraction if semantic translation fails
- Monitor translation quality metrics (keyword relevance, bucket accuracy)

### For Context Window Management
- Use multiple 10k-character chunks in parallel rather than single massive contexts
- Maintain coherent "thought units" regardless of model size
- Balance relevance vs. volume in the character budget allocation

### For Epochal Organization
- Implement recursive decomposition in the Dreamer service
- Classify memories hierarchically: Epochs (large themes/time periods) -> Episodes (specific events) -> Propositions (individual facts)
- Use epochal tags to improve search precision and reduce noise
- Regularly update epochal classifications as new memories are added

## Conclusion

The experiment results confirm that the system's bottleneck is in the retrieval layer's inability to properly translate natural language queries into searchable terms, rather than any limitation in the inference model's comprehension abilities. The focus should be on improving semantic intent translation and retrieval algorithms rather than upgrading to larger models.

The addition of the Epochal Historian significantly enhances the system's ability to organize and retrieve information by providing semantic context layers that improve both precision and relevance of search results.

## Path Resolution Fixes

Recent updates have resolved critical path resolution issues in the service modules:

- Fixed relative import paths in all service files (search, ingest, scribe, dreamer, mirror, inference, watcher, safe-shell-executor)
- Corrected paths from `'../core/db'` to `'../../core/db'` in services located in subdirectories
- Standardized all relative imports to properly reference core modules and configuration files
- These fixes resolved "Cannot find module" errors that were preventing the application from starting

---
*Document created based on Context Assembly Experiment results and analysis*