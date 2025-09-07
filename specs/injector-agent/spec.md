# InjectorAgent Specification

## Overview
The InjectorAgent is the primary user interface to the ECE's memory systems. It intelligently queries both the short-term (Redis) and long-term (Neo4j) memory to augment user prompts before they are sent to the final LLM.

## Purpose
The InjectorAgent serves as the intelligent context augmentation layer that:
1. Intercepts user prompts and analyzes them for context needs
2. Queries the high-speed Redis Context Cache for semantically similar queries
3. If no relevant cache entries are found, queries the ArchivistAgent for deeper context from Neo4j
4. Augments the original user prompt with retrieved context to create a richer prompt for the final LLM

## Key Features
1. **Intelligent Query Escalation**: Smart routing from fast cache to deep memory retrieval
2. **Prompt Augmentation**: Skillfully rewrites user prompts to include relevant context
3. **Memory Layer Integration**: Seamless interaction with both Redis cache and Neo4j knowledge graph
4. **Performance Optimization**: Prioritizes fast cache lookups while ensuring comprehensive context retrieval

## Data Models

### ContextQuery
Represents a query for context retrieval:
- `query_text`: The original user prompt or extracted query text
- `query_embedding`: Optional vector representation for semantic search
- `max_cache_results`: Maximum number of results from cache (default: 3)
- `max_graph_results`: Maximum number of results from graph (default: 5)

### AugmentedPrompt
Represents a prompt augmented with context:
- `original_prompt`: The original user prompt
- `augmented_prompt`: The prompt with added context
- `context_sources`: List of sources for the added context
- `confidence_score`: Confidence in the relevance of added context (0.0 to 1.0)

## API Interface

### Primary Methods
- `analyze_prompt(prompt: str) -> ContextQuery`: Analyze a prompt to determine context needs
- `retrieve_context(query: ContextQuery) -> List[Dict]`: Retrieve context from memory layers
- `augment_prompt(original_prompt: str, context: List[Dict]) -> AugmentedPrompt`: Augment prompt with context
- `process(user_prompt: str) -> AugmentedPrompt`: Full end-to-end processing

## Integration Points
- **Redis Context Cache**: High-speed semantic and generative caching
- **ArchivistAgent**: Deep memory retrieval from Neo4j knowledge graph
- **Chat Interface**: Primary entry point for user interactions
- **Final LLM**: Destination for context-augmented prompts