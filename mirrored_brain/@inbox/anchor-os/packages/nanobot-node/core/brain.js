/**
 * Brain Module for Nanobot
 * 
 * Implements LLM inference using node-llama-cpp with worker threads
 * Based on the ECE_Core inference implementation
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global state for the brain
let chatWorker = null;
let currentModelName = '';
let modelLoaded = false;
let storedConfig = null;

// Configuration defaults
// Note: Don't use process.env.MODEL_PATH here - it should always come from initializeBrain config
const DEFAULT_CONFIG = {
  MODEL_PATH: path.resolve(__dirname, '..', '..', 'models', 'llama-3.2-1b-instruct-q4_k_m.gguf'),
  MODEL_DIR: path.resolve(__dirname, '..', '..', 'models'),
  CTX_SIZE: parseInt(process.env.CTX_SIZE) || 2048,
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 512,
  THREADS: parseInt(process.env.THREADS) || 4,
  GPU_LAYERS: parseInt(process.env.GPU_LAYERS) || 0,
  TEMPERATURE: parseFloat(process.env.TEMPERATURE) || 0.7,
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || 512
};

/**
 * Initialize the brain with the specified model
 */
export async function initializeBrain(config = {}) {
  console.log(`[Brain] initializeBrain called with config.MODEL_PATH: ${config.MODEL_PATH}`);
  console.log(`[Brain] process.env.MODEL_PATH: ${process.env.MODEL_PATH}`);
  console.log(`[Brain] DEFAULT_CONFIG.MODEL_PATH: ${DEFAULT_CONFIG.MODEL_PATH}`);
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log(`[Brain] Initializing with model: ${finalConfig.MODEL_PATH}`);
  console.log(`[Brain] finalConfig after merge: MODEL_PATH=${finalConfig.MODEL_PATH}`);

  try {
    // If a worker already exists, dispose of it first
    if (chatWorker) {
      console.log('[Brain] Existing worker found, disposing before re-initialization.');
      await disposeBrain();
    }

    // Spawn the worker thread
    const workerPath = path.resolve(__dirname, 'inference-worker.js');
    chatWorker = new Worker(workerPath, {
      workerData: {
        // modelPath: finalConfig.MODEL_PATH, // Don't pass model path to avoid auto-load
        options: {
          ctxSize: finalConfig.CTX_SIZE,
          gpuLayers: finalConfig.GPU_LAYERS,
          temperature: finalConfig.TEMPERATURE,
          maxTokens: finalConfig.MAX_TOKENS
        }
      },
      // Windows fix: Disable stdin/stdout to prevent "Input redirection is not supported" error
      stdin: false,
      stdout: false,
      stderr: false
    });

    // Wait for the worker to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for worker initialization'));
      }, 120000); // 120 second timeout

      chatWorker.on('message', (msg) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          console.log('[Brain] Worker initialized and ready');
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(msg.error));
        }
      });

      chatWorker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Store config
    storedConfig = finalConfig;

    // Auto-load model immediately (eager loading)
    console.log('[Brain] Auto-loading model: ' + finalConfig.MODEL_PATH);
    try {
      await loadModel(finalConfig.MODEL_PATH, {
        ctxSize: finalConfig.CTX_SIZE,
        gpuLayers: finalConfig.GPU_LAYERS
      });
      console.log('[Brain] Model loaded successfully during initialization');
    } catch (error) {
      console.error('[Brain] Auto-load failed:', error.message);
      // Don't fail initialization - model can still be loaded lazily later
      console.log('[Brain] Continuing with lazy loading fallback');
    }

    return { success: true, message: 'Brain initialized successfully' };
  } catch (error) {
    console.error('[Brain] Failed to initialize brain:', error.message);
    return { success: false, message: `Failed to initialize brain: ${error.message}` };
  }
}

/**
 * Load a model into the brain
 */
