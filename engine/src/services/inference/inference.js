/**
 * Inference Service - Local LLM Integration
 * * Provides local inference using node-llama-cpp with GGUF models.
 * Implements Context Weaving and robust Semantic Intent Translation.
 */

const fs = require("fs");
const path = require("path");
const { MODELS_DIR } = require("../../config/paths");

const DEFAULT_MODEL =
  "Qwen3-4B-Thinking-2507-Gemini-3-Pro-Preview-High-Reasoning-Distill-Heretic-Abliterated.i1-Q4_K_S.gguf";

let llama = null;
let model = null;
let context = null;
let session = null;
let currentModelName = "";
let currentCtxSize = 4096;

/**
 * Get list of available GGUF model files
 */
function listModels() {
  try {
    if (!fs.existsSync(MODELS_DIR)) {
      console.warn(`Models directory not found: ${MODELS_DIR}`);
      return [];
    }
    const models = fs
      .readdirSync(MODELS_DIR)
      .filter((f) => f.endsWith(".gguf"));
    return models;
  } catch (e) {
    console.error("Error listing models:", e.message);
    return [];
  }
}

async function getLlamaInstance() {
  if (!llama) {
    const llamaModule = await import("node-llama-cpp");
    llama = await llamaModule.getLlama();
  }
  return llama;
}

async function loadModel(modelName, options = {}) {
  if (modelName === currentModelName && session) {
    return { status: "ready", message: "Model already loaded" };
  }

  console.log(`🧠 Loading Model: ${modelName}`);
  const l = await getLlamaInstance();

  session = null;
  context = null;
  model = null;

  try {
    const modelPath = path.join(MODELS_DIR, modelName);
    if (!fs.existsSync(modelPath))
      throw new Error(`Model not found: ${modelName}`);

    model = await l.loadModel({
      modelPath: modelPath,
      gpu: false, // Keep false for stability on your rig
    });

    try {
      context = await model.createContext({
        contextSize: parseInt(options.ctxSize) || 4096,
        batchSize: parseInt(options.batchSize) || 512,
      });
    } catch (ctxError) {
      if (ctxError.message.includes("VRAM")) {
        throw new Error("VRAM Exhausted: Try reducing Context Size.");
      }
      throw ctxError;
    }

    const { LlamaChatSession } = await import("node-llama-cpp");
    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt:
        options.systemPrompt ||
        "You are a helpful AI assistant connected to the Anchor Context Engine.",
    });

    currentModelName = modelName;
    currentCtxSize = parseInt(options.ctxSize) || 4096;
    return { status: "success", message: `Loaded ${modelName}` };
  } catch (e) {
    console.error("Model Load Error:", e);
    throw e;
  }
}

async function initInference() {
  if (session) return session;
  const models = listModels();
  const modelToLoad = models.includes(DEFAULT_MODEL)
    ? DEFAULT_MODEL
    : models[0];
  if (!modelToLoad) throw new Error(`No models found in ${MODELS_DIR}.`);
  await loadModel(modelToLoad);
  return session;
}

// --- CORE UTILITIES ---

async function rawCompletion(text, options = {}) {
  try {
    const s = await initInference();
    return await s.prompt(text, {
      temperature: parseFloat(options.temperature) || 0.1,
      maxTokens: parseInt(options.maxTokens) || 200,
    });
  } catch (e) {
    console.error("Raw completion error:", e.message);
    throw e;
  }
}

async function chat(messages, generationOptions = {}, onToken = null) {
  try {
    const s = await initInference();
    let contextParts = [];

    try {
      const { getState } = require("../scribe/scribe");
      const state = await getState();
      if (state && state.trim()) {
        contextParts.push(`[SESSION STATE]\n${state}\n[/SESSION STATE]`);
      }
    } catch (e) {}

    const lastMsg = messages[messages.length - 1]?.content || "";
    let augmentedMsg = lastMsg;
    if (contextParts.length > 0) {
      augmentedMsg = contextParts.join("\n\n") + "\n\n" + lastMsg;
    }

    const response = await s.prompt(augmentedMsg, {
      temperature: parseFloat(generationOptions.temperature) || 0.7,
      maxTokens: parseInt(generationOptions.maxTokens) || 1024,
      onToken: onToken
        ? (chunks) => {
            if (model) onToken(model.detokenize(chunks));
          }
        : undefined,
    });

    return response;
  } catch (e) {
    console.error("Chat error:", e.message);
    return `[Error] ${e.message}`;
  }
}

