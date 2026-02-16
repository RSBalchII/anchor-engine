# Anchor

**Version:** 3.0.0 | **Status:** Active | **Domain:** Autonomous Context Management

> **"Anchor Your System's Reality."**

## Overview

**Anchor** is a self-hosted, privacy-focused knowledge management system that creates a persistent memory layer for AI-assisted workflows. Built with a "LLM-First" architecture, it enables sovereign control of personal and organizational knowledge graphs.

Anchor is fundamentally a **data atomization service** that packages data in ways that allow multiple data types to be semantically utilized. The system can be queried and parsed through the Anchor CLI into tables, CSV, or JSON structures for use by various agent harnesses.

## System State: "HYBRID MEMORY ARCHITECTURE"

The Anchor system has evolved into a **Client-Side Brain / Server-Side Memory** architecture.
- **Brain**: In-Browser Inference via **WebLLM** (running on your GPU).
- **Memory**: Anchor Engine providing semantic search and context injection (`tag-walker`).
- **Alternative Brain**: `nanobot-node` (Node.js + Llama.cpp) for headless operation.

### Performance Achievements

- **Distance Calculations**: 4.7M ops/sec (Batch/SIMD) - 8,000x improvement
- **Ingestion Pipeline**: Full pipeline (Cleanse → Fingerprint) at ~9ms
- **Memory Efficiency**: 30-50% reduction in memory usage
- **Client-Side Intelligence**: Zero-latency chat via WebLLM (Llama 3, DeepSeek, Qwen)
- **Native Acceleration**: 2.3x faster code processing with C++ modules
- **Tag-Walker Protocol**: Graph-based associative retrieval replacing vector search.
- **Database Stability**: PGlite implementation stable and performant.

## Key Features

- **Autonomous Context Management**: Self-organizing memory with temporal awareness
- **WebLLM Integration**: Runs entirely in your browser for maximum privacy and speed
- **Semantic Search**: Advanced retrieval using graph-based associative search
- **Privacy-First**: All data remains under your control, no cloud dependencies
- **Extensible Architecture**: Plugin system for custom integrations
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Architecture Highlights

### Core Components
- **anchor-engine**: Semantic Memory & Search API (Port 3160)
- **anchor-ui**: React-based "Brain" (WebLLM) + "Memory" Interface
- **inference-server**: Static Model Host (Port 3000)
- **nanobot-node**: Headless Agent Node (Port 3200)

### Data Model
- **Atomic Architecture**: Compound → Molecule → Atom hierarchy
- **Semantic Indexing**: Tag-Walker protocol for associative retrieval
- **Temporal Folding**: Chronological organization with versioning
- **Relationship Mapping**: Entity co-occurrence and connection discovery

## Agent Harness Integration

Anchor is designed to be **agent harness agnostic**. With the move to WebLLM, the Agent Loop now runs directly in the client, querying the Anchor Engine for context only when needed (RAG).

### Data Atomization Service
Anchor's core function is as a **data atomization service** that:

- Packages diverse data types into semantically meaningful units
- Enables semantic utilization of multiple data types
- Provides CLI access for querying and parsing data
- Outputs data in standardized formats (tables, CSV, JSON)

## Updated Architecture Notes

The system now implements a **"Thick Client"** approach: `anchor-ui` handles the intelligence loop (Agent), while `anchor-engine` serves as the high-speed semantic memory store.

**Data Flow:**
```
User Query -> WebLLM (Browser) -> Detects Intent -> Calls Anchor API (/search) -> Context Injection -> WebLLM Response
```

## Search Logic & Current Challenges

### Search Calibration (Priority 1)
- **Status**: Optimizing `tag-walker` parameters for natural language queries.
- **Issue**: Tuning the balance between keyword exactness and semantic association.
- **Goal**: Perfecting the stateless context injection for the WebLLM Agent.

### Guidance System Lag
- The engine (performance) is hyper-scaled but search guidance needs calibration
- Semantic Shift Architecture (Standard 084) requires tuning for natural language

## Installation

### Prerequisites
- Node.js v18+
- PNPM package manager
- Git for version control

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd ECE_Core

# Install dependencies
pnpm install

# Build the system
pnpm build

# Launch the system
./start.sh        # Linux/macOS
.\start.bat      # Windows
```

## Usage

### Quick Start
1. Run `./start.sh` (Linux/macOS) or `.\start.bat` (Windows)
2. Access the UI at the configured server URL (default: http://localhost:3160, configurable in user_settings.json)
3. Begin ingesting content via drag-and-drop or API
4. Search and explore your knowledge graph

### Data Ingestion
- **File Drop**: Place files in the `context/` directory
- **API Ingestion**: Use `POST /v1/ingest` endpoint
- **Batch Import**: Use corpus format for bulk ingestion
- **Real-time Sync**: Watchdog monitors `context/` directory
- **Path Management**: Dynamic `POST/DELETE /v1/system/paths` endpoints for aggregation

### Search Capabilities
- **Natural Language**: Ask questions in plain English
- **Tag-Based**: Use hashtags for precise filtering
- **Temporal**: Filter by date ranges and time periods
- **Semantic**: Retrieve related concepts and associations

## Standalone Operation

The Anchor Engine can operate independently with a built-in lightweight UI. When running standalone:
- The engine serves a simple React-based UI from its own `public` directory
- When integrated with the full system, it uses the external UI from `packages/anchor-ui/dist`
- The system intelligently detects which UI to serve based on availability

## System Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PGlite (PostgreSQL-compatible)
- **Frontend**: TypeScript, React (Vite build system) with lightweight fallback UI
- **Desktop**: Electron wrapper
- **AI Integration**: Local LLM support with remote fallback

### Standards Implemented
- **Standard 053**: CozoDB Pain Points & OS Compatibility
- **Standard 059**: Reliable Ingestion Pipeline
- **Standard 088**: Server Startup Sequence (ECONNREFUSED fix)
- **Standard 094**: Smart Search Protocol (Fuzzy Fallback & GIN Optimization)

### Search Capabilities
- **Natural Language**: Ask questions in plain English with "Smart Search" intent detection
- **Elastic Context**: Dynamically scales context (200b - 32kb) based on term rarity (Standard 105)
- **Typo Tolerance**: Fuzzy search logic catches misspellings (e.g. "conciousness" -> "consciousness")
- **Dynamic Sorting**: Use keywords like "earliest" or "oldest" to toggle chronological sorting
- **Tag-Based**: Use hashtags for precise filtering
- **Temporal**: Filter by date ranges and time periods
- **Semantic**: Retrieve related concepts and associations via Tag-Walker
### Common Issues
- **ECONNREFUSED**: Fixed in Standard 088 - server starts before database initialization
- **Slow Startup**: First run includes database initialization (subsequent runs are faster)
- **UI Access**: Direct access at the configured server URL (default: http://localhost:3160, configurable in user_settings.json) if Electron wrapper is delayed
- **Database Type Errors**: Fixed "Invalid input for string type" errors during ingestion pipeline - see Standard 059 for details

### Health Checks
- System status: `GET /health`
- Component status: `GET /health/{component}`
- Performance metrics: `GET /monitoring/metrics`

## Contributing

We welcome contributions! Please see our contributing guidelines in the documentation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Documentation: Check the `/docs/` directory
- Issues: Report bugs and feature requests on GitHub
- Community: Join our discussion forums

## Roadmap

- Enhanced AI reasoning capabilities
- Improved collaboration features
- Mobile application support
- Advanced visualization tools
- Plugin marketplace