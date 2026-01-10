# Standard 042: Semantic Intent Translation (SLM-to-DB)
**Status:** Active | **Category:** DATA

## The Rule
Use a local SLM (GLM-1.5B) to translate natural language into structured JSON queries before hitting the database.

## Output Schema
```json
{
  "query": "optimized keywords",
  "buckets": ["inferred_bucket"],
  "strategy": "broad" | "precise"
}
```