# Session Management Scripts

This directory contains scripts used to extract, normalize, and prepare session logs for ingestion into **Anchor OS**.

## Workflow Overview

1.  **Extract**: Capture chat history from the Gemini web interface using `extract-chats-gemini.js`.
2.  **Normalize**: Standardize formats, timestamps, and filenames using `normalize_extract_logs.js`.
3.  **Ingest**: Place normalized files in `sessions/raws` for Anchor OS to automatically process.

---

## Scripts

### 1. `extract-chats-gemini.js` (Extraction)

**Purpose**: Extracts chat content (user and model messages) from the Google Gemini web interface.

**Usage**:
1.  Open your Gemini chat in the browser.
2.  Scroll to load the full valid history you wish to capture.
3.  Open Developer Tools (F12) -> Console.
4.  Paste the contents of `extract-chats-gemini.js` and press Enter.
5.  Wait for the script to finish. It will trigger a download of a `.json` or `.yaml` file.
6.  Save this file to your `sessions/raws` directory.

---

### 2. `normalize_extract_logs.js` (Normalization)

**Purpose**: Cleans raw export files, standardizes timestamps to `YYYY-MM-DD HH:mm:ss`, and renames files based on the chronological range of their content (e.g., `2025-05-20_to_2025-05-22.yaml`).

**Features**:
*   Converts JSON/raw YAML to a clean, strict YAML format (`- type: ...` or `- role: ...`).
*   Parses various timestamp formats (ISO, spoken English, etc.) into standard SQL-compatible format.
*   Renames the file to match the `MinDate_to_MaxDate` found in the content.
*   Preserves all data while fixing formatting issues.

**Usage**:
Run via Node.js:
```bash
node normalize_extract_logs.js <path-to-file>
```

**Batch Processing (PowerShell)**:
To process all files in the `sessions/raws` directory:
```powershell
$files = Get-ChildItem -Path "../raws" -Include *.yaml,*.json -Recurse
$files | ForEach-Object { node normalize_extract_logs.js $_.FullName }
```

---

## Integration with Anchor OS

Once files are normalized:

1.  **Placement**: Ensure the resulting `.yaml` files are in `../raws` (or the configured ingestion watch path for Anchor OS).
2.  **Ingestion**: Anchor OS's `FileSystemWatcher` will detect the new/updated files.
3.  **Processing**: 
    *   The **Atomizer** breaks down the linear log into semantic atomic units.
    *   The **STAR Algorithm** (Spatial-Temporal Associative Retrieval) indexes them, handling topic extraction and semantic linkage internally.
    *   No separate "topic extraction" script is needed; Anchor OS handles this dynamically during ingestion.
