/**
 * Configuration Module for Sovereign Context Engine
 * 
 * This module manages all configuration for the context engine including
 * paths, model settings, and system parameters.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// For __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define configuration interface
interface Config {
  // Core
  PORT: number;
  HOST: string;
  API_KEY: string;
  LOG_LEVEL: string;
  OVERLAY_PORT: number;

  // LLM Provider
  LLM_PROVIDER: 'local' | 'remote';
  REMOTE_LLM_URL: string;
  REMOTE_MODEL_NAME: string;

  // Tuning
  DEFAULT_SEARCH_CHAR_LIMIT: number;
  DREAM_INTERVAL_MS: number;
  SIMILARITY_THRESHOLD: number;
  TOKEN_LIMIT: number;
  DREAMER_BATCH_SIZE: number;

  VECTOR_INGEST_BATCH: number;

  // Extrapolated Settings
  WATCHER_DEBOUNCE_MS: number;
  CONTEXT_RELEVANCE_WEIGHT: number;
  CONTEXT_RECENCY_WEIGHT: number;
  DREAMER_CLUSTERING_GAP_MS: number;

  // Infrastructure
  REDIS: {
    ENABLED: boolean;
    URL: string;
    TTL: number;
  };
  NEO4J: {
    ENABLED: boolean;
    URI: string;
    USER: string;
    PASS: string;
  };

  // Features
  FEATURES: {
    CONTEXT_STORAGE: boolean;
    MEMORY_RECALL: boolean;
    CODA: boolean;
    ARCHIVIST: boolean;
    WEAVER: boolean;
    MARKOVIAN: boolean;
  };

  // Search Settings
  SEARCH: {
    strategy: string;
    hide_years_in_tags: boolean;
    whitelist: string[];
  };

  // Models
  MODELS: {
    EMBEDDING_DIM: number;
    MAIN: {
      PATH: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
    };

    ORCHESTRATOR: {
      PATH: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
    };
    VISION: {
      PATH: string;
      PROJECTOR: string;
      CTX_SIZE: number;
      GPU_LAYERS: number;
    };
  };
}

// Default configuration
const DEFAULT_CONFIG: Config = {
  // Core
  PORT: 3000,
  HOST: "0.0.0.0",
  API_KEY: "ece-secret-key",
  LOG_LEVEL: "INFO",
  OVERLAY_PORT: 3001,

  // LLM Provider
  LLM_PROVIDER: 'local',
  REMOTE_LLM_URL: "http://localhost:8000/v1",
  REMOTE_MODEL_NAME: "default",

  // Tuning
  DEFAULT_SEARCH_CHAR_LIMIT: 524288,
  DREAM_INTERVAL_MS: 3600000, // 60 minutes
  SIMILARITY_THRESHOLD: 0.8,
  TOKEN_LIMIT: 1000000,
  DREAMER_BATCH_SIZE: 5,

  VECTOR_INGEST_BATCH: 50,

  // Extrapolated Settings
  WATCHER_DEBOUNCE_MS: 2000,
  CONTEXT_RELEVANCE_WEIGHT: 0.7,
  CONTEXT_RECENCY_WEIGHT: 0.3,
  DREAMER_CLUSTERING_GAP_MS: 900000, // 15 mins

  // Infrastructure
  REDIS: {
    ENABLED: false,
    URL: "redis://localhost:6379",
    TTL: 3600
  },
  NEO4J: {
    ENABLED: false,
    URI: "bolt://localhost:7687",
    USER: "neo4j",
    PASS: "password"
  },

  // Features
  FEATURES: {
    CONTEXT_STORAGE: true,
    MEMORY_RECALL: true,
    CODA: true,
    ARCHIVIST: true,
    WEAVER: true,
    MARKOVIAN: true
  },

  // Search
  SEARCH: {
    strategy: "hybrid",
    hide_years_in_tags: true,
    whitelist: []
  },

  // Models
  MODELS: {
    EMBEDDING_DIM: 768,
    MAIN: {
      PATH: "glm-edge-1.5b-chat.Q5_K_M.gguf", // Default from user_settings.json
      CTX_SIZE: 8192, // Default from user_settings.json
      GPU_LAYERS: 11 // Default from user_settings.json
    },

    ORCHESTRATOR: {
      PATH: "Qwen3-4B-Function-Calling-Pro.gguf", // Default from user_settings.json
      CTX_SIZE: 8192,
      GPU_LAYERS: 0
    },
    VISION: {
      PATH: "",  // MUST BE SET IN user_settings.json
      PROJECTOR: "", // MUST BE SET IN user_settings.json
      CTX_SIZE: 2048,
      GPU_LAYERS: 11 // Default from user_settings.json
    }
  }
};

// Configuration loader
function loadConfig(): Config {
  // Determine config file path
  // Priority: user_settings.json > sovereign.yaml > .env > Defaults

  let loadedConfig = { ...DEFAULT_CONFIG };

  // 1. Try Loading sovereign.yaml (Legacy/System Config)
  const configPath = process.env['SOVEREIGN_CONFIG_PATH'] ||
    path.join(__dirname, '..', '..', 'sovereign.yaml') ||
    path.join(__dirname, '..', 'config', 'default.yaml');

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const parsedConfig = yaml.load(configFile) as Partial<Config>;
      loadedConfig = { ...loadedConfig, ...parsedConfig };
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
    }
  }

  // 2. Try Loading user_settings.json (Highest Priority for User Overrides)
  const userSettingsPath = path.join(__dirname, '..', '..', 'user_settings.json');
  if (fs.existsSync(userSettingsPath)) {
    try {
      const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      console.log(`[Config] Loaded settings from ${userSettingsPath}`);

      if (userSettings.llm) {
        if (userSettings.llm.provider) loadedConfig.LLM_PROVIDER = userSettings.llm.provider;
        if (userSettings.llm.remote_url) loadedConfig.REMOTE_LLM_URL = userSettings.llm.remote_url;
        if (userSettings.llm.remote_model) loadedConfig.REMOTE_MODEL_NAME = userSettings.llm.remote_model;

        if (userSettings.llm.chat_model) loadedConfig.MODELS.MAIN.PATH = userSettings.llm.chat_model;
        if (userSettings.llm.gpu_layers !== undefined) loadedConfig.MODELS.MAIN.GPU_LAYERS = userSettings.llm.gpu_layers;
        if (userSettings.llm.ctx_size !== undefined) loadedConfig.MODELS.MAIN.CTX_SIZE = userSettings.llm.ctx_size;

        // Also update Orchestrator if task_model is set
        if (userSettings.llm.task_model) loadedConfig.MODELS.ORCHESTRATOR.PATH = userSettings.llm.task_model;
      }

      if (userSettings.dreamer) {
        if (userSettings.dreamer.batch_size) loadedConfig.DREAMER_BATCH_SIZE = userSettings.dreamer.batch_size;
      }

      // Load Search Settings
      if (userSettings.search) {
        if (userSettings.search.strategy) loadedConfig.SEARCH.strategy = userSettings.search.strategy;
        if (userSettings.search.hide_years_in_tags !== undefined) loadedConfig.SEARCH.hide_years_in_tags = userSettings.search.hide_years_in_tags;
        if (userSettings.search.whitelist) loadedConfig.SEARCH.whitelist = userSettings.search.whitelist;
      }

    } catch (e) {
      console.error(`[Config] Failed to parse user_settings.json:`, e);
    }
  }

  return loadedConfig;
}

// Export configuration
export const config = loadConfig();

export default config;