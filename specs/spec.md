# ECE_Core - Technical Specification

## Mission

Build a **personal external memory system** as an assistive cognitive tool using:
- **Hybrid Architecture**: Node.js/C++ with native modules for performance-critical operations.
- **CozoDB (RocksDB)**: Unified graph-relational-vector-fts engine (Replacing Neo4j/Redis).
- **Tag-Walker Protocol**: Graph-based associative retrieval (Replacing legacy Vector Search).
- **Mirror 2.0**: Tangible Knowledge Graph filesystem projections.
- **Local-first LLM integration**: `node-llama-cpp` for GGUF support.
- **Browser Paradigm**: Universal compatibility through selective loading and cross-platform design.
- **Semantic Shift Architecture (Standard 084)**: Context-first, stateless interaction model that grounds each response in relevant ECE data without session memory.
- **Relationship Narrative Discovery**: Entity co-occurrence detection for identifying relationship patterns across domains.

## The Semantic Shift Architecture (Standard 084)

### Core Philosophy: "Context-First, Stateless Interaction"

The ECE implements a **Stateless Contextual Chat Protocol** that eliminates traditional chat session memory while maximizing contextual relevance through dynamic ECE data retrieval. This approach ensures each interaction is grounded in the most relevant knowledge graph data without accumulating conversational baggage.

### Architecture Evolution: From Keyword Index to Semantic Graph

**Before (Legacy):** Chunk → Atom → Tag (Granular keyword tagging)
**After (Semantic Shift):** Compound → Molecule → Atom (Semantic category tagging)

Where:
- **Compound**: The source file (e.g., journal_entry.yaml)
- **Molecule**: The text chunk with semantic meaning (e.g., paragraph/sentence)
- **Atom**: The atomic entity within molecules (e.g., "Alice", "Bob", "Albuquerque")

### Semantic Category System

The system now uses constrained high-level semantic categories instead of unlimited granular tags:

- `#Relationship`: People interacting, personal connections
- `#Narrative`: Stories, timelines, memories, sequences
- `#Technical`: Code, architecture, system documentation
- `#Industry`: External market data (Oil, CO2, etc.)
- `#Location`: Geographic or spatial references
- `#Emotional`: High sentiment variance content
- `#Temporal`: Time-based sequences and chronology
- `#Causal`: Cause-effect relationships

### Entity Co-occurrence Detection

The system implements "Tag Emergence" where semantic tags emerge from the interaction of entities within semantic molecules:

- **Relationship Detection**: When 2+ person entities appear in the same molecule → `#Relationship` tag
- **Narrative Detection**: When person + time reference appear → `#Narrative` tag
- **Technical Detection**: When technical terms appear → `#Technical` tag
- **Location Detection**: When location references appear → `#Location` tag

### Relationship Narrative Discovery

The system can identify relationship patterns by detecting when entities appear together:

```
Input: "Alice and Bob went to the park yesterday"
Process:
  - Detect entities: ["Alice", "Bob"]
  - Detect relationship indicator: "and"
  - Detect time reference: "yesterday"
  - Apply tags: #Relationship, #Narrative
Output: Molecule tagged with relationship and narrative semantics
```

### Universal Application

The same architecture works across domains:
- **Personal Domain**: Alice/Bob relationship narratives
- **Industrial Domain**: CO2/Sequestration/Oil industry relationships
- **Technical Domain**: Code component relationships
- **Research Domain**: Academic concept relationships

### The Relationship Historian Pattern

The Semantic Shift Architecture implements the "Relationship Historian" pattern that can extract relationship narratives from any domain:

```
Input Domain: Personal Relationships
Input: "Alice and Bob went to the park yesterday"
Process: Detect entities ["Alice", "Bob"], relationship indicator "and", temporal reference "yesterday"
Output: #Relationship, #Narrative tagged molecule

Input Domain: Industrial Data
Input: "CO2 sequestration increased with pressure"
Process: Detect entities ["CO2", "sequestration"], relationship indicator "with", quantitative reference "increased"
Output: #Industry, #Causal tagged molecule

Input Domain: Technical Architecture
Input: "CozoDB and ECE work together for semantic search"
Process: Detect entities ["CozoDB", "ECE"], relationship indicator "work together", functional reference "semantic search"
Output: #Technical, #Relationship tagged molecule
```

This pattern enables the same semantic processing engine to function as a historian for any type of relationship data, making the ECE a truly universal context engine.

### Semantic Categories (High-Level Taxonomy)

Instead of granular entity tags, the system now uses constrained semantic categories:
- `#Relationship`: People interacting, personal connections
- `#Narrative`: Stories, timelines, memories, sequences
- `#Technical`: Code, architecture, system documentation
- `#Industry`: External market data (Oil, CO2, etc.)
- `#Location`: Geographic or spatial references
- `#Emotional`: High sentiment variance content
- `#Temporal`: Time-based sequences and chronology
- `#Causal`: Cause-effect relationships

### Relationship Discovery Protocol