// --- THE EYE: SEMANTIC INTENT ---

/**
 * Translates natural language into Optimized Keyword Queries.
 * Uses Temporal Grounding to resolve "last week" etc.
 */
async function translateIntent(userQuery) {
  const s = await initInference();

  // 1. Get Current Time for Grounding
  const now = new Date();
  const temporalContext = `Current Date: ${now.toISOString().split("T")[0]} (${now.toLocaleDateString("en-US", { weekday: "long" })})`;

  // 2. Fetch existing buckets for hints
  let knownBuckets = "['core', 'dev', 'personal', 'obsidian']";
  try {
    const { db } = require("../../core/db");
    const res = await db.run('?[b] := *memory{buckets}, b != "pending"');
    const buckets = [...new Set(res.rows.flat())].slice(0, 15);
    if (buckets.length > 0) knownBuckets = JSON.stringify(buckets);
  } catch (e) {}

  const systemPrompt = `You are a Search Optimizer.
${temporalContext}
Known Buckets: ${knownBuckets}

Task: Convert the User Query into a JSON object.
1. "query": Extract 3-5 keywords. Remove stopwords (I, me, want, find, etc).
2. "buckets": Infer 1-2 relevant buckets from the Known Buckets list.
3. "strategy": "precise" for code/IDs, "broad" for concepts.

User Query: "${userQuery}"

JSON Output:`;

  try {
    const response = await s.prompt(systemPrompt, {
      temperature: 0.1, // Low temp for deterministic JSON
      maxTokens: 150,
    });

    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      // Safety Check: If query is empty, fallback
      if (
        !parsed.query ||
        (typeof parsed.query === "string" && parsed.query.length < 2) ||
        (Array.isArray(parsed.query) && parsed.query.join(" ").length < 2)
      ) {
        throw new Error("Empty translation");
      }

      // Handle case where query is returned as an array by the LLM
      let finalQuery = parsed.query;
      if (Array.isArray(parsed.query)) {
        finalQuery = parsed.query.join(" ");
      } else if (typeof parsed.query !== "string") {
        finalQuery = String(parsed.query);
      }

      return {
        query: finalQuery,
        buckets: Array.isArray(parsed.buckets)
          ? parsed.buckets
          : parsed.buckets || ["core"],
        strategy: parsed.strategy || "broad",
      };
    }
    throw new Error("No JSON found");
  } catch (e) {
    console.warn(
      `[The Eye] Translation failed: ${e.message}. Falling back to Keyword Extraction.`,
    );

    // --- ROBUST FALLBACK ---
    // 1. Aggressive Stopword Removal
    const stopWords = new Set([
      "i",
      "me",
      "my",
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "is",
      "are",
      "was",
      "were",
      "to",
      "for",
      "of",
      "in",
      "on",
      "at",
      "with",
      "about",
      "need",
      "want",
      "find",
      "search",
      "show",
      "tell",
      "help",
      "study",
      "learn",
    ]);

    const keywords = userQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .split(/\s+/)
      .filter((w) => !stopWords.has(w) && w.length > 2)
      .join(" ");

    return {
      query: keywords || userQuery, // Fallback to keywords, or raw query if everything was stripped
      buckets: ["core"],
      strategy: "broad",
    };
  }
}

/**
 * Generates tags for the Dreamer service
 */
async function generateTags(content, existingTags) {
  try {
    const s = await initInference();
    const prompt = `Analyze this text and output 3-5 JSON tags.
Existing: ${JSON.stringify(existingTags.slice(0, 20))}
Text: "${content.substring(0, 500)}..."
JSON List:`;

    const response = await s.prompt(prompt, {
      temperature: 0.3,
      maxTokens: 100,
    });
    const match = response.match(/\[.*\]/s);
    return match ? JSON.parse(match[0]) : [];
  } catch (e) {
    return [];
  }
}

function getStatus() {
  return { loaded: !!session, model: currentModelName };
}

module.exports = {
  listModels,
  loadModel,
  chat,
  translateIntent,
  generateTags,
  rawCompletion,
  getStatus,
  initInference,
};
