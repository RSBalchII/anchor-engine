
const userSnippet = `- [2025-08-06T15:31:40.000Z] \\\\Projects\\\\ECE\_Core\\\\context\\\\Coding-Notes\\\\Notebook\\\\history\\\\rob-specific\\\\Job-Context\\\\SDG.md''... Processing ''C:\\\\Users\\\\rsbiiw\\\\Projects\\\\ECE\_Core\\\\context\\\\Coding-Notes\\\\Notebook\\\\history\\\\rob-specific\\\\Job-Context\\\\Sandia-Labs-Action-Plan.md''...`;

function sanitize(text: string): string {
    let clean = text;

    // 1. Fundamental Normalization
    clean = clean.replace(/^\uFEFF/, '').replace(/[\u0000\uFFFD]/g, '');
    clean = clean.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n');

    // 2. Enhanced Surgeon: Log Spam Removal
    clean = clean.replace(/(?:^|\s|\.{3}\s*)Processing '[^']+'\.{3}/g, '\n');
    clean = clean.replace(/(?:^|\s|\.{3}\s*)Loading '[^']+'\.{3}/g, '\n');
    clean = clean.replace(/(?:^|\s|\.{3}\s*)Indexing '[^']+'\.{3}/g, '\n');
    clean = clean.replace(/(?:^|\s|\.{3}\s*)Analyzing '[^']+'\.{3}/g, '\n');

    // Strip Log Timestamps (at start of lines)
    clean = clean.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?\s*(?:AM|PM)?\s*[-:>]/gm, '');

    // Strip bracketed metadata like [2026-01-25...]
    clean = clean.replace(/\[\d{4}-\d{2}-\d{2}.*?\]/g, '');

    // Test the specific timestamp format from user
    // The user has: [2025-08-06T15:31:40.000Z]
    // The regex above: \[\d{4}-\d{2}-\d{2}.*?\]  <-- This *should* match it.

    return clean.trim();
}

console.log("Original:");
console.log(userSnippet);
console.log("\nSanitized:");
console.log(sanitize(userSnippet));

if (sanitize(userSnippet).length < userSnippet.length * 0.5) {
    console.log("\n✅ SUCCESS: Significantly reduced content (likely stripped).");
} else {
    console.log("\n❌ FAIL: Content remains largely intact.");
}
