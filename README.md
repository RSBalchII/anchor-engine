# ECE_Core - Sovereign Context Engine

**A Headless Node.js cognitive extraction system** that implements a "Sovereign Context Engine" - designed to provide infinite context augmentation for human cognition without cloud dependencies. The system runs entirely locally using Node.js and CozoDB with RocksDB persistence.

## Core Features

- **Markovian Reasoning Engine**: Scribe and Dreamer services for session state and background memory organization
- **Elastic Window Cognitive Retrieval**: Solves the "Keyword Saturation" problem
- **Zero-Cloud Portability**: Cognitive history moves between machines using YAML snapshots
- **Universal Context Extraction**: Tool for extracting context from any codebase
- **File Monitoring**: Automatic ingestion of new files in the `context/` directory
- **Multi-Platform Support**: Windows, macOS, and Linux

## Quick Start

1. **Prerequisites**: Install Node.js
2. **Setup**: Clone the repository and install dependencies:
   ```bash
   cd engine && npm install
   ```
3. **Add Context**: Drop `.md`, `.txt`, or `.yaml` files into the `context/` directory
4. **Run**: Use appropriate startup script:
   - Windows: `start_engine.bat`
   - macOS/Linux: `./start_engine.sh`
5. **Access**: Visit `http://localhost:3000` for the interface

## Architecture

The system uses a Node.js monolith with:
- **Engine**: Express.js server in `engine/` directory
- **Memory**: CozoDB with RocksDB persistence
- **Ingestion**: `chokidar` watches `context/` directory for auto-ingestion
- **API**: REST endpoints for ingestion, querying, and health checks

## API Endpoints

- `POST /v1/memory/search` - Cognitive Search with "Elastic Window" strategy
- `POST /v1/ingest` - Content ingestion
- `POST /v1/query` - Raw CozoDB query execution
- `GET /health` - Service health check
- `POST /v1/chat/completions` - LLM chat completions
- `POST /v1/dream` - Trigger background memory organization
- `GET /v1/backup` - Export cognitive history as YAML
- `GET /v1/buckets` - Get available memory buckets
- `POST /v1/scribe/update` - Update session state
- `GET /v1/scribe/state` - Get current session state

## Deterministic Search Syntax Guide

The system supports a deterministic search syntax for precise query construction, allowing human operators to craft accurate searches:

- **Quoted Phrases**: `"Project Sybil"` for exact phrase matching
- **Temporal Tags**: `@2025`, `@July`, `@Monday`, `@---` (representing current year) for temporal filtering
- **Bucket Tags**: `#work`, `#personal`, `#technical` for categorical filtering
- **Epochal Tags**: `#epoch:"Project Alpha Development"` for searching within specific epochs
- **Keywords**: Regular terms for general text matching
- **Combined Syntax**: `"Project Sybil" @2025 #work #epoch:"Project Alpha Development" meeting notes` for complex queries

### Operator Manual: Search Syntax Examples

As a human operator (Rob), use these patterns for effective searches:

- **Basic phrase search**: `"Project Sybil"` - Find exact phrase anywhere in memory
- **Temporal filtering**: `"Project Sybil" @2025` - Find exact phrase from 2025
- **Category filtering**: `"meeting notes" #work` - Find in work bucket only
- **Multi-category search**: `"meeting notes" #work #personal` - Find in multiple buckets
- **Temporal range**: `@2024 @2025 "annual review"` - Find across multiple years
- **Epochal search**: `#epoch:"Project Alpha Development" authentication changes` - Find within specific project epoch
- **Complex query**: `"Project Sybil" @Q1 #work #meeting #epoch:"Project Alpha Development" detailed notes` - Multi-faceted search

### Search Strategy

The system uses an "Elastic Window" cognitive retrieval strategy:
1. **Direct Search (70% budget)**: FTS-based search for exact matches
2. **Tag Harvesting**: Extracts buckets from direct results
3. **Associative Search (30% budget)**: Finds related content based on shared tags
4. **Temporal Search**: Incorporates temporal tags to enhance relevance
5. **Epochal Navigation**: Uses hierarchical organization (Epochs -> Episodes -> Propositions) for improved precision

