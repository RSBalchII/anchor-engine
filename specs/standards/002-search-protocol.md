# Search Protocol Standard 002

## Overview
This document defines the deterministic search syntax for the ECE Core system. The new protocol eliminates the "Intent Translation" bottleneck by using high-speed, deterministic Regex logic instead of AI pre-processing.

## Syntax Elements

### 1. Quoted Phrases
- Format: `"Exact phrase to match"`
- Purpose: Boost exact phrase matches in BM25 ranking
- Example: `"Project Sybil"` will prioritize results containing the exact phrase "Project Sybil"

### 2. Bucket Tags
- Format: `#bucket_name`
- Purpose: Filter results to specific buckets only
- Example: `#work` will return only results from the "work" bucket
- Multiple buckets: `#work #personal` will return results from either bucket

### 3. Temporal Tags
- Format: `@temporal_marker`
- Purpose: Filter results by temporal attributes (year, month, etc.)
- Examples:
  - `@2025` - Only results from the year 2025
  - `@July` - Only results from July (any year)
  - `@Monday` - Only results from Mondays

## Combined Syntax
Multiple elements can be combined in a single query:
- `"Project Sybil" @2025 #work` - Results containing "Project Sybil" from 2025 in the work bucket
- `#personal @2024 meeting notes` - Personal meeting notes from 2024

## Behavior
- If any syntax element is detected, the system bypasses the SLM (Small Language Model) translation entirely
- If no syntax is detected, the system falls back to standard BM25 search across all active buckets
- Temporal filtering uses the timestamp column in the database to ensure precision
- All syntax elements are processed using high-speed Regex parsing (typically <10ms)

## Performance Benefits
- Eliminates the need to wake up the 1.5B model for simple keyword searches
- Reduces search latency from hundreds of milliseconds to single digits for syntax-based queries
- Ensures temporal precision (e.g., `@July2025` will not return August data)