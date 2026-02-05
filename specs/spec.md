# System Architecture Specification (Root Spec) - LLM Developer Blueprint

**Status:** Active | **Authority:** Human-Locked | **Domain:** LLM-First Development

## Core Architecture Overview

### Component Hierarchy
```
┌─────────────────────────────────────────────────────────────────┐
│  ELECTRON WRAPPER LAYER                                        │
├─────────────────────────────────────────────────────────────────┤
│  • UI Presentation Layer                                       │
│  • Health Check Client                                         │
│  • Process Management                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  ENGINE SERVER LAYER                                           │
├─────────────────────────────────────────────────────────────────┤
│  • HTTP API Gateway                                            │
│  • Route Management                                            │
│  • Request Processing                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NATIVE MODULE LAYER                                           │
├─────────────────────────────────────────────────────────────────┤
│  • Atomizer (Content Splitting)                                │
│  • Key Assassin (Content Sanitization)                         │
│  • Fingerprint (SimHash Generation)                            │
│  • Distance (Similarity Calculation)                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE LAYER                                                │
├─────────────────────────────────────────────────────────────────┤
│  • PGlite Persistence                                          │
│  • Schema Management                                           │
│  • Query Processing                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Startup Sequence (Standard 088 Compliant)
```
┌─────────────────────────────────────────────────────────────────┐
│  STARTUP FLOW                                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Engine Process Init                                        │
│  2. HTTP Server Start (Immediate)                             │
│  3. Database Init (Background)                                │
│  4. Native Module Loading (Background)                        │
│  5. Route Setup (Post-DB)                                     │
│  6. Service Activation                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Core Architecture Principles

### 1. The Browser Analogy
| Component | Browser Equivalent | ECE Implementation |
|-----------|-------------------|-------------------|
| Rendering Engine | Chromium/V8 | C++ N-API Modules |
| Shell/Interface | Browser UI | Node.js Application |
| Content Delivery | HTTP/CDN | Tag-Walker Protocol |
| Storage | IndexedDB/LocalStorage | PGlite (PostgreSQL-compatible) |

### 2. The "Write Once, Run Everywhere" Foundation
ECE achieves cross-platform compatibility through:
- **Node.js Orchestration**: Handles OS-specific operations and networking
- **C++ N-API Modules**: Performance-critical operations compiled to native code
- **Standard ABI**: N-API provides a stable interface between JavaScript and C++
- **Universal Binaries**: Automated build system creates platform-specific native modules

### 3. The "Iron Lung" Protocol
The hybrid Node.js/C++ architecture implements the "Iron Lung" protocol:
```
[User Input] -> [Node.js Layer] -> [N-API Boundary] -> [C++ Performance Layer] -> [Results]
```

## API Architecture

### Core Endpoints
*   `GET /health` - System readiness check (handles uninitialized state)
*   `POST /v1/ingest` - Content ingestion pipeline
*   `POST /v1/memory/search` - Semantic search functionality
*   `POST /v1/memory/molecule-search` - Splits query into sentence-like chunks
*   `GET /v1/buckets` - Get available data buckets
*   `GET /v1/tags` - Get available tags
*   `GET /monitoring/*` - System monitoring endpoints