export async function loadModel(modelPath, options = {}) {
  if (!chatWorker) {
    throw new Error('Brain not initialized');
  }

  // If a model is already loaded and it's different, unload it first
  if (modelLoaded && currentModelName !== modelPath) {
    console.log(`[Brain] Model already loaded (${currentModelName}), unloading before loading new model: ${modelPath}`);
    await unloadModel(); // This will reset modelLoaded and currentModelName
  } else if (modelLoaded && currentModelName === modelPath) {
    console.log(`[Brain] Model ${modelPath} is already loaded.`);
    return { success: true, modelPath, message: 'Model already loaded' };
  }

  console.log(`[Brain] Loading model: ${modelPath}`);

  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      if (msg.type === 'modelLoaded') {
        chatWorker.removeListener('message', handler);
        modelLoaded = true;
        currentModelName = modelPath;
        console.log(`[Brain] Model loaded successfully: ${modelPath}`);
        resolve({ success: true, modelPath });
      } else if (msg.type === 'error') {
        chatWorker.removeListener('message', handler);
        console.error('[Brain] Model loading error:', msg.error);
        reject(new Error(msg.error));
      }
    };

    chatWorker.on('message', handler);
    chatWorker.postMessage({
      type: 'loadModel',
      data: {
        modelPath,
        options: {
          ctxSize: options.ctxSize || DEFAULT_CONFIG.CTX_SIZE,
          gpuLayers: options.gpuLayers || DEFAULT_CONFIG.GPU_LAYERS
        }
      }
    });
  });
}

/**
 * Unload the current model
 */
export async function unloadModel() {
  if (!chatWorker) {
    throw new Error('Brain not initialized');
  }

  if (!modelLoaded) {
    return { success: true, message: 'Model already unloaded' };
  }

  console.log('[Brain] Unloading model...');

  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      if (msg.type === 'modelUnloaded') {
        chatWorker.removeListener('message', handler);
        modelLoaded = false;
        currentModelName = '';
        console.log('[Brain] Model unloaded successfully');
        resolve({ success: true, message: 'Model unloaded successfully' });
      } else if (msg.type === 'error') {
        chatWorker.removeListener('message', handler);
        console.error('[Brain] Model unloading error:', msg.error);
        reject(new Error(msg.error));
      }
    };

    chatWorker.on('message', handler);
    chatWorker.postMessage({ type: 'unloadModel' });
  });
}

/**
 * Resolve a model name/path to an absolute path
 */
function resolveModelPath(modelPath) {
  if (!modelPath) return storedConfig.MODEL_PATH;
  if (path.isAbsolute(modelPath)) return modelPath;

  // If it's just a filename, assume it's in the models directory
  // Resolve relative to project root (2 levels up from brain.js)
  const rootDir = path.resolve(__dirname, '..', '..');
  const modelDir = (storedConfig && storedConfig.MODEL_DIR) || path.join(rootDir, 'models');

  // If the modelPath doesn't contain a slash, it's likely a filename
  if (!modelPath.includes('/') && !modelPath.includes('\\')) {
    return path.resolve(modelDir, modelPath);
  }

  // Otherwise resolve relative to root
  return path.resolve(rootDir, modelPath);
}

/**
 * Run a chat completion
 */