The system implements "Tag Emergence" where semantic tags emerge from the interaction of entities within semantic molecules:
- When 2+ person entities appear in the same molecule → `#Relationship` tag
- When person + time reference appear → `#Narrative` tag
- When technical terms appear → `#Technical` tag
- When location references appear → `#Location` tag
- **Stateless Contextual Chat Protocol (Standard 084)**: Context-first, stateless interaction model that grounds each response in relevant ECE data without session memory.

## Core Architecture

### 1. The Core (Node.js/C++ Hybrid Monolith)
The engine runs as a single, efficient Node.js process with high-performance C++ native modules for critical path operations:

1.  **Ingestion (The AtomizerService)**:
    * **Atomizer**: Splits text/code into logical units (accelerated with C++ native module).
    * **Key Assassin**: Surgically removes JSON artifacts from code (Data Hygiene) (accelerated with C++ native module).
    * **Fingerprint (SimHash)**: Generates locality-sensitive hashes for fuzzy deduplication (C++ native module).
    * **Enricher**: Assigns `source_id`, `sequence`, and `provenance`.
    * **Zero-Vector**: Stubs embedding slots to maintain schema compatibility without VRAM cost.

**Performance Benefits**:
    * **2.3x faster** code processing compared to pure JavaScript
    * **Zero-copy string processing** using `std::string_view` to reduce memory pressure
    * **Sub-millisecond processing** for typical operations
    * **Graceful fallback** to JavaScript implementations when native modules unavailable

2.  **Retrieval (Tag-Walker)**:
    * **Phase 1 (Anchors)**: Uses optimized FTS (Full Text Search) to find direct keyword matches (70% context budget).
    * **Phase 2 (The Walk)**: Pivots via shared tags/buckets to find "Associative Neighbors" that share context but lack keywords (30% context budget).

3.  **Persistence (CozoDB)**:
    * Backed by **RocksDB** for high-performance local storage.
    * Manages a Datalog graph of `*memory`, `*source`, and `*engrams`.

### 2. The Browser Paradigm Implementation
The system implements the "Browser Paradigm" for AI memory systems:

* **Universal Compatibility**: Runs on any device from smartphones to servers
* **Selective Loading**: Only loads relevant "atoms" for current query instead of entire dataset
* **Cross-Platform**: Consistent performance across different operating systems
* **Local-First**: All data remains on user's device for privacy and sovereignty

## Enhanced Architecture Components

### 3. Path Management System
The `PathManager` provides centralized path resolution across all platform environments:

* **Purpose**: Ensures consistent path handling across all modules
* **Features**: Platform-specific binary path resolution, database path management, notebook directory handling
* **Location**: `src/utils/path-manager.ts`

### 4. Native Module Management System
The `NativeModuleManager` provides robust loading and fallback mechanisms for native modules:

* **Purpose**: Handles native module loading with graceful degradation
* **Features**: Automatic fallback to JavaScript implementations, status tracking, cross-platform compatibility
* **Location**: `src/utils/native-module-manager.ts`

### 5. Bright Node Protocol
The enhanced search system implements the "Bright Node Protocol" for graph-based reasoning:

* **Purpose**: Selective graph illumination for reasoning models
* **Features**: `getBrightNodes` for focused graph traversal, `getStructuredGraph` for reasoning model input
* **Location**: `src/services/search/search.ts`

### 6. Resource Management System
The `ResourceManager` provides memory optimization and monitoring:

* **Purpose**: Optimize memory usage and prevent resource exhaustion
* **Features**: Memory monitoring, garbage collection triggers, performance optimization
* **Location**: `src/utils/resource-manager.ts`

### 7. Atomic Architecture (V4)
The system implements a complete atomic taxonomy:

* **Compounds**: Document-level entities with full content and metadata
* **Molecules**: Semantic segments with byte coordinates and relationship data
* **Atoms**: Atomic semantic units with entity recognition and tagging
* **Universal Data API**: Precise, sentence-level retrieval and manipulation

### 8. Context Inflation Protocol (Standard 085)
* **Purpose**: Inflate separate molecules into coherent windows
* **Mechanism**: Combines adjacent molecules into contextually meaningful segments
* **Benefit**: Improves coherence of retrieved information

## The Application Layer
* **API**: RESTful interface at `http://localhost:3000/v1/`.
* **Frontend**: Focused Single-Column React + Vite dashboard.
    *   **R1 Reasoning**: Displays a multi-stage thinking process (Initial -> Deepened -> Assess) before the answer.
    *   **GlassPanel Layout**: Atomic cyberpunk aesthetic with high-fidelity glassmorphism.
* **Desktop Overlay**: Electron "Thin Client" for Always-on-Top assistance.

## Standards Compliance