### Epochal Historian

The system includes an Epochal Historian that performs recursive decomposition of memories:
- **Epochs**: Major time periods or thematic clusters of memories
- **Episodes**: Specific events or topics within an Epoch
- **Propositions**: Individual facts, statements, or insights

This hierarchical organization improves search precision and enables pattern recognition across time periods.

## Key Services

### Scribe Service
Maintains rolling session state summaries to prevent context overflow and maintain coherence across long conversations.

### Dreamer Service
Performs background memory organization and re-categorization, running automatically every 15 minutes after a 60-second startup delay.

### File Watcher
Monitors the `context/` directory for file changes and processes new/changed files with deduplication.
Supports bidirectional synchronization with the mirrored brain in `context/mirrored_brain/`.
Changes to mirrored files are automatically synced back to the database.

### Mirror Protocol
Creates a physical copy of your AI Brain in `context/mirrored_brain/` with YAML Frontmatter.
The filesystem acts as a "Second Brain" interface compatible with tools like Obsidian.
The File Watcher is configured to ignore the `context/mirrored_brain/` directory to prevent recursion loops.

### Mirror Protocol Directory Structure
The Mirror Protocol now implements a hierarchical organization based on the Epochal Historian's recursive decomposition:
- **Primary Structure**: `context/mirrored_brain/[Bucket]/Epochs/[Epoch Name]/[Memory_ID].[ext]`
- **Episode Decomposition**: `context/mirrored_brain/[Bucket]/Epochs/[Epoch Name]/Episodes/[Episode Name]/[Memory_ID].[ext]`
- **Fallback Structure**: `context/mirrored_brain/[Bucket]/Years/[Year]/[Memory_ID].[ext]`

### Schema Fields
The system uses a flexible schema to store memory information:
- `buckets: [String]`: Allows memories to belong to multiple categories simultaneously
- `tags: String`: Stores semantic tags as JSON-formatted arrays for enhanced search capabilities
- `epochs: String`: Stores epochal classifications as JSON-formatted arrays for hierarchical organization (Epochs -> Episodes -> Propositions)

## Path Resolution

The system has been updated to fix critical path resolution issues in service modules:

- Fixed relative import paths in all service files (search, ingest, scribe, dreamer, mirror, inference, watcher, safe-shell-executor)
- Corrected paths from `'../core/db'` to `'../../core/db'` in services located in subdirectories
- Standardized all relative imports to properly reference core modules and configuration files
- These fixes resolved "Cannot find module" errors that were preventing the application from starting

## Backup and Portability

### Exporting Data
- UI: "Export Snapshot" button in dashboard
- API: `GET /v1/backup` returns YAML file
- Snapshots saved to `backups/` directory

### Moving to New Machine
1. Copy latest `.yaml` snapshot to new machine
2. Install Node.js and run `npm install` in `engine/` folder
3. Hydrate: `node src/hydrate.js ../backups/your_snapshot.yaml`
4. Launch with appropriate start script

## Documentation

For detailed information, see:
- [specs/spec.md](specs/spec.md) - System architecture
- [specs/plan.md](specs/plan.md) - Development roadmap
- [specs/search_patterns.md](specs/search_patterns.md) - Search capabilities
- [specs/context_assembly_findings.md](specs/context_assembly_findings.md) - Experimental findings
- [specs/sovereign-desktop-app.md](specs/sovereign-desktop-app.md) - Sovereign Desktop overlay app vision
- [README_PKG.md](README_PKG.md) - Packaging and distribution

## Future: Sovereign Desktop

The next evolution of ECE is a **desktop overlay application** that provides:
- **Screen Awareness**: Local VL model reads your screen context
- **Hotkey Activation**: `Alt+Space` for instant AI access
- **Proactive Memory**: Auto-remembers important observations
- **100% Local**: No cloud, no subscriptions, full privacy

See [specs/sovereign-desktop-app.md](specs/sovereign-desktop-app.md) for the full architecture plan.

## Testing

Run the comprehensive test suite with:
```bash
npm test
```

This executes the complete test suite covering all functionality in the system.