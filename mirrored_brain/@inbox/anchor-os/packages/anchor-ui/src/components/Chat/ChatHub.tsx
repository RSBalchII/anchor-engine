/**
 * ChatHub - Unified Chat Interface (Browser-First Architecture)
 * 
 * Features:
 * - Smart routing: Browser WebLLM first, Nanobot fallback
 * - Real-time backend status indicator
 * - Session management sidebar
 * - Tool execution integration
 * - Fixed message duplication bug
 */

import React, { useState, useRef, useEffect } from 'react';
import { chatService } from '../../services/chat';
import { webLLMService } from '../../services/web-llm';
import { nanobotClient } from '../../services/nanobot';
import type { Message, ChatState } from '../../types/chat';
import { Button } from '../ui/Button';
import { SessionSidebar } from './SessionSidebar';
import { AgentInterface } from './AgentInterface';
import { TelegramView } from './TelegramView';

interface ChatHubProps {
    model?: string;
    useInferenceServer?: boolean;
    setUseInferenceServer?: (val: boolean) => void;
}

export const ChatHub: React.FC<ChatHubProps> = ({ 
    model, 
    useInferenceServer = false,
    setUseInferenceServer 
}) => {
    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [input, setInput] = useState('');
    
    // Settings
    const [saveToGraph, setSaveToGraph] = useState(false);
    const [useAnchorContext, setUseAnchorContext] = useState(true);
    const [modelLoadingProgress, setModelLoadingProgress] = useState<{ text: string; progress: number } | null>(null);
    
    // Backend status
    const [backendStatus, setBackendStatus] = useState<'browser' | 'nanobot' | 'loading' | 'error'>('loading');
    
    // UI state
    const [showSidebar, setShowSidebar] = useState(true);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const [showTelegram, setShowTelegram] = useState(false);
    const [activeSession, setActiveSession] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    
    // Track the current assistant message being generated (fixes duplication)
    const currentAssistantRef = useRef<Message | null>(null);

    // Initialize backend detection
    useEffect(() => {
        detectBackend();
        const interval = setInterval(detectBackend, 5000);
        return () => clearInterval(interval);
    }, []);

    // Sync context toggle
    useEffect(() => {
        chatService.setUseAnchorContext(useAnchorContext);
    }, [useAnchorContext]);

    // Setup WebLLM progress
    useEffect(() => {
        if (backendStatus === 'browser') {
            const callback = (report: { text: string; progress: number }) => {
                setModelLoadingProgress(report);
            };
            webLLMService.setProgressCallback(callback);
            return () => webLLMService.setProgressCallback(() => {});
        } else {
            setModelLoadingProgress(null);
        }
    }, [backendStatus]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * Detect available backend
     */
    const detectBackend = async () => {
        setBackendStatus('loading');
        
        if (webLLMService.isInitialized()) {
            setBackendStatus('browser');
            chatService.setBackend('webllm');
            return;
        }

        const nanobotAvailable = await nanobotClient.isAvailable();
        if (nanobotAvailable) {
            setBackendStatus('nanobot');
            chatService.setBackend('nanobot');
            return;
        }

        if (!webLLMService.isLoadingModel()) {
            try {
                await webLLMService.initialize(model);
                setBackendStatus('browser');
                chatService.setBackend('webllm');
            } catch (error: any) {
                console.error('Failed to load browser model:', error);
                setBackendStatus('error');
            }
        }
    };

    /**
     * Handle send message - FIXED to prevent duplication
     */
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        // Add user message
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setError(null);
        
        // Reset current assistant ref
        currentAssistantRef.current = null;

        try {
            // Create assistant message placeholder
            const assistantMsg: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };

            await chatService.sendMessage(
                input,
                // onMessage callback - FIXED: Only update, don't duplicate
                (msg) => {
                    if (msg.content) {
                        // Update the current assistant message content
                        currentAssistantRef.current = {
                            ...assistantMsg,
                            content: msg.content
                        };
                        
                        // Update messages array with the current content
                        setMessages(prev => {
                            const filtered = prev.filter(m => m.id !== assistantMsg.id);
                            return [...filtered, currentAssistantRef.current!];
                        });
                    }
                },
                // onError callback
                (errMsg) => {
                    setError(errMsg);
                    setIsLoading(false);
                },
                // onComplete callback
                () => {
                    setIsLoading(false);
                    currentAssistantRef.current = null;
                },
                model,
                saveToGraph
            );
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClear = () => {
        setMessages([]);
        setError(null);
        currentAssistantRef.current = null;
    };

    const getBackendDisplay = () => {
        switch (backendStatus) {
            case 'browser':
                return { icon: '🟢', text: 'Browser Inference', color: '#4ade80' };
            case 'nanobot':
                return { icon: '🟡', text: 'Server Fallback', color: '#fbbf24' };
            case 'loading':
                return { icon: '⏳', text: 'Loading Model...', color: '#60a5fa' };
            case 'error':
                return { icon: '🔴', text: 'No Backend Available', color: '#f87171' };
        }
    };

    const backendInfo = getBackendDisplay();

    // Render Telegram view
    if (showTelegram) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setShowTelegram(false)}>← Back to Chat</Button>
                </div>
                <TelegramView />
            </div>
        );
    }

    return (
        <div style={{ 
            display: 'flex', 
            height: '100%', 
            gap: '1rem',
            padding: '1rem'
        }}>
            {/* Sidebar */}
            {showSidebar && (
                <SessionSidebar 
                    onSelectSession={(id) => setActiveSession(id)}
                    onCreateSession={() => {}}
                />
            )}

            {/* Main Chat Area */}
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                minWidth: 0
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '0.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{backendInfo.icon}</span>
                        <div>
                            <div style={{ fontWeight: 600, color: backendInfo.color }}>
                                {backendInfo.text}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                Model: {model || 'Default'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button onClick={() => setShowSidebar(!showSidebar)}>
                            {showSidebar ? '◀' : '▶'}
                        </Button>
                        <Button onClick={() => setShowAgentPanel(!showAgentPanel)}>
                            🤖 Agent
                        </Button>
                        <Button onClick={() => setShowTelegram(true)}>
                            💬 Telegram
                        </Button>
                        <Button
                            onClick={() => setUseAnchorContext(!useAnchorContext)}
                            style={{ background: useAnchorContext ? 'rgba(100, 108, 255, 0.2)' : 'transparent' }}
                        >
                            🧠 Context
                        </Button>
                        <Button onClick={handleClear}>🗑️</Button>
                    </div>
                </div>

                {/* Loading Progress */}
                {modelLoadingProgress && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#60a5fa' }}>
                            {modelLoadingProgress.text}
                        </div>
                        <div style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            borderRadius: '2px',
                            marginTop: '0.5rem'
                        }}>
                            <div style={{
                                width: `${modelLoadingProgress.progress * 100}%`,
                                height: '100%',
                                background: '#60a5fa',
                                borderRadius: '2px',
                                transition: 'width 0.3s'
                            }} />
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem'
                }}>
                    {messages.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#6b7280',
                            gap: '1rem'
                        }}>
                            <div style={{ fontSize: '3rem' }}>🤖</div>
                            <div style={{ fontSize: '1.125rem' }}>Start a conversation</div>
                            <div style={{ fontSize: '0.875rem' }}>
                                {backendStatus === 'browser' 
                                    ? 'Running locally in browser'
                                    : backendStatus === 'nanobot'
                                    ? 'Running on Nanobot server'
                                    : 'Loading inference engine...'}
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        marginBottom: '1rem',
                                        display: 'flex',
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <div
                                        style={{
                                            maxWidth: '70%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.75rem',
                                            background: msg.role === 'user' 
                                                ? 'rgba(100, 108, 255, 0.2)' 
                                                : 'rgba(255, 255, 255, 0.1)',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && !messages.find(m => m.role === 'assistant' && !m.content) && (
                                <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                                    Thinking...
                                </div>
                            )}
                            {error && (
                                <div style={{
                                    color: '#f87171',
                                    fontSize: '0.875rem',
                                    padding: '0.75rem',
                                    background: 'rgba(248, 113, 113, 0.1)',
                                    borderRadius: '0.5rem'
                                }}>
                                    Error: {error}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Agent Panel */}
                {showAgentPanel && (
                    <div style={{ marginBottom: '1rem' }}>
                        <AgentInterface messages={messages} />
                    </div>
                )}

                {/* Input */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        rows={3}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            resize: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: isLoading || !input.trim() 
                                ? 'rgba(255, 255, 255, 0.1)' 
                                : 'rgba(100, 108, 255, 0.8)',
                            opacity: isLoading || !input.trim() ? 0.5 : 1
                        }}
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
};