### Core Standards Implemented:
- **Standard 074**: Native Module Acceleration (The "Iron Lung" Protocol)
- **Standard 075**: Build System & Cross-Platform Deployment
- **Standard 076**: TypeScript Compilation and ES Module Compatibility
- **Standard 051**: Service Module Path Resolution
- **Standard 058**: UniversalRAG API
- **Standard 059**: Reliable Ingestion (The "Ghost Data" Protocol)
- **Standard 065**: Graph-Based Associative Retrieval (Semantic-Lite)
- **Standard 073**: CozoDB Integration for Graph-Relational-Vector-FTS Engine
- [Standard 069: Intelligent Query Expansion Protocol](standards/069-intelligent-query-expansion.md)
- [Standard 081: Atomic Taxonomy (V4) & Universal Data API](standards/081-atomic-taxonomy.md)
- [Standard 082: Universal Topology (Text/Data Unification)](standards/082-universal-topology.md)
- [Standard 083: Resilient Database Protocol (Auto-Purge)](standards/083-resilient-database.md)
- [Standard 085: Context Inflation Protocol (Semantic Window Assembly)](standards/085-context-inflation.md)
- [Standard 086: Tag-Walker Search Calibration (Natural Language Intent Mapping)](standards/086-tag-walker-calibration.md)
- [Standard 087: Relationship Narrative Discovery (Entity Co-occurrence Detection)](standards/087-relationship-narrative.md)

## Documentation Standards (Per doc_policy.md)

1. **Code is King**: Code is the only source of truth. Documentation is a map, not the territory.
2. **Synchronous Testing**: EVERY feature or data change MUST include a matching update to the Test Suite.
3. **Visuals over Text**: Prefer Mermaid diagrams to paragraphs.
4. **Brevity**: Text sections must be <500 characters.
5. **Pain into Patterns**: Every major bug must become a Standard.
6. **LLM-First Documentation**: Documentation must be structured for LLM consumption and automated processing.
7. **Change Capture**: All significant system improvements and fixes must be documented in new Standard files.
8. **Modular Architecture**: Each component must be documented in isolation for LLM comprehension.
9. **API-First Design**: All interfaces must be clearly defined with examples.
10. **Self-Documenting Code**: Complex logic must include inline documentation explaining intent.

## Build System

The project uses a hybrid build system:
- **Frontend**: Vite with TypeScript compilation
- **Engine**: TypeScript compilation with `tsc`
- **Native Modules**: `node-gyp` for C++ compilation
- **Desktop Overlay**: TypeScript compilation with Electron packaging

## Testing Strategy

Comprehensive test coverage across multiple levels:
- **Unit Tests**: Individual function and class testing
- **Integration Tests**: Module interaction testing
- **System Tests**: End-to-end functionality verification
- **Performance Tests**: Benchmarking and optimization validation

## Performance Characteristics

- **Memory Usage**: Optimized for low-resource environments (MBs not GBs)
- **Query Latency**: Millisecond retrieval of millions of tokens
- **Cross-Platform**: Consistent performance across Windows, macOS, and Linux
- **Native Acceleration**: 2.3x performance improvement for critical operations

## Security & Privacy

- **Local-First**: All data remains on user's device
- **Encryption**: Optional encryption for sensitive data
- **Access Controls**: Granular permissions for different data types
- **Audit Trail**: Complete logging of all operations

## Future Evolution

The architecture is designed for continuous evolution:
- **Modular Design**: Components can be replaced or upgraded independently
- **Plugin Architecture**: Support for custom modules and extensions
- **API Stability**: Backward compatibility maintained across versions
- **Community Driven**: Open standards and extensible architecture

## LLM Developer Quick Reference

### Common API Endpoints
*   `POST /v1/ingest` - Content ingestion with atomic processing
*   `POST /v1/memory/search` - Tag-Walker semantic search
*   `GET /health` - System health and component status
*   `GET /monitoring/metrics` - Performance metrics and system resources
*   `GET /v1/models` - Available LLM models and capabilities

### Key Data Structures
*   **Compound**: Document-level entity with full content and metadata
*   **Molecule**: Semantic segment with byte coordinates and relationship data
*   **Atom**: Atomic semantic unit with entity recognition and tagging
*   **Tag-Walker**: Graph traversal protocol for associative retrieval
*   **SimHash**: Fingerprinting algorithm for deduplication

### Native Module Functions
*   `fingerprint(content)` - Generate SimHash for content
*   `atomize(content, strategy)` - Split content into semantic molecules
*   `cleanse(content)` - Remove artifacts and normalize content
*   `distance(hash1, hash2)` - Compute similarity between fingerprints

### System Performance Characteristics
*   **Distance Calculations**: 4.7M ops/sec (Batch/SIMD) - 8,000x improvement over legacy JS
*   **Ingestion Pipeline**: Full pipeline (Cleanse → Fingerprint) at ~9ms
*   **Memory Usage**: 30-50% reduction through efficient allocation patterns
*   **Cross-Platform**: Consistent performance across Windows, macOS, Linux
*   **Native Acceleration**: 2.3x faster code processing with C++ modules

### Search Architecture Notes
*   **Current Challenge**: Natural language query processing shows brittleness
*   **Example Issue**: Query "What is the latest state of the ECE" returned 0 results
*   **Solution**: Tag-Walker protocol requires calibration for natural language intent mapping
*   **Implementation**: Standard 086 - Tag-Walker Search Calibration
*   **Enhancement**: Standard 087 - Relationship Narrative Discovery (entity co-occurrence detection)