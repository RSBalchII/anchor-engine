/**
 * Rolling Context Slicer - Context Budgeting for Search Results
 *
 * Implements "Middle-Out" Context Budgeting with Structured Graph Output.
 * Prioritizes atoms based on a mix of Relevance (Vector Similarity) and Recency.
 *
 * Strategy:
 * 1. Rank Candidates: Score = (Relevance * 0.7) + (Recency * 0.3).
 * 2. Select: Fill budget with highest ranked atoms.
 * 3. Smart Slice: If an atom fits partially, slice around the keyword match (windowing).
 * 4. Order: Sort selected atoms Chronologically (or by Sequence) for linear readability.
 */

import { config } from '../../config/index.js';

interface SearchResult {
  id: string;
  content: string;
  source: string;
  timestamp: number;
  tags: string[];
  provenance: string;
  score: number;
  type?: string;
}

interface ContextCompositionResult {
  prompt: string;
  stats: {
    tokenCount: number;
    charCount: number;
    filledPercent: number;
    atomCount: number;
  };
}

export function composeRollingContext(
  query: string,
  results: SearchResult[],
  tokenBudget: number = 4096
): ContextCompositionResult {
  // Constants
  const CHARS_PER_TOKEN = 4; // Rough estimate
  // Safety Buffer: Target 95% of budget to account for multibyte chars / math errors
  const SAFE_BUDGET = Math.floor(tokenBudget * 0.95);
  const charBudget = SAFE_BUDGET * CHARS_PER_TOKEN;

  // 1. Dynamic Recency Analysis
  // Check for temporal signals in query
  const temporalSignals = ["recent", "latest", "new", "today", "now", "current", "last"];
  const hasTemporalSignal = temporalSignals.some(signal => query.toLowerCase().includes(signal));

  // Adjust weights based on intent
  // Default: Relevance 70%, Recency 30%
  // Temporal: Relevance 40%, Recency 60%
  const RELEVANCE_WEIGHT = hasTemporalSignal ? 0.4 : config.CONTEXT_RELEVANCE_WEIGHT;
  const RECENCY_WEIGHT = hasTemporalSignal ? 0.6 : config.CONTEXT_RECENCY_WEIGHT;

  // 2. Normalize Recency & Score
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000;

  const candidates = results.map(atom => {
    const atomTimestamp = typeof atom.timestamp === 'number' && !isNaN(atom.timestamp)
      ? atom.timestamp
      : now;
    const age = Math.max(0, now - atomTimestamp);
    // Recency Score: 1.0 = Brand new, 0.0 = >1 Month old (clamped)
    const recencyScore = Math.max(0, 1.0 - (age / oneMonth));
    // Final Mixed Score
    const mixedScore = (atom.score * RELEVANCE_WEIGHT) + (recencyScore * RECENCY_WEIGHT);
    return { ...atom, timestamp: atomTimestamp, mixedScore, recencyScore };
  });

  // 3. Sort by Mixed Score (Descending)
  candidates.sort((a, b) => b.mixedScore - a.mixedScore);

  // 4. Selection (Fill Budget)
  const selectedAtoms: (SearchResult & { mixedScore: number; recencyScore: number })[] = [];
  let currentChars = 0;

  for (const atom of candidates) {
    if (currentChars >= charBudget) break;

    const atomLen = atom.content.length;
    if (currentChars + atomLen <= charBudget) {
      selectedAtoms.push(atom);
      currentChars += atomLen;
    } else {
      // Partial Fill with Smart Slicing
      const remaining = charBudget - currentChars;
      if (remaining > 200) {
        // Slice to nearest punctuation to keep thought intact
        const safeContent = atom.content.substring(0, remaining);
        // Find last punctuation before the hard limit
        const lastDot = safeContent.lastIndexOf('.');
        const lastBang = safeContent.lastIndexOf('!');
        const lastQ = safeContent.lastIndexOf('?');
        const lastNew = safeContent.lastIndexOf('\n');
        const bestCut = Math.max(lastDot, lastBang, lastQ, lastNew);

        if (bestCut > (remaining * 0.5)) {
          // If punctuation is reasonably far in, use it
          const slicedContent = atom.content.substring(0, bestCut + 1) + " [Truncated]";
          selectedAtoms.push({ ...atom, content: slicedContent });
          currentChars += slicedContent.length;
        } else {
          // Fallback to hard cut if no punctuation found nearby
          const slicedContent = atom.content.substring(0, remaining) + "...";
          selectedAtoms.push({ ...atom, content: slicedContent });
          currentChars += slicedContent.length;
        }
      }
      break; // Filled
    }
  }

  // 5. Final Sort (Chronological / Flow)
  // Preservation of narrative flow is key.
  selectedAtoms.sort((a, b) => a.timestamp - b.timestamp);

  // 6. Assemble JSON Graph (Neuro-Symbolic Output)
  const graphNodes = selectedAtoms.map(a => ({
    id: a.id,
    type: a.type || 'thought',
    content: a.content,
    meta: {
      score: Number(a.mixedScore.toFixed(3)),
      tags: a.tags || [],
      source: a.source,
      timestamp: (() => {
        try {
          return new Date(a.timestamp).toISOString();
        } catch (e) {
          return new Date().toISOString();
        }
      })(),
      provenance: a.provenance || 'internal'
    }
  }));

  const graph = {
    intent: query,
    nodes: graphNodes
  };

  const jsonString = JSON.stringify(graph, null, 2);

  // Wrap with the Neuro-Symbolic Directive
  const promptWrapper = `Here is a graph of thoughts from my memory, ranked by mathematical relevance (Time + Logic). Use these nodes to answer my question. Do not use outside knowledge unless necessary.\n\n\`\`\`json\n${jsonString}\n\`\`\``;

  return {
    prompt: promptWrapper,
    stats: {
      tokenCount: Math.ceil(currentChars / CHARS_PER_TOKEN),
      charCount: currentChars,
      filledPercent: Math.min(100, (currentChars / charBudget) * 100),
      atomCount: selectedAtoms.length
    }
  };
}
