# ECE Quickstart: Data Ingestion Guide

> **For first-time users**: How to get your data into the External Context Engine  
> **Canonical Reference**: This is the primary user guide. See `specs/doc_policy.md` for documentation standards.

---

## 🎯 Two Ways to Start

### Option A: Fresh Start (New Graph)
Start with an empty database and add your own data.

### Option B: Resume from Backup
Load a previous session's backup, then continue adding new data on top.

---

## 📥 Data Ingestion Methods

### Method 1: Drop Files into `context/` Directory (Easiest)

Simply copy any text files into the `context/` folder:

```
ECE_Core/
└── context/
    ├── my-notes.md          ← Just drop files here
    ├── research/
    │   └── paper.txt        ← Subfolders become "buckets"
    └── combined_context.yaml ← Corpus files get extracted
```

**Supported formats**: `.txt`, `.md`, `.json`, `.yaml`, `.yml`, `.js`, `.ts`, `.py`, `.html`, `.css`

**Auto-bucketing**: Top-level folder name = bucket. Files in root go to `pending` bucket.

---

### Method 2: Flatten a Codebase with `read_all.js`

Perfect for ingesting an entire project for AI context:

```bash
# From the engine directory
node src/read_all.js "C:\path\to\your\project"

# Output: C:\path\to\your\project\codebase\combined_context.yaml
```

Then copy `combined_context.yaml` to your `context/` folder. The watcher will:
1. Detect it's a corpus file (has `project_structure:` and `files:` array)
2. Extract each file as an individual memory
3. Auto-bucket under the project name
4. Deduplicate via hash (exact) and Jaccard similarity (semantic)

**Example workflow**:
```bash
# Day 1: Initial codebase snapshot
node src/read_all.js "C:\Projects\MyApp"
copy "C:\Projects\MyApp\codebase\combined_context.yaml" "context\myapp_v1.yaml"

# Day 5: Updated codebase
node src/read_all.js "C:\Projects\MyApp"
copy "C:\Projects\MyApp\codebase\combined_context.yaml" "context\myapp_v2.yaml"
# → Only NEW/CHANGED files get added, similar files are skipped
```

---

### Method 3: API Ingestion

```bash
# Single document
curl -X POST http://localhost:3030/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your content here...",
    "source": "my-document.md",
    "buckets": ["research", "personal"]
  }'
```

---

## 🔄 Deduplication Logic

The system prevents duplicate data intelligently:

| Scenario | What Happens |
|----------|--------------|
| **Exact match** (same hash) | Skipped entirely |
| **80%+ similar** (Jaccard) | Skipped (considered same document) |
| **50-80% similar** | New version created (temporal folding shows latest) |
| **<50% similar** | New document created |

---

## 🗄️ Backup & Restore

### Create a Backup (Eject)
```bash
curl -X POST http://localhost:3030/v1/admin/backup
# → Creates backups/cozo_memory_snapshot_TIMESTAMP.yaml
```

### Auto-Restore on Startup
The engine automatically loads the **most recent backup** from `backups/` on startup.

### Manual Restore
```bash
curl -X POST http://localhost:3030/v1/admin/restore \
  -H "Content-Type: application/json" \
  -d '{"snapshotPath": "backups/cozo_memory_snapshot_2026-01-09.yaml"}'
```

---

## 🔍 Searching Your Data

### Basic Search
```bash
curl "http://localhost:3030/v1/search?q=ECE_Core"
```

### With Bucket Filter
```bash
curl "http://localhost:3030/v1/search?q=authentication&buckets=myapp,security"
```

### Search Results Format
```
### Source: MyApp/src/auth.js
**History:**
- 2026-01-09T10:00:00Z  ← Previous versions (collapsed)
- 2026-01-05T15:30:00Z

[Latest content shown here]
```

---

## 🌙 The Dreamer (Auto-Organization)

The background Dreamer process:
1. Analyzes pending memories
2. Assigns semantic buckets (relationships, research, ethics, etc.)
3. Identifies Epochs, Episodes, and Entities
4. Triggers the Mirror protocol

---

## 🪞 The Mirror (`context/mirrored_brain/`)

After ingestion, memories are mirrored as physical files:

```
context/mirrored_brain/
├── myapp/
│   └── Years/
│       └── 2026/
│           ├── auth.js.md
│           └── config.ts.md
└── personal/
    └── Epochs/
        └── The_ECE_Migration/
            └── notes.md
```

Each file has YAML frontmatter with metadata. **Edits sync back to the database**.

---

## 📋 Typical Daily Workflow

```bash
# 1. Start the engine
cd engine && npm start

# 2. Flatten your current codebase
node src/read_all.js "C:\Projects\CurrentProject"

# 3. Copy to context (watcher auto-ingests)
copy "C:\Projects\CurrentProject\codebase\combined_context.yaml" "context\"

# 4. Search for relevant context
curl "http://localhost:3030/v1/search?q=authentication&max_chars=50000"

# 5. Copy results to your browser AI (Gemini, etc.)

# 6. At end of day, backup your session
curl -X POST http://localhost:3030/v1/admin/backup
```

---

## ⚠️ Important Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max file size | 500KB | Larger files poison FTS search |
| Max files per corpus | ~1M tokens | read_all.js config |
| Similarity threshold | 80% | Below this = new document |

---

## 🚀 Quick Commands

```bash
# Check memory count
curl http://localhost:3030/v1/admin/stats

# Trigger mirror manually
curl -X POST http://localhost:3030/v1/admin/mirror

# Clear oversized junk
curl -X DELETE http://localhost:3030/v1/admin/cleanup-bulk

# Run dreamer manually
curl -X POST http://localhost:3030/v1/admin/dream
```

---

## 📚 Related Documentation

| Document | Purpose |
|----------|---------|
| [specs/doc_policy.md](specs/doc_policy.md) | Documentation standards and ingestion flow diagram |
| [specs/standards/20-DATA/053-cozodb-pain-points-reference.md](specs/standards/20-DATA/053-cozodb-pain-points-reference.md) | CozoDB gotchas and lessons learned |
| [specs/spec.md](specs/spec.md) | System architecture overview |
| [engine/src/read_all.js](engine/src/read_all.js) | Corpus flattening tool source |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Search returns "No results" | Check if FTS index exists: `curl http://localhost:3030/v1/admin/stats` |
| Search returns garbage | Run cleanup: `curl -X DELETE http://localhost:3030/v1/admin/cleanup-bulk` |
| Files not ingesting | Check watcher is running and file is in `context/` directory |
| Backup not loading | Ensure backup file is in `backups/` with correct YAML format |