### Data Flow Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│  INCOMING REQUEST                                              │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Request → Middleware → Route Handler → Native Processing │
│  → Database Query → Result Assembly → HTTP Response            │
└─────────────────────────────────────────────────────────────────┘
```

## Service Dependencies

### Internal Services
1. **Ingestion Service** - Content processing pipeline with native acceleration
2. **Search Service** - Semantic retrieval engine with Tag-Walker protocol
3. **Watchdog Service** - File system monitoring
4. **Dreamer Service** - Background processing and self-organization
5. **Agent Runtime** - Multi-stage reasoning loop for agent harnesses

### External Dependencies
1. **PGlite** - Database persistence (PostgreSQL-compatible)
2. **Electron** - Desktop UI wrapper
3. **Express** - HTTP server framework
4. **node-llama-cpp** - Local LLM inference
5. **wink-nlp** - Natural language processing

## Native Module Architecture

### Performance-Critical Operations
1. **Atomizer** - Content splitting with prose/code strategies
2. **Key Assassin** - Content sanitization and JSON artifact removal
3. **Fingerprint** - SimHash generation for deduplication
4. **Distance** - Hamming distance calculation for similarity

### Integration Pattern
- **N-API Boundary**: Stable interface between JavaScript and C++
- **Graceful Degradation**: JavaScript fallbacks when native modules unavailable
- **Zero-Copy Operations**: Using `std::string_view` where possible
- **Batch Processing**: Optimized for high-throughput operations

## Data Model Architecture

### Atomic Hierarchy
```
Compound (File) -> Molecule (Semantic Chunk) -> Atom (Entity)
```

Where:
- **Compound**: The source file (e.g., `journal_entry.yaml`)
- **Molecule**: The text chunk with semantic meaning (e.g., paragraph/sentence)
- **Atom**: The atomic entity within molecules (e.g., "Alice", "Bob", "Albuquerque")

### Semantic Categories
Instead of unlimited granular tags, the system uses constrained semantic categories:
- `#Relationship`: People interacting, personal connections
- `#Narrative`: Stories, timelines, memories, sequences
- `#Technical`: Code, architecture, system documentation
- `#Industry`: External market data (Oil, CO2, etc.)
- `#Location`: Geographic or spatial references
- `#Emotional`: High sentiment variance content
- `#Temporal`: Time-based sequences and chronology
- `#Causal`: Cause-effect relationships

## Agent Harness Agnosticism

### Core Philosophy: Data Atomization Service
ECE/Anchor is fundamentally a **data atomization service** that:
- Packages diverse data types into semantically meaningful units
- Enables semantic utilization of multiple data types
- Provides API access for querying and parsing data
- Outputs data in standardized formats (JSON, CSV, tables)
- Serves as a foundational layer for various agent systems

### Integration Pattern
1. Agent harness sends query to ECE
2. Query is intercepted and processed by the search system
3. Retrieved context (limited to configurable tokens) is returned
4. Agent harness combines context with its own logic
5. Final processing happens in the agent system

**Data Flow:**
```
Agent Query -> Anchor Context Retrieval -> Context + Agent Logic -> Response
```

## Error Handling Architecture

### Startup Error Prevention (Standard 088)
- Server binds to port before database initialization
- Health checks handle uninitialized state gracefully
- Extended timeouts for initialization sequences
- Fallback mechanisms for database connectivity

### Runtime Error Handling
- Circuit breaker patterns for service dependencies
- Graceful degradation when components fail
- Comprehensive logging for diagnostic purposes
- Native module fallback to JavaScript implementations

## Performance Considerations

### Native Module Performance
- **Distance Calculations**: 4.7M ops/sec (Batch/SIMD) - 8,000x improvement
- **Ingestion Pipeline**: Full pipeline (Cleanse → Fingerprint) at ~9ms
- **Memory Efficiency**: 30-50% reduction in memory usage
- **Cross-Platform**: Consistent performance across Windows, macOS, Linux

### Runtime Performance
- Connection pooling for database operations
- Caching strategies for frequent queries
- Background processing for heavy operations
- Memory management for long-running processes

## Security Architecture

### Access Control
- Localhost-only binding for sensitive endpoints
- Input validation for all API routes
- Secure configuration management
- Process isolation between components

### Data Protection
- Encrypted storage for sensitive data
- Secure transmission protocols
- Access logging for audit trails
- Input sanitization for all data ingestion

## Monitoring & Observability

### Health Monitoring
- Real-time system status checks
- Component-specific health endpoints
- Performance metric collection
- Resource utilization tracking

### Diagnostic Capabilities
- Structured logging with context
- Request tracing across components
- Performance counters for operations
- Error correlation and analysis

## Configuration Management

### Runtime Configuration
- Environment variable overrides
- JSON configuration files
- Dynamic reload capabilities
- Validation for configuration changes

### Feature Flags
- Toggle services without restart
- Enable/disable experimental features
- A/B testing support
- Rollback capabilities

## Deployment Architecture

### Process Management
- Single executable deployment
- Automatic restart on failure
- Graceful shutdown procedures
- Resource cleanup on termination

### Platform Support
- Cross-platform compatibility
- Native module handling
- File system abstraction
- OS-specific optimizations

## Change Management

### Versioning Strategy
- Semantic versioning for releases
- Backward compatibility preservation
- Migration path documentation
- Deprecation notices

### Testing Integration
- Automated testing for all changes
- Integration testing for workflows
- Performance regression testing
- Security vulnerability scanning