/**
 * Inference Worker for Nanobot Brain
 * 
 * Implements the worker thread that handles the actual LLM inference
 * Based on the ECE_Core ChatWorker implementation
 */

import { parentPort, workerData } from 'worker_threads';
import { getLlama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp';

// Worker state
let llama = null;
let model = null;
let context = null;
let session = null;
let currentSequence = null;

async function init() {
    if (llama) return;
    try {
        const forceCpu = workerData?.forceCpu || process.env['GPU_LAYERS'] === '0';

        if (forceCpu) {
            console.log("[Worker] Force CPU mode detected. Disabling GPU backends.");
            llama = await getLlama({
                gpu: { type: 'auto', exclude: ['cuda', 'vulkan', 'metal'] }
            });
        } else {
            console.log("[Worker] Initializing Llama with hardware acceleration support.");
            llama = await getLlama();
        }

        // Load the model specified in worker data (if any)
        if (workerData?.modelPath) {
            await handleLoadModel({
                modelPath: workerData.modelPath,
                options: workerData.options || {}
            });
        } else {
            console.log("[Worker] Initialized without model (waiting for loadModel command)");
        }

        parentPort?.postMessage({ type: 'ready' });
    } catch (error) {
        console.error("[Worker] Initialization Error:", error);
        parentPort?.postMessage({ type: 'error', error: error.message });
    }
}

// Queue for handling messages sequentially
const messageQueue = [];
let isProcessing = false;

// Handle messages from main thread
parentPort?.on('message', (message) => {
    messageQueue.push(message);
    processQueue();
});

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        try {
            switch (message.type) {
                case 'loadModel':
                    await handleLoadModel(message.data);
                    break;
                case 'unloadModel':
                    await handleUnloadModel();
                    break;
                case 'chat':
                    await handleChat(message.data);
                    break;
                case 'dispose':
                    await handleDispose();
                    break;
            }
        } catch (error) {
            console.error("[Worker] Message Handling Error:", error);
            parentPort?.postMessage({ type: 'error', error: error.message });
        }
    }

    isProcessing = false;
}

async function handleLoadModel(data) {
    if (!llama) await init();

    // Cleanup existing
    if (session) { session.dispose(); session = null; }
    if (currentSequence) { currentSequence.dispose(); currentSequence = null; }
    if (context) { await context.dispose(); context = null; }
    if (model) { await model.dispose(); model = null; }

    try {
        console.log(`[Worker] Loading model: ${data.modelPath} (gpuLayers: ${data.options.gpuLayers || 0})`);
        model = await llama.loadModel({
            modelPath: data.modelPath,
            gpuLayers: data.options.gpuLayers || 0,
            // Windows fixes: Disable mmap and parallel prefetch to avoid stdin issues
            useMmap: false,
            disableParallelPrefetch: true
        });

        const ctxSize = data.options.ctxSize || 2048;
        console.log(`[Worker] Creating context: ${ctxSize} tokens`);
        context = await model.createContext({
            contextSize: ctxSize,
            batchSize: Math.min(ctxSize, 512),
            gpuLayers: data.options.gpuLayers || 0,
            threads: data.options.threads || 4
        });

        currentSequence = context.getSequence();
        session = new LlamaChatSession({
            contextSequence: currentSequence,
            systemPrompt: data.options.systemPrompt || "You are a helpful assistant."
        });

        parentPort?.postMessage({ type: 'modelLoaded', data: { modelPath: data.modelPath } });
    } catch (error) {
        throw new Error(`Failed to load model: ${error.message}`);
    }
}

async function handleUnloadModel() {
    console.log('[Worker] Unloading model...');
    if (session) { session.dispose(); session = null; }
    if (currentSequence) { currentSequence.dispose(); currentSequence = null; }
    if (context) { await context.dispose(); context = null; }
    if (model) { await model.dispose(); model = null; }
    console.log('[Worker] Model unloaded successfully');
    parentPort?.postMessage({ type: 'modelUnloaded' });
}

async function handleChat(data) {
    if (!context) throw new Error("Context not initialized");

    // Update session if system prompt changed or if no session exists
    if (data.options.systemPrompt || !session) {
        if (session) session.dispose();
        if (currentSequence) currentSequence.dispose();

        currentSequence = context.getSequence();
        session = new LlamaChatSession({
            contextSequence: currentSequence,
            systemPrompt: data.options.systemPrompt || "You are a helpful assistant."
        });
    }

    console.log(`[Worker] Chat Request: ${data.prompt.length} chars. Generating response...`);
    let tokensReceived = 0;

    const response = await session.prompt(data.prompt, {
        temperature: data.options.temperature || 0.7,
        maxTokens: data.options.maxTokens || 512,
        onToken: (token) => {
            tokensReceived++;
            // Windows fix: Don't write to stdout in worker thread (causes "Input redirection" error)
            // process.stdout.write(model.detokenize([token]));
        }
    });

    console.log(`[Worker] Chat Completed. Response: ${response.length} chars.`);
    parentPort?.postMessage({ type: 'chatResponse', data: response });
}

async function handleDispose() {
    if (session) { session.dispose(); session = null; }
    if (currentSequence) { currentSequence.dispose(); currentSequence = null; }
    if (context) { await context.dispose(); context = null; }
    if (model) await model.dispose();
    parentPort?.postMessage({ type: 'disposed' });
}

// Initialize the worker
init();