import { CreateMLCEngine, MLCEngine, type AppConfig } from "@mlc-ai/web-llm";
import { webLLMConfig } from "../config/web-llm-models";

export class WebLLMService {
    private engine: MLCEngine | null = null;
    private modelId: string = "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC"; // Best reasoning model (Qwen-based)
    private progressCallback: (report: { text: string; progress: number }) => void = () => { };
    private isLoading: boolean = false;
    private initError: Error | null = null;

    constructor() { }

    public setProgressCallback(callback: (report: { text: string; progress: number }) => void) {
        this.progressCallback = callback;
    }

    public getProgressCallback() {
        return this.progressCallback;
    }

    public async initialize(modelId?: string) {
        if (this.engine) return;
        if (this.isLoading) {
            // Wait for existing initialization
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.initError) throw this.initError;
            return;
        }

        if (modelId) this.modelId = modelId;

        this.isLoading = true;
        this.initError = null;
        console.log(`[WebLLM] Initializing with model: ${this.modelId}`);

        try {
            console.log(`[WebLLM] Requested ModelID: ${this.modelId}`);

            // Find specific model config to ensure valid properties
            const modelConfig = webLLMConfig.model_list.find(m => m.model_id === this.modelId);
            console.log(`[WebLLM] Found Config:`, modelConfig);

            const initConfig: AppConfig = {
                ...webLLMConfig,
                model_list: modelConfig ? [modelConfig] : webLLMConfig.model_list
            };

            console.log(`[WebLLM] InitConfig used:`, JSON.stringify(initConfig, null, 2));

            this.engine = await CreateMLCEngine(
                this.modelId,
                {
                    appConfig: initConfig,
                    initProgressCallback: (report) => {
                        console.log(`[WebLLM] Loading: ${report.text}`);
                        this.progressCallback(report);
                    }
                }
            );
            console.log("[WebLLM] Engine Ready");
        } catch (e: any) {
            console.error("[WebLLM] Init Failed", e);
            this.initError = e instanceof Error ? e : new Error(String(e));
            throw e;
        } finally {
            this.isLoading = false;
        }
    }

    public isInitialized(): boolean {
        return this.engine !== null;
    }

    public isLoadingModel(): boolean {
        return this.isLoading;
    }

    public getInitError(): Error | null {
        return this.initError;
    }

    public async generate(messages: any[], onUpdate: (current: string) => void) {
        if (!this.engine) throw new Error("Engine not initialized");

        const completion = await this.engine.chat.completions.create({
            messages,
            stream: true,
        });

        let fullText = "";
        for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta.content || "";
            if (delta) {
                fullText += delta;
                onUpdate(fullText);
            }
        }
        return fullText;
    }

    public getEngine() {
        return this.engine;
    }
}

export const webLLMService = new WebLLMService();
