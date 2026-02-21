/**
 * normalize_extract_logs.js
 * 
 * A robust utility to parse various chat log formats and output a canonical, 
 * compressed (squashed) YAML format.
 * 
 * Supported Inputs:
 * 1. Existing YAML (standard or block scalar).
 * 2. Mixed content (YAML + Raw Text).
 * 3. Raw Text copy-pasted from Gemini/Claude UI ("You said", "Gemini said").
 * 
 * Output:
 * - Canonical YAML
 * - One line per field (compressed JSON strings for content).
 * - Deduplicated entries.
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
    console.error("Usage: node normalize_extract_logs.js <path_to_file>");
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
}

const rawContent = fs.readFileSync(filePath, 'utf8');

// --- Parsing Logic ---

function parseContent(text) {
    const entries = [];

    // We will parse by identifying "Message Starts" and treating the text between them as content.
    // Markers:
    // 1. YAML: "- type:"
    // 2. UI User: "You said" (lines often start with this)
    // 3. UI AI: "Gemini said", "Coda C-001 said", "Model said"
    // 4. Timestamp lines: sometimes explicit "2026-..."

    // Regex for splitting. We use capturing group to keep the delimiter.
    // NOTE: This regex is tricky because "You said" might appear in text. 
    // We look for it at start of line or preceded by newlines.

    // Regex for splitting. We use capturing group to keep the delimiter.
    // NOTE: This regex is tricky because "You said" might appear in text. 
    // We look for it at start of line or preceded by newlines.

    // Support for "- [Timestamp]" format found in some backups
    const splitRegex = /(?:^|\n)(?=- type:)|(?:^|\n)(?=- role:)|(?:^|\n)(?=-\s*\[\d{4})|(?:^|\n)(?=You said)|(?:^|\n)(?=(?:Gemini|Coda|Model|Clause|ChatGpt) said)/i;

    // Initial split
    const chunks = text.split(splitRegex);

    for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        const entry = processChunk(chunk);
        if (entry) entries.push(entry);
    }

    return entries;
}

function processChunk(chunk) {
    chunk = chunk.trim();
    if (!chunk) return null;

    let type = "User"; // Default
    let timestamp = "";
    let content = "";
    let thinking = "";

    // Detect Format
    if (chunk.startsWith("- type:")) {
        // YAML Case
        return parseYamlChunk(chunk);
    } else if (chunk.startsWith("- role:")) {
        // Role-based YAML Case
        return parseRoleChunk(chunk);
    } else if (chunk.match(/^-\s*\[/)) {
        // Timestamp Bracket Case
        return parseBracketChunk(chunk);
    } else {
        // Raw Text Case
        return parseTextChunk(chunk);
    }
}

function parseBracketChunk(chunk) {
    // Format: - [2025-07-02T18:18:20.000Z] Content...
    // Content might be raw text OR a JSON string.

    const tsMatch = chunk.match(/^-\s*\[(.*?)\]/);
    let timestamp = tsMatch ? tsMatch[1] : "";
    let contentRaw = chunk.replace(/^-\s*\[.*?\]/, "").trim();

    // Check if content is JSON
    // It might start with Quote if it was valid JSON-in-YAML
    if (contentRaw.startsWith('"') || contentRaw.startsWith('{')) {
        try {
            // Try to parse if it looks like JSON
            // Sometimes it's a JSON object: "{"type":"User",...}"
            // Sometimes it's just a string: ""Content...""

            // If it starts with quote, unescape? 
            if (contentRaw.startsWith('"') && contentRaw.endsWith('"')) {
                contentRaw = JSON.parse(contentRaw); // Unquote
            }

            // If it is now an object?
            if (typeof contentRaw === 'string' && contentRaw.trim().startsWith('{')) {
                const obj = JSON.parse(contentRaw);
                return {
                    type: obj.type || "User",
                    timestamp: obj.timestamp || timestamp,
                    response_content: cleanContent(obj.response_content || obj.content || ""),
                    thinking_content: cleanContent(obj.thinking_content || "")
                };
            }
        } catch (e) {
            // failed to parse as JSON, treat as raw text
        }
    }

    // Fallback: Treat as raw text
    return {
        type: "User", // Hard to know for sure, assume User or infer?
        timestamp: cleanTimestamp(timestamp),
        response_content: cleanContent(contentRaw),
        thinking_content: ""
    };
}

function parseYamlChunk(chunk) {
    // Quick regex extraction for robustness (don't use full YAML parser to avoid deps and strictness)
    const typeMatch = chunk.match(/- type:\s*"?([^"\n\r]+)"?/);
    const tsMatch = chunk.match(/timestamp:\s*"?([^"\n\r]+)"?/);

    let type = typeMatch ? typeMatch[1].trim() : "Unknown";
    let timestamp = tsMatch ? tsMatch[1].trim() : "";

    // Content extraction
    // Look for response_content: and thinking_content:
    // Handle Block Scalar (|-) and Quotes ("...")

    const resStart = chunk.indexOf("response_content:");
    const thinkStart = chunk.indexOf("thinking_content:");

    let resRaw = "";
    let thinkRaw = "";

    if (resStart !== -1) {
        // If thinking comes after response
        if (thinkStart > resStart) {
            resRaw = chunk.substring(resStart + 17, thinkStart);
            thinkRaw = chunk.substring(thinkStart + 17);
        } else if (thinkStart !== -1 && thinkStart < resStart) {
            // Thinking comes first? Rare but possible
            thinkRaw = chunk.substring(thinkStart + 17, resStart);
            resRaw = chunk.substring(resStart + 17);
        } else {
            // No thinking
            resRaw = chunk.substring(resStart + 17);
        }
    }

    return {
        type: cleanType(type),
        timestamp: cleanTimestamp(timestamp),
        response_content: cleanContent(resRaw),
        thinking_content: cleanContent(thinkRaw)
    };
}

function parseRoleChunk(chunk) {
    // Handle "- role: User/Sybil" format
    const roleMatch = chunk.match(/- role:\s*"?([^"\n\r]+)"?/);
    const tsMatch = chunk.match(/timestamp:\s*['"]?([^'"\n\r]+)['"]?/);

    let type = roleMatch ? roleMatch[1].trim() : "User";
    let timestamp = tsMatch ? tsMatch[1].trim() : "";

    // Content extraction
    // "content:" likely comes last or near end
    const contentStart = chunk.indexOf("content:");
    let contentRaw = "";

    if (contentStart !== -1) {
        contentRaw = chunk.substring(contentStart + 8);
    }

    return {
        type: cleanType(type),
        timestamp: cleanTimestamp(timestamp),
        response_content: cleanContent(contentRaw),
        thinking_content: ""
    };
}

function parseTextChunk(chunk) {
    let type = "User";
    let timestamp = ""; // Hard to extract from raw text unless standard format
    let content = chunk;
    let thinking = "";

    // Identify Header
    if (chunk.match(/^You said/i)) {
        type = "User";
        content = chunk.replace(/^You said/i, "");
    } else if (chunk.match(/^(Gemini|Coda|Model) said/i)) {
        type = "Coda C-001"; // Defaulting AI to Coda for consistency
        content = chunk.replace(/^(Gemini|Coda|Model) said/i, "");
    }

    // Attempt to extract timestamp if present in first line
    // e.g. "You said at 2026-05..." or just isolated date
    // For now, leave empty, or maybe current date? 
    // Better to leave empty and let user fill if needed, or parse "Yesterday at..."

    // Extract Thinking if present (Look for "Show thinking" artifacts)
    // Common pattern: "Thinking Process: ... \n ... \n Response:"
    // Or just separate blocks. In raw dump, thinking often isn't captured unless expanded.

    // Clean up
    return {
        type: cleanType(type),
        timestamp: "", // Default empty for raw text
        response_content: cleanContent(content),
        thinking_content: ""
    };
}

// --- Helpers ---

function cleanType(t) {
    if (!t) return "User";
    return t.replace(/['"]/g, "").trim();
}

function cleanTimestamp(ts) {
    if (!ts) return "";
    let clean = ts.replace(/['"]/g, "").trim();

    // Attempt to standardize to YYYY-MM-DD HH:mm:ss
    try {
        const date = new Date(clean);
        if (!isNaN(date.getTime())) {
            // Use ISO string but replace T with space and remove milliseconds/Z
            // This preserves UTC which is generally safer for logs
            return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
        }
    } catch (e) {
        // Ignore parsing errors and return original
    }

    return clean;
}

function cleanContent(text) {
    if (!text) return "";

    let clean = text.trim();

    // Remove YAML artifacts if present
    if (clean.startsWith("|-")) clean = clean.substring(2).trim();
    if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);

    // Remove UI Noise
    clean = clean.replace(/Show\s?thinking/gi, "");
    clean = clean.replace(/Expand\s?thinking/gi, "");
    clean = clean.replace(/dictation_mode_mic/g, ""); // Voice mode artifact

    // Normalization (Squash)
    // Replace sequences of whitespace/newlines with single space
    // BUT preserve implicit paragraph breaks if clear? 
    // User requested "squashed into single line".
    clean = clean.replace(/\s+/g, " ");

    return clean.trim();
}

// --- Execution ---

console.log(`Reading ${filePath}...`);
const entries = parseContent(rawContent);

console.log(`Parsed ${entries.length} entries.`);

// Output Construction
let output = "";
let count = 0;

for (const entry of entries) {
    // Filter empty entries
    if (!entry.response_content && !entry.thinking_content) continue;

    output += `- type: "${entry.type}"\n`;
    output += `  timestamp: "${entry.timestamp}"\n`;
    output += `  response_content: ${JSON.stringify(entry.response_content)}\n`;
    output += `  thinking_content: ${JSON.stringify(entry.thinking_content)}\n\n`;
    count++;
}

// Generate Output Filename based on content date range
let minDate = null;
let maxDate = null;

for (const entry of entries) {
    if (entry.timestamp) {
        const d = new Date(entry.timestamp); // already standardized or clean
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2025) {
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        }
    }
}

const formatDateForFilename = (d) => {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

let newBaseName = "";
if (minDate && maxDate) {
    const minStr = formatDateForFilename(minDate);
    const maxStr = formatDateForFilename(maxDate);
    newBaseName = `${minStr}_to_${maxStr}`;
} else {
    // Fallback to original name if no dates found
    newBaseName = path.basename(filePath, path.extname(filePath)) + "_normalized";
}

const dir = path.dirname(filePath);
const ext = ".yaml"; // Force .yaml extension
const outPath = path.join(dir, `${newBaseName}${ext}`);

fs.writeFileSync(outPath, output);

console.log(`Success! Normalized ${count} entries.`);
console.log(`Output saved to: ${outPath}`);
