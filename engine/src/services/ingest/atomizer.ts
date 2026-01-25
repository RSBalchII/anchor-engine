import { createRequire } from 'module';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// HELPER: Resolves native binary paths based on environment
const getNativePath = (filename: string) => {
    // 1. Production Mode (Packaged Electron App)
    // In Electron, external resources live in: resources/bin/
    if (process.env['NODE_ENV'] === 'production' || (typeof process !== 'undefined' && (process as any).type === 'browser')) {
        // Note: 'process.resourcesPath' is available in Electron Main process
        // If in Node child process, you might need to pass this path via ENV
        const basePath = (process as any).resourcesPath || (typeof process !== 'undefined' ? path.dirname((process as any).execPath) : '');
        if (basePath) {
            return path.join(basePath, 'resources', 'bin', filename);
        }
    }

    // 2. Development Mode
    // Relative path from this file to the binary
    return path.resolve(__dirname, '../../../build/Release', filename);
};

// --- NATIVE MODULE LOADING ---
let native: any = null;
try {
    const nativePath = getNativePath('ece_native.node');
    const { createRequire } = require('module');
    native = createRequire(__filename)(nativePath);
    console.log('[Atomizer] Native Iron Lung engaged 🫁');
} catch (e) {
    try {
        // Try debug build or other path
        const debugPath = getNativePath('ece_native.node').replace('Release', 'Debug');
        const { createRequire } = require('module');
        native = createRequire(__filename)(debugPath);
        console.log('[Atomizer] Loaded Native Accelerator (Debug Build)');
    } catch (e2: any) {
        console.warn('[Atomizer] Legacy Mode. Native path failed:', e2.message);
    }
}

export function atomizeContent(text: string, strategy: 'code' | 'prose' | 'blob' = 'prose'): string[] {
    // NATIVE ACCELERATION
    if (native && native.atomize && strategy !== 'blob') {
        try {
            const nativeAtoms = native.atomize(text, strategy);
            // Fallback if native returns empty on valid text (safety)
            if (nativeAtoms.length > 0 || text.trim().length === 0) {
                return nativeAtoms;
            }
        } catch (e) {
            console.error('[Atomizer] Native Error:', e);
            // Fallthrough to JS
        }
    }

    // Strategy: Code - Split by top-level blocks (indentation-based)
    if (strategy === 'code') {
        const lines = text.split('\n');
        const atoms: string[] = [];
        let currentChunk = '';

        // Helper to push and reset
        const pushChunk = () => {
            if (currentChunk.trim().length > 0) {
                atoms.push(currentChunk.trim());
                currentChunk = '';
            }
        };

        for (const line of lines) {
            // Check for top-level definitions (no indentation or specific keywords)
            // Regex checks for: Starts with non-whitespace, AND isn't a closing brace only
            const isTopLevel = /^[^\s]/.test(line) && !/^[\}\] \t]*$/.test(line);

            // If it's a new top-level block AND we have a substantial chunk, split.
            // But don't split if the current chunk is small (< 500 chars) to keep related imports/vars together.
            if (isTopLevel && currentChunk.length > 500) {
                pushChunk();
            }

            // Hard limit safety valve (2000 chars)
            if ((currentChunk + line).length > 2000) {
                pushChunk();
            }

            currentChunk += line + '\n';
        }
        pushChunk();
        return enforceMaxSize(atoms, 6000, 200);
    }

    if (strategy === 'blob') {
        // Just hard split every 1500 chars with overlap to be extremely safe for dense/binary text
        return enforceMaxSize([text], 1500, 100);
    }

    // 1. Primary Split: Logical Blocks (Paragraphs)
    // This preserves the "Thought" unit.
    const rawBlocks = text.split(/\n\s*\n/);

    const atoms: string[] = [];

    for (const block of rawBlocks) {
        if (block.trim().length === 0) continue;

        // 2. Secondary Split: Length Constraint (800 chars)
        // If a paragraph is massive, we chop it by sentence.
        if (block.length > 800) {
            // Split by sentence endings (. ! ? ) followed by space or end of string
            const sentences = block.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [block];

            let currentChunk = "";

            for (const sentence of sentences) {
                if ((currentChunk + sentence).length > 800) {
                    if (currentChunk.trim().length > 0) {
                        atoms.push(currentChunk.trim());
                    }

                    // OVERLAP: Keep the last sentence as the start of the new chunk
                    // This creates the "Markov Link"
                    const sentenceParts = currentChunk.match(/[^.!?]+[.!?]+(\s+|$)/g);
                    let lastSentence = "";
                    if (sentenceParts && sentenceParts.length > 0) {
                        lastSentence = sentenceParts[sentenceParts.length - 1];
                    }

                    currentChunk = lastSentence + sentence;
                } else {
                    currentChunk += sentence;
                }
            }
            if (currentChunk.trim().length > 0) {
                atoms.push(currentChunk.trim());
            }
        } else {
            // Small block = 1 Atom
            atoms.push(block.trim());
        }
    }

    // FINAL PASS: Strict Size Enforcement
    // Ensure no atom exceeds the hard limit (6000 chars), splitting strictly if needed.
    return enforceMaxSize(atoms, 6000, 200);
}

/**
 * Splits atoms that exceed the maxSize into smaller overlapping chunks.
 */
function enforceMaxSize(atoms: string[], maxSize: number, overlap: number): string[] {
    const result: string[] = [];
    for (const atom of atoms) {
        if (atom.length <= maxSize) {
            result.push(atom);
        } else {
            // Hard split with overlap
            let i = 0;
            while (i < atom.length) {
                const end = Math.min(i + maxSize, atom.length);
                const chunk = atom.substring(i, end);
                result.push(chunk);

                // If we reached the end, stop
                if (end >= atom.length) break;

                // Move forward by maxSize - overlap (so we back up a bit for the next chunk)
                i += (maxSize - overlap);
            }
        }
    }
    return result;

}
