# ECE_Core Architecture Diagrams

## 1. Overall System Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        A[Frontend Dashboard<br/>React + Vite]
        B[Electron Overlay<br/>Always-on-Top]
        C[REST API<br/>Express Server]
    end

    subgraph "Core Engine"
        D[Node.js Shell<br/>Orchestration & Networking]
        
        subgraph "Native Modules (C++)"
            E[Atomizer<br/>Content Splitting]
            F[Key Assassin<br/>Content Sanitization]
            G[Fingerprint<br/>SimHash Generation]
            H[Distance<br/>Similarity Calculation]
        end
        
        subgraph "Database Layer"
            I[CozoDB<br/>Graph-Relational-FTS]
            J[RocksDB Backend<br/>Persistent Storage]
        end
        
        subgraph "Services"
            K[Ingestion Service<br/>Atomic Pipeline]
            L[Search Service<br/>Tag-Walker Protocol]
            M[Watchdog<br/>File Monitoring]
            N[Dreamer<br/>Self-Organization]
        end
    end

    subgraph "Utilities"
        O[Path Manager<br/>Cross-Platform Paths]
        P[Native Module Manager<br/>Graceful Degradation]
        Q[Performance Monitor<br/>Metrics Collection]
        R[Structured Logger<br/>Context-Aware Logging]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    D --> I
    D --> K
    D --> L
    D --> M
    D --> N
    I --> J
    D --> O
    D --> P
    D --> Q
    D --> R
```

## 2. Atomic Architecture Flow

```mermaid
flowchart TD
    A[Raw Content<br/>Text File, Code, etc.] --> B{Content Type}
    
    B -->|Prose| C[Prose Processing<br/>Sentence Splitting]
    B -->|Code| D[Code Processing<br/>AST-based Splitting]
    B -->|Data| E[Data Processing<br/>Row/Line Splitting]
    
    C --> F[Sanitization<br/>Key Assassin Protocol]
    D --> F
    E --> F
    
    F --> G[Semantic Analysis<br/>Entity Extraction]
    G --> H[Semantic Categorization<br/>Relationship/Narrative/Technical Tags]
    
    H --> I[Compound Creation<br/>ID: comp_[hash of content+path]<br/>Contains full content]
    I --> J[Molecule Extraction<br/>Semantic Segments<br/>with byte coordinates]
    
    J --> K[Molecule 1<br/>ID: mol_[hash]<br/>Content: [segment text]<br/>Start: [byte offset]<br/>End: [byte offset]<br/>Type: prose/code/data<br/>Sequence: 0]
    
    J --> L[Molecule 2<br/>ID: mol_[hash]<br/>Content: [segment text]<br/>Start: [byte offset]<br/>End: [byte offset]<br/>Type: prose/code/data<br/>Sequence: 1]
    
    J --> M[Other Molecules<br/>...]
    
    G --> N[System Atoms<br/>#project, #src, #code, etc.]
    H --> O[Semantic Atoms<br/>#Relationship, #Narrative, etc.]
    K --> P[K-Molecule Atoms<br/>Specific entities in segment]
    L --> Q[L-Molecule Atoms<br/>Specific entities in segment]
    M --> R[Other Molecule Atoms<br/>...]
    
    I --> S[Compound Atoms<br/>Aggregated from all molecules]
    I --> T[Compound Molecules<br/>IDs of all molecules]
    
    K --> U[Molecule-Compound Link<br/>compoundId reference]
    L --> U
    M --> U
    
    N --> V[Atom Deduplication<br/>Remove duplicates across system]
    O --> V
    P --> V
    Q --> V
    R --> V
    
    V --> W[Final Atoms<br/>Unique atom IDs with labels]
    
    I --> X{Persist to Database}
    K --> X
    L --> X
    M --> X
    W --> X
    
    X --> Y[CozoDB Tables:<br/>- compounds table<br/>- molecules table<br/>- atoms table<br/>- atom_edges table]
```

## 3. Tag-Walker Search Protocol

```mermaid
graph LR
    A[User Query<br/>"Rob and Jade relationship"] --> B[Natural Language Parsing<br/>Extract Entities & Temporal Context]
    
    B --> C[Query Expansion<br/>NLP-based tag extraction]
    
    C --> D[Phase 1: Anchor Search<br/>70% of token budget<br/>Direct FTS matches]
    
    D --> E[Retrieve Top Molecules<br/>Based on FTS relevance]
    
    E --> F[Phase 2: Graph Walk<br/>30% of token budget<br/>Shared tag/bucket neighbors]
    
    F --> G[Retrieve Associative Neighbors<br/>Molecules sharing tags but lacking keywords]
    
    G --> H[Semantic Category Filtering<br/>Apply #Relationship, #Narrative, etc.]
    
    H --> I[Entity Co-occurrence Detection<br/>Boost molecules with multiple entities]
    
    I --> J[Provenance Boosting<br/>Sovereign content gets 2-3x boost]
    
    J --> K[Active Cleansing<br/>SimHash deduplication]
    
    K --> L[Context Inflation<br/>Combine adjacent molecules]
    
    L --> M[Final Results<br/>Ranked by composite score]
    
    M --> N[Return to LLM<br/>For reasoning and response]
```

## 4. Native Module Integration

```mermaid
graph TD
    A[Node.js Application] --> B[N-API Boundary]
    
    B --> C[C++ Native Module<br/>Performance-Critical Operations]
    
    C --> D[Atomizer<br/>std::string_view for zero-copy]
    C --> E[Key Assassin<br/>Content sanitization]
    C --> F[Fingerprint<br/>SimHash generation]
    C --> G[Distance<br/>Hamming distance calculation]
    
    D --> H[Memory Efficiency<br/>Avoid unnecessary copies]
    E --> H
    F --> H
    G --> H
    
    A --> I[JavaScript Fallback<br/>Graceful degradation]
    I --> J[Same API Interface<br/>Ensures compatibility]
    
    A --> K[Native Module Manager<br/>Handles loading & fallbacks]
    K --> L[Load native module]
    K --> M[Activate fallback if native fails]
    
    L --> N{Native module available?}
    N -->|Yes| O[Use native implementation]
    N -->|No| P[Use JavaScript fallback]
    
    O --> Q[2.3x performance improvement]
    P --> R[Compatible functionality]
```

## 5. Build & Deployment Pipeline

```mermaid
graph LR
    A[Source Code<br/>TypeScript, C++, Assets] --> B[Package Management<br/>PNPM workspace]
    
    B --> C[Frontend Build<br/>Vite + RollDown bundling]
    B --> D[Engine Build<br/>TypeScript compilation]
    B --> E[Native Module Build<br/>node-gyp compilation]
    
    C --> F[Frontend Bundle<br/>Optimized assets]
    D --> G[Engine Artifacts<br/>Compiled JavaScript]
    E --> H[Native Binaries<br/>.node files per platform]
    
    F --> I[Electron Packaging<br/>Cross-platform app bundling]
    G --> I
    H --> I
    
    I --> J[Electron App<br/>Windows, macOS, Linux]
    
    J --> K[Deployment<br/>Distribute to users]
    
    subgraph "Platform-Specific"
        L[Windows<br/>cozo_node_win32.node]
        M[macOS<br/>cozo_node_darwin.node]
        N[Linux<br/>cozo_node_linux.node]
    end
    
    H --> L
    H --> M
    H --> N
```