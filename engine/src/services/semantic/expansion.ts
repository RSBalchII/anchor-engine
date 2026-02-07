/**
 * Deterministic Semantic Expansion Service
 * 
 * Emulates embedding-style semantic matching using static lookup tables:
 * 1. Synonym Ring - WordNet-lite mappings
 * 2. Phonetic Hash - Metaphone for typo tolerance (future)
 * 
 * Deterministic Semantic Expansion Protocol (see project standards documentation)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ExpansionResult {
    original: string;
    synonyms: string[];
    hypernyms: string[];
    phoneticHash?: string;
}

// In-memory synonym ring
let synonymRing: Record<string, string[]> = {};
let reverseIndex: Record<string, string[]> = {}; // Maps synonyms back to canonical terms
let isLoaded = false;

/**
 * Load the synonym ring from JSON file
 */
export function loadSynonymRing(customPath?: string): boolean {
    const defaultPaths = [
        // Source runtime: engine/src/services/semantic -> engine/data/synonyms.json
        join(__dirname, '../../../data/synonyms.json'),
        // Dist runtime: engine/dist/services/semantic -> engine/data/synonyms.json
        join(__dirname, '../../data/synonyms.json'),
    ];

    const ringPath =
        customPath ||
        defaultPaths.find((p) => existsSync(p)) ||
        defaultPaths[0];
    try {
        if (!existsSync(ringPath)) {
            console.warn(`[SemanticExpansion] Synonym ring not found at: ${ringPath}`);
            return false;
        }

        const data = readFileSync(ringPath, 'utf-8');
        synonymRing = JSON.parse(data);

        // Build reverse index for bidirectional lookup
        reverseIndex = {};
        for (const [canonical, synonyms] of Object.entries(synonymRing)) {
            for (const syn of synonyms) {
                if (!reverseIndex[syn.toLowerCase()]) {
                    reverseIndex[syn.toLowerCase()] = [];
                }
                reverseIndex[syn.toLowerCase()].push(canonical);
            }
        }

        const termCount = Object.keys(synonymRing).length;
        console.log(`[SemanticExpansion] Loaded synonym ring: ${termCount} terms`);
        isLoaded = true;
        return true;
    } catch (e) {
        console.error('[SemanticExpansion] Failed to load synonym ring:', e);
        return false;
    }
}

/**
 * Expand a single term to its semantic equivalents
 */
export function expandTerm(term: string): ExpansionResult {
    const normalized = term.toLowerCase().trim();

    const result: ExpansionResult = {
        original: term,
        synonyms: [],
        hypernyms: [],
    };

    // Lazy load
    if (!isLoaded) {
        loadSynonymRing();
    }

    // 1. Direct synonym lookup (canonical → synonyms)
    if (synonymRing[normalized]) {
        result.synonyms = [...synonymRing[normalized]];
    }

    // 2. Reverse lookup (synonym → canonicals)
    if (reverseIndex[normalized]) {
        for (const canonical of reverseIndex[normalized]) {
            if (!result.synonyms.includes(canonical)) {
                result.synonyms.push(canonical);
            }
            // Also add other synonyms of the canonical term
            if (synonymRing[canonical]) {
                for (const s of synonymRing[canonical]) {
                    if (s.toLowerCase() !== normalized && !result.synonyms.includes(s)) {
                        result.synonyms.push(s);
                    }
                }
            }
        }
    }

    return result;
}

/**
 * Expand multiple terms (from a parsed query)
 */
export function expandTerms(terms: string[]): string[] {
    const expanded = new Set<string>();

    for (const term of terms) {
        expanded.add(term);
        const result = expandTerm(term);
        result.synonyms.forEach(s => expanded.add(s.toLowerCase()));
    }

    return Array.from(expanded);
}

/**
 * Expand a query string and return expanded version
 */
export function expandQuery(query: string): string {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const expanded = expandTerms(words);
    return expanded.join(' ');
}

/**
 * Get expansion tags for ingestion (prefixed with #syn:)
 */
export function getExpansionTags(content: string): string[] {
    const tags: string[] = [];
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const seen = new Set<string>();

    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (clean.length < 3 || seen.has(clean)) continue;
        seen.add(clean);

        const result = expandTerm(clean);
        for (const syn of result.synonyms.slice(0, 3)) { // Limit to 3 per term
            tags.push(`#syn:${syn.toLowerCase()}`);
        }
    }

    // Deduplicate and limit total
    return [...new Set(tags)].slice(0, 20);
}

/**
 * Check if synonym ring is loaded
 */
export function isExpansionReady(): boolean {
    return isLoaded && Object.keys(synonymRing).length > 0;
}
