
const userSnippet = `- [2025-08-06T15:31:40.000Z] \\\\Projects\\\\ECE\_Core\\\\context\\\\Coding-Notes\\\\Notebook\\\\history\\\\rob-specific\\\\Job-Context\\\\SDG.md''... Processing ''C:\\\\Users\\\\rsbiiw\\\\Projects\\\\ECE\_Core\\\\context\\\\Coding-Notes\\\\Notebook\\\\history\\\\rob-specific\\\\Job-Context\\\\Sandia-Labs-Action-Plan.md''...`;

function sanitize(text) {
    let clean = text;

    // 1. Fundamental Normalization
    clean = clean.replace(/^\uFEFF/, '').replace(/[\u0000\uFFFD]/g, '');
    clean = clean.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n');

    // NEW ROBUST REGEX
    // Matches: Start/Newline, optional dash, timestamp bracket, anything, "Processing", anything, newline/end
    const logRegex = /(?:^|\n)\s*-\s*\[\d{4}-\d{2}-\d{2}.*?\].*?Processing.*?(?:\n|$)/gi;

    clean = clean.replace(logRegex, '\n');

    return clean.trim();
}

console.log("Original:");
console.log(userSnippet);
console.log("\nSanitized:");
const result = sanitize(userSnippet);
console.log(result);

if (result.length < userSnippet.length * 0.1) {
    console.log("\n✅ SUCCESS: Content stripped.");
} else {
    console.log("\n❌ FAIL: Content remains.");
    console.log("Length:", result.length);
}
