/**
 * TelegramView - Telegram Message Bridge
 * 
 * Displays Telegram conversations synced via Nanobot
 * Allows sending messages to Telegram chats
 */

import React, { useState, useEffect } from 'react';
import { nanobotClient, type TelegramMessage } from '../../services/nanobot';
import { Button } from '../ui/Button';
import { GlassPanel } from '../ui/GlassPanel';
import { Input } from '../ui/Input';

interface TelegramViewProps {
    onMessageSelect?: (message: TelegramMessage) => void;
}

interface TelegramChat {
    id: number;
    name: string;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    username?: string;
    lastMessage?: TelegramMessage;
    unreadCount: number;
}

export const TelegramView: React.FC<TelegramViewProps> = ({ onMessageSelect }) => {
    const [chats, setChats] = useState<TelegramChat[]>([]);
    const [selectedChat, setSelectedChat] = useState<number | null>(null);
    const [messages, setMessages] = useState<TelegramMessage[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadChats();
        const interval = setInterval(loadChats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    /**
     * Load Telegram chats from Nanobot
     */
    const loadChats = async () => {
        setLoading(true);
        try {
            const telegramMessages = await nanobotClient.getTelegramMessages(100);
            
            // Group messages by chat
            const chatMap = new Map<number, TelegramChat>();
            
            for (const msg of telegramMessages) {
                const chatId = msg.chat.id;
                if (!chatMap.has(chatId)) {
                    chatMap.set(chatId, {
                        id: chatId,
                        name: msg.from?.username || msg.from?.first_name || `Chat ${chatId}`,
                        type: msg.chat.type,
                        username: msg.from?.username,
                        unreadCount: 0
                    });
                }
                
                // Update last message
                const chat = chatMap.get(chatId)!;
                if (!chat.lastMessage || msg.date > chat.lastMessage.date) {
                    chat.lastMessage = msg;
                }
            }
            
            setChats(Array.from(chatMap.values()).sort((a, b) => {
                const aTime = a.lastMessage?.date || 0;
                const bTime = b.lastMessage?.date || 0;
                return bTime - aTime;
            }));
        } catch (error: any) {
            console.warn('Failed to load Telegram chats:', error.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Select a chat and load its messages
     */
    const handleSelectChat = async (chatId: number) => {
        setSelectedChat(chatId);
        
        try {
            const allMessages = await nanobotClient.getTelegramMessages(50);
            const chatMessages = allMessages.filter(m => m.chat.id === chatId);
            setMessages(chatMessages.sort((a, b) => b.date - a.date));
        } catch (error: any) {
            console.error('Failed to load messages:', error);
        }
    };

    /**
     * Send message to selected chat
     */
    const handleSendMessage = async () => {
        if (!selectedChat || !messageInput.trim()) return;
        
        setSending(true);
        try {
            await nanobotClient.sendTelegramMessage(selectedChat, messageInput.trim());
            setMessageInput('');
            
            // Refresh messages
            await loadChats();
            if (selectedChat) {
                await handleSelectChat(selectedChat);
            }
        } catch (error: any) {
            console.error('Failed to send message:', error);
            alert(`Failed to send: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    /**
     * Format message date
     */
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString();
    };

    return (
        <div style={{ 
            display: 'flex', 
            height: '100%', 
            gap: '1rem',
            padding: '1rem'
        }}>
            {/* Chat List */}
            <div style={{ 
                width: '280px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ 
                    padding: '1rem', 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600
                }}>
                    💬 Telegram
                </div>
                
                {loading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        Loading...
                    </div>
                ) : chats.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        No Telegram messages yet
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat.id)}
                                style={{
                                    padding: '0.75rem',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                    cursor: 'pointer',
                                    background: selectedChat === chat.id 
                                        ? 'rgba(100, 108, 255, 0.2)' 
                                        : 'transparent',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    marginBottom: '0.25rem'
                                }}>
                                    <span style={{ fontWeight: 500 }}>
                                        {chat.type === 'private' ? '👤' : 
                                         chat.type === 'group' ? '👥' : '📢'} {chat.name}
                                    </span>
                                    {chat.lastMessage && (
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {formatDate(chat.lastMessage.date)}
                                        </span>
                                    )}
                                </div>
                                {chat.lastMessage?.text && (
                                    <div style={{ 
                                        fontSize: '0.75rem', 
                                        color: '#9ca3af',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {chat.lastMessage.text}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Message View */}
            <GlassPanel style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                padding: 0
            }}>
                {selectedChat === null ? (
                    <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#6b7280'
                    }}>
                        Select a chat to view messages
                    </div>
                ) : (
                    <>
                        {/* Message Header */}
                        <div style={{
                            padding: '1rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            fontWeight: 600
                        }}>
                            {chats.find(c => c.id === selectedChat)?.name}
                        </div>

                        {/* Messages */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            {messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                                    No messages yet
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        style={{
                                            alignSelf: msg.from?.id === chats.find(c => c.id === selectedChat)?.id 
                                                ? 'flex-end' 
                                                : 'flex-start',
                                            maxWidth: '70%'
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: '0.75rem 1rem',
                                                borderRadius: '0.75rem',
                                                background: msg.from?.id 
                                                    ? 'rgba(100, 108, 255, 0.2)'
                                                    : 'rgba(255, 255, 255, 0.1)',
                                                marginBottom: '0.25rem'
                                            }}
                                        >
                                            {msg.text}
                                        </div>
                                        <div style={{
                                            fontSize: '0.625rem',
                                            color: '#6b7280',
                                            textAlign: msg.from?.id ? 'right' : 'left'
                                        }}>
                                            {formatDate(msg.date)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input */}
                        <div style={{
                            padding: '1rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            gap: '0.5rem'
                        }}>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type a message..."
                                disabled={sending}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '0.5rem',
                                    color: '#fff'
                                }}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={sending || !messageInput.trim()}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    opacity: sending || !messageInput.trim() ? 0.5 : 1
                                }}
                            >
                                {sending ? '...' : 'Send'}
                            </Button>
                        </div>
                    </>
                )}
            </GlassPanel>
        </div>
    );
};
