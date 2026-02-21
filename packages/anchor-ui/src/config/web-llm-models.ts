// WebLLM Models Configuration
export const WEBLLM_MODELS = [
  { id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC', name: 'DeepSeek R1 7B (Q4)' },
  { id: 'Llama-3-8B-Instruct-q4f32_1-MLC', name: 'Llama 3 8B Instruct (Q4)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (Q4)' },
];

export const webLLMConfig = {
  modelBasePath: 'https://huggingface.co/',
  defaultModel: WEBLLM_MODELS[0].id
};

export const getAvailableModels = () => WEBLLM_MODELS;

export default WEBLLM_MODELS;