export async function chatCompletion(messages, options = {}) {
  if (!chatWorker) {
    throw new Error('Brain not initialized');
  }

  // Determine which model path to use
  const targetModelPath = resolveModelPath(options.model);

  // Lazy load or switch model if needed
  if (!modelLoaded || currentModelName !== targetModelPath) {
    console.log(`[Brain] Loading/Switching model to: ${targetModelPath}`);
    await loadModel(targetModelPath, {
      ctxSize: storedConfig.CTX_SIZE,
      gpuLayers: storedConfig.GPU_LAYERS
    });
  }

  // Format messages into a single prompt
  const prompt = formatMessagesForPrompt(messages);

  console.log(`[Brain] Processing chat request with ${messages.length} messages`);

  return new Promise((resolve, reject) => {
    let fullResponse = '';

    const handler = (msg) => {
      if (msg.type === 'token') {
        // Handle streaming tokens if needed
        fullResponse += msg.token;
      } else if (msg.type === 'chatResponse') {
        console.log(`[Brain] Received chat response from worker (${msg.data.length} chars)`);
        chatWorker.removeListener('message', handler);
        resolve({
          success: true,
          response: {
            id: `chat-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: currentModelName,
            choices: [{
              index: 0,
              message: { role: 'assistant', content: msg.data },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: prompt.length,
              completion_tokens: msg.data.length,
              total_tokens: prompt.length + msg.data.length
            }
          }
        });
      } else if (msg.type === 'error') {
        chatWorker.removeListener('message', handler);
        reject(new Error(msg.error));
      }
    };

    chatWorker.on('message', handler);
    chatWorker.postMessage({
      type: 'chat',
      data: {
        prompt,
        options: {
          temperature: options.temperature || DEFAULT_CONFIG.TEMPERATURE,
          maxTokens: options.maxTokens || DEFAULT_CONFIG.MAX_TOKENS,
          systemPrompt: options.systemPrompt || 'You are a helpful assistant.'
        }
      }
    });
  });
}

/**
 * Run a simple text completion
 */
export async function textCompletion(prompt, options = {}) {
  if (!chatWorker) {
    throw new Error('Brain not initialized');
  }

  // Lazy load model if needed
  if (!modelLoaded) {
    console.log('[Brain] Lazy loading model...');
    await loadModel(storedConfig.MODEL_PATH, {
      ctxSize: storedConfig.CTX_SIZE,
      gpuLayers: storedConfig.GPU_LAYERS
    });
  }

  console.log(`[Brain] Processing completion request (${prompt.length} chars)`);

  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      if (msg.type === 'chatResponse') {
        chatWorker.removeListener('message', handler);
        resolve({
          success: true,
          response: {
            id: `completion-${Date.now()}`,
            object: 'text_completion',
            created: Math.floor(Date.now() / 1000),
            model: currentModelName,
            choices: [{
              index: 0,
              text: msg.data,
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: prompt.length,
              completion_tokens: msg.data.length,
              total_tokens: prompt.length + msg.data.length
            }
          }
        });
      } else if (msg.type === 'error') {
        chatWorker.removeListener('message', handler);
        reject(new Error(msg.error));
      }
    };

    chatWorker.on('message', handler);
    chatWorker.postMessage({
      type: 'chat',
      data: {
        prompt,
        options: {
          temperature: options.temperature || DEFAULT_CONFIG.TEMPERATURE,
          maxTokens: options.maxTokens || DEFAULT_CONFIG.MAX_TOKENS,
          systemPrompt: options.systemPrompt || 'You are a completion engine.'
        }
      }
    });
  });
}

/**
 * Get the current status of the brain
 */
export function getBrainStatus() {
  return {
    loaded: modelLoaded,
    model: currentModelName,
    config: DEFAULT_CONFIG
  };
}

/**
 * Format messages for the prompt
 */
function formatMessagesForPrompt(messages) {
  // Simple formatting for now - could be enhanced based on specific requirements
  return messages.map(msg => {
    if (msg.role === 'system') {
      return `<|system|>\n${msg.content}`;
    } else if (msg.role === 'user') {
      return `<|user|>\n${msg.content}`;
    } else if (msg.role === 'assistant') {
      return `<|assistant|>\n${msg.content}`;
    } else {
      return `${msg.role}: ${msg.content}`;
    }
  }).join('\n\n') + '\n\n<|assistant|>\n';
}

/**
 * Clean up resources
 */
export async function disposeBrain() {
  if (chatWorker) {
    chatWorker.postMessage({ type: 'dispose' });
    await new Promise(resolve => {
      chatWorker.once('message', (msg) => {
        if (msg.type === 'disposed') {
          resolve();
        }
      });
    });
    chatWorker.terminate();
    chatWorker = null;
  }

  modelLoaded = false;
  currentModelName = '';

  console.log('[Brain] Brain disposed successfully');
}