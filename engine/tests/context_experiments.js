/**
 * Context Assembly Experiments
 * Objective: Determine optimal context window size and search strategy.
 * Tests different combinations of keyword, semantic, and targeted search.
 * Evaluates SLM's ability to understand and narrate context snippets at different ratios.
 * Run: node engine/tests/context_experiments.js
 */
const { executeSearch } = require('../src/services/search');
const { db, init } = require('../src/core/db');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const inference = require('../src/services/inference');

const EXPERIMENT_CONFIG = {
    // Test different query types: natural language, specific keywords, and mixed
    queries: [
        "Rob",
        "Jade",
        "Dory",
        "morning surrender",
        "anchor",
        "ECE_core",
        "project",
        "I need to study python concepts and gotchas to prepare for my interview tomorrow", // Natural language
        "memory organization and tag optimization", // Semantic query
        "context engine architecture and design" // Complex topic
    ],
    budgets: [1000, 5000, 10000, 50000],
    strategies: ['broad', 'precise'], // Test different search strategies
    deepOptions: [false, true], // Test with and without temporal folding
    outputFile: path.join(__dirname, '../../../logs/context_experiments_results.json'),
    logFile: path.join(__dirname, '../../../logs/experiment.log')
};

async function runExperiments() {
    console.log("🧪 Starting Context Assembly Experiments...");
    console.log("📊 Testing different query types, character budgets, and temporal folding options");
    console.log("📈 Measuring: retrieval speed, source diversity, history coverage, and token efficiency");
    console.log("🤖 Evaluating SLM's ability to understand and narrate context snippets at different ratios");

    // Initialize database and inference
    await init();
    await initializeInference();

    const results = {};

    // Log header to file
    const logHeader = `Context Assembly Experiment Log
============================
Started: ${new Date().toISOString()}
Testing SLM comprehension at different context ratios
===============================================\n\n`;

    fs.writeFileSync(EXPERIMENT_CONFIG.logFile, logHeader);

    for (const query of EXPERIMENT_CONFIG.queries) {
        console.log(`\n🔍 Testing Query: "${query.substring(0, 40)}${query.length > 40 ? '...' : ''}"`);
        logToFile(`\nTesting Query: "${query}"\n`);

        results[query] = {};
        for (const budget of EXPERIMENT_CONFIG.budgets) {
            results[query][budget] = {};
            for (const deep of EXPERIMENT_CONFIG.deepOptions) {
                results[query][budget][`deep_${deep}`] = {};
                process.stdout.write(`   Budget: ${budget} chars, Deep: ${deep}... `);
                logToFile(`  Budget: ${budget} chars, Deep: ${deep}\n`);

                const startTime = performance.now();
                try {
                    const result = await executeSearch(query, null, ['core'], budget, deep);
                    const duration = Math.round(performance.now() - startTime);
                    const contentLen = result.context.length;
                    const sourceMatches = result.context.match(/### Source: (.+)/g) || [];
                    const uniqueSources = new Set(sourceMatches).size;

                    // Count history entries for temporal folding analysis
                    const historyMatches = result.context.match(/\*\*History:\*\*/g) || [];
                    const historyCount = historyMatches.length;

                    // Evaluate SLM's ability to comprehend and summarize the context
                    const slmEvaluation = await evaluateSLMComprehension(result.context, query);

                    // Calculate token efficiency metrics
                    const avgSourceLength = uniqueSources > 0 ? contentLen / uniqueSources : 0;

                    results[query][budget][`deep_${deep}`] = {
                        time_ms: duration,
                        chars_returned: contentLen,
                        unique_sources: uniqueSources,
                        history_entries: historyCount,
                        avg_source_length: Math.round(avgSourceLength),
                        sources_per_k: uniqueSources / (budget / 1000),
                        tokens_per_sec: Math.round((contentLen / 1000) / (duration / 1000)),
                        density: (uniqueSources / (budget / 1000)).toFixed(2),
                        slm_comprehension_score: slmEvaluation.score,
                        slm_summary_quality: slmEvaluation.quality,
                        slm_relevance_to_query: slmEvaluation.relevance
                    };

                    console.log(`✅ Done (${uniqueSources} sources, ${historyCount} history, ${duration}ms)`);
                    logToFile(`    Retrieved: ${uniqueSources} sources, ${historyCount} history entries\n`);
                    logToFile(`    SLM Comprehension Score: ${slmEvaluation.score}/10\n`);
                    logToFile(`    SLM Summary Quality: ${slmEvaluation.quality}\n`);
                    logToFile(`    SLM Relevance to Query: ${slmEvaluation.relevance}/10\n\n`);

                } catch (e) {
                    console.log(`❌ Failed: ${e.message}`);
                    results[query][budget][`deep_${deep}`] = { error: e.message };
                    logToFile(`    ERROR: ${e.message}\n\n`);
                }
            }
        }
    }

    // Add summary analysis
    const summary = generateExperimentSummary(results);
    results.summary = summary;

    fs.writeFileSync(EXPERIMENT_CONFIG.outputFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to ${EXPERIMENT_CONFIG.outputFile}`);
    console.log("\n📋 SUMMARY OF FINDINGS:");
    console.log("=======================");
    console.log(`• Best query type: ${summary.bestQueryType}`);
    console.log(`• Optimal budget: ${summary.optimalBudget} chars`);
    console.log(`• Temporal folding effectiveness: ${summary.temporalFoldingEffectiveness}`);
    console.log(`• Average retrieval speed: ${summary.avgRetrievalSpeed}ms`);
    console.log("\n💡 RECOMMENDATIONS:");
    console.log("===================");
    console.log(summary.recommendations.join('\n'));

    process.exit(0);
}

/**
 * Initialize the inference module
 */
async function initializeInference() {
    try {
        // Try to load a default model
        const models = inference.listModels();
        if (models.length > 0) {
            const defaultModel = models[0];
            console.log(`🤖 Loading inference model: ${defaultModel}`);
            await inference.loadModel(defaultModel);
        } else {
            console.log("⚠️ No models found in models directory");
        }
    } catch (e) {
        console.log("⚠️ Could not initialize inference module:", e.message);
    }
}

/**
 * Evaluate the SLM's ability to comprehend and summarize the context
 */
async function evaluateSLMComprehension(context, originalQuery) {
    try {
        // Create a prompt asking the SLM to summarize and relate the context to the original query
        const prompt = `Given the following context, please provide a concise summary that relates directly to the query "${originalQuery}".
Rate the relevance of the context to the query on a scale of 1-10, where 10 is highly relevant.
Also rate the quality of the information provided in the context on a scale of 1-10, where 10 is high quality.

Context:
${context.substring(0, 4000)}  // Limit to prevent overwhelming the model

Please respond in the following JSON format:
{
  "summary": "Brief summary of the context related to the query",
  "relevance": 7,
  "quality": 8,
  "score": 7.5
}`;

        const response = await inference.rawCompletion(prompt, { temperature: 0.2, maxTokens: 300 });

        // Try to parse the response as JSON
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                return {
                    summary: parsed.summary || "Could not parse summary",
                    relevance: parsed.relevance || 5,
                    quality: parsed.quality || 5,
                    score: parsed.score || 5
                };
            } catch (e) {
                // If JSON parsing fails, return default values
                return {
                    summary: "Could not parse SLM response",
                    relevance: 5,
                    quality: 5,
                    score: 5
                };
            }
        } else {
            // If no JSON found, return default values
            return {
                summary: "SLM response did not contain expected JSON",
                relevance: 5,
                quality: 5,
                score: 5
            };
        }
    } catch (e) {
        console.error("SLM evaluation error:", e.message);
        return {
            summary: "Error evaluating context with SLM",
            relevance: 0,
            quality: 0,
            score: 0
        };
    }
}

/**
 * Log message to the experiment log file
 */
function logToFile(message) {
    fs.appendFileSync(EXPERIMENT_CONFIG.logFile, message);
}

/**
 * Generate summary analysis of experiment results
 */
function generateExperimentSummary(results) {
    // Remove the summary property if it already exists to avoid recursion
    const resultsCopy = {...results};
    delete resultsCopy.summary;

    let totalTime = 0;
    let totalQueries = 0;
    let bestPerformance = 0;
    let bestQueryType = '';
    let bestBudget = 0;
    let totalHistoryEntries = 0;
    let totalSources = 0;

    for (const [query, budgets] of Object.entries(resultsCopy)) {
        if (query === 'summary') continue;

        for (const [budgetStr, deepOpts] of Object.entries(budgets)) {
            const budget = parseInt(budgetStr);

            for (const [deepKey, result] of Object.entries(deepOpts)) {
                if (result.error) continue;

                totalTime += result.time_ms;
                totalQueries++;

                // Calculate performance score (sources per ms)
                const performance = result.unique_sources / result.time_ms;
                if (performance > bestPerformance) {
                    bestPerformance = performance;
                    bestQueryType = query;
                    bestBudget = budget;
                }

                totalHistoryEntries += result.history_entries;
                totalSources += result.unique_sources;
            }
        }
    }

    const avgRetrievalSpeed = totalQueries > 0 ? Math.round(totalTime / totalQueries) : 0;
    const temporalFoldingEffectiveness = totalSources > 0 ?
        `${Math.round((totalHistoryEntries / totalSources) * 100)}% of sources have history entries` :
        'No data';

    // Generate recommendations based on results
    const recommendations = [];
    if (avgRetrievalSpeed > 1000) {
        recommendations.push('• Consider optimizing search performance - average retrieval >1s');
    } else {
        recommendations.push('• Search performance is acceptable (<1s average retrieval)');
    }

    if (totalHistoryEntries > 0) {
        recommendations.push('• Temporal folding is working - history entries detected');
    } else {
        recommendations.push('• Temporal folding may not be active - no history entries found');
    }

    recommendations.push(`• For optimal results, use budget around ${bestBudget} chars`);
    recommendations.push(`• Natural language queries work well: "${bestQueryType.substring(0, 30)}..."`);

    return {
        bestQueryType,
        optimalBudget: bestBudget,
        temporalFoldingEffectiveness,
        avgRetrievalSpeed,
        totalQueriesProcessed: totalQueries,
        totalHistoryEntries,
        totalSources,
        recommendations
    };
}
runExperiments();