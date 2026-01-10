# Standard 043: Temporal Lineage & Versioning
**Status:** Active | **Category:** DATA

## The Rule
If new content is >90% similar (Cosine Similarity) to existing content:
1. Do NOT delete the old node.
2. Link new node to old via `supersedes` edge.
3. Increment version counter.