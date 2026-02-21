import type { Message } from '../types/chat';
import { webLLMService } from './web-llm';

type ChatBackend = 'remote' | 'webllm';

export class ChatService {
    private abortController: AbortController | null = null;
    private backend: ChatBackend = 'webllm'; // Default to WebLLM, can be toggled
    private useAnchorContext: boolean = true; // Toggle for context injection

    setBackend(mode: ChatBackend) {
        this.backend = mode;
        console.log(`[ChatService] Switched backend to: ${mode}`);
    }

    setUseAnchorContext(use: boolean) {
        this.useAnchorContext = use;
        console.log(`[ChatService] Anchor Context: ${use ? 'ENABLED' : 'DISABLED'}`);
    }

    async sendMessage(
        content: string,
        onMessage: (message: Partial<Message>) => void,
        onError: (error: string) => void,
        onComplete: () => void,
        model?: string,
        saveToGraph: boolean = false
    ) {
        if (this.abortController) {
            this.abortController.abort();
        }

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            // Determine the base URL based on the port selection
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const engineBaseUrl = baseUrl; // Engine is always remote (for Search/Memory)

            // 0. Fetch Model Status / Budget (Only needed for Remote usually, but good for context planning)
            // For WebLLM, we know our limits (e.g. 4k context).
            let maxContextChars = 8000; // ~2000 tokens default

            // 1. Get Context (Memory/Molecule Search) - ALWAYS REMOTE (Engine)
            // SKIPPED if useAnchorContext is false
            let context = '';
            if (this.useAnchorContext) {
                try {
                    const moleculeResponse = await fetch(`${engineBaseUrl}/v1/memory/molecule-search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: content,
                            max_chars: maxContextChars,
                            provenance: 'all'
                        }),
                        signal
                    });

                    if (moleculeResponse.ok) {
                        const moleculeData = await moleculeResponse.json();
                        context = moleculeData.context || '';
                    }
                } catch (e: any) {
                    if (e.name === 'AbortError') throw e;
                    console.warn('[Chat] Failed to fetch context:', e);
                }
            }

            // Prepare base messages
            const messages = [
                { role: 'system', content: `You are a helpful AI assistant. Use the following context to inform your responses:\n\n${context}` },
                { role: 'user', content }
            ];

            // --- BRANCH: WEBLLM (Browser Inference) ---
            if (this.backend === 'webllm') {
                await this.handleWebLLM(messages, onMessage, onError, onComplete, engineBaseUrl, model);
                return;
            }

            // --- BRANCH: REMOTE (HTTP Inference Server) ---
            await this.handleRemote(content, context, model, saveToGraph, onMessage, onComplete, signal, baseUrl);

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            onError(error.message);
        } finally {
            this.abortController = null;
        }
    }

    private async handleWebLLM(
        messages: any[],
        onMessage: (msg: Partial<Message>) => void,
        onError: (error: string) => void,
        onComplete: () => void,
        engineUrl: string,
        model?: string
    ) {
        // Ensure Engine is ready
        if (!webLLMService.isInitialized()) {
            if (webLLMService.isLoadingModel()) {
                onMessage({ role: 'system', content: '⏳ Loading model... Please wait.' });
            }
            try {
                await webLLMService.initialize(model);
            } catch (e: any) {
                const errorMsg = `Failed to load WebLLM model: ${e.message}. Try switching to Remote backend or select a different model.`;
                console.error('[Chat] WebLLM init error:', e);
                onError(errorMsg);
                return;
            }
        }

        // TOOL SYSTEM PROMPT
        const toolInstructions = `[TOOL CAPABILITY]: You have access to a semantic database (ECE).
To search for information, output a search query wrapped in tags like this: <search>your query here</search>.
Stop generating after outputting the tag.
When you receive the search results, answer the user's question using that information.`;

        // Merge tool instructions with existing system prompt to avoid multiple system messages
        const effectiveMessages = [...messages];
        if (effectiveMessages.length > 0 && effectiveMessages[0].role === 'system') {
            effectiveMessages[0] = {
                ...effectiveMessages[0],
                content: `${toolInstructions}\n\n${effectiveMessages[0].content}`
            };
        } else {
            effectiveMessages.unshift({ role: 'system', content: toolInstructions });
        }
        let currentFullText = "";

        // streaming update handler
        const onUpdate = (text: string) => {
            currentFullText = text;
            onMessage({ role: 'assistant', content: text });
        };

        // 1. First Pass Generation
        await webLLMService.generate(effectiveMessages, onUpdate);

        // 2. Check for Tool Call
        const searchMatch = currentFullText.match(/<search>(.*?)<\/search>/s);
        if (searchMatch) {
            const query = searchMatch[1].trim();
            console.log(`[Chat] WebLLM Tool Call: ${query}`);

            // A. Execute Search (Remote to Engine)
            let toolResult = "[No results found]";
            try {
                const searchRes = await fetch(`${engineUrl}/v1/memory/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, deep: false })
                });
                const searchJson = await searchRes.json();
                if (searchJson.results && searchJson.results.length > 0) {
                    toolResult = searchJson.results.map((r: any) => `- ${r.content.substring(0, 300)}...`).join('\n');
                }
            } catch (e) {
                console.error("[Chat] Tool execution failed", e);
                toolResult = "[Error executing search]";
            }

            // B. Feed back to Model
            effectiveMessages.push({ role: 'assistant', content: currentFullText });
            effectiveMessages.push({ role: 'user', content: `TOOL OUTPUT:\n${toolResult}\n\nNow please answer the user's question.` });

            // C. Second Pass Generation
            console.log(`[Chat] WebLLM Second Pass with Tool Output`);
            const onAnswerUpdate = (text: string) => {
                onMessage({ role: 'assistant', content: text });
            };

            await webLLMService.generate(effectiveMessages, onAnswerUpdate);
        }

        onComplete();
    }

    private async handleRemote(
        content: string,
        context: string,
        model: string | undefined,
        saveToGraph: boolean,
        onMessage: (msg: Partial<Message>) => void,
        onComplete: () => void,
        signal: AbortSignal,
        baseUrl: string
    ) {
        const chatBaseUrl = baseUrl;
        const messages = [
            { role: 'system', content: `You are a helpful AI assistant. Use the following context to inform your responses:\n\n${context}` },
            { role: 'user', content }
        ];

        const requestBody: any = {
            messages,
            save_to_graph: saveToGraph
        };
        if (model) requestBody.model = model;

        const response = await fetch(`${chatBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data.trim() === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        // Standard OpenAI format
                        if (parsed.choices && parsed.choices[0]) {
                            const content = parsed.choices[0].delta?.content || '';
                            if (content) onMessage({ role: 'assistant', content });
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        }
        onComplete();
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
}

export const chatService = new ChatService();
