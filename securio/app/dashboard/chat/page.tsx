'use client';

/**
 * app/dashboard/chat/page.tsx
 *
 * AI Chat powered by Pinecone (context retrieval) + Groq (response generation).
 * No passphrase needed — the server handles everything.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    DocumentTextIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    filesUsed?: string[];
}

export default function ChatPage() {
    const { status } = useSession({ required: true });
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    sessionId: sessionId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Chat failed: HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let assistantContent = '';
            let filesUsed: string[] = [];

            // Add empty assistant message for streaming
            setMessages(prev => [...prev, { role: 'assistant', content: '', filesUsed: [] }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter(l => l.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'session') {
                            setSessionId(data.sessionId);
                        } else if (data.type === 'context') {
                            filesUsed = data.filesUsed || [];
                            // Update system info
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    last.filesUsed = filesUsed;
                                }
                                return updated;
                            });
                        } else if (data.type === 'token') {
                            assistantContent += data.content;
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    last.content = assistantContent;
                                }
                                return updated;
                            });
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message !== 'Unexpected end of JSON input') {
                            console.warn('[Chat] Parse warning:', parseErr.message);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('[Chat]', error);
            setMessages(prev => [
                ...prev.filter(m => !(m.role === 'assistant' && m.content === '')),
                { role: 'system', content: `⚠️ ${error.message}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'loading') {
        return <div className="dark-glass-neon p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full mx-auto" /></div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-green-400" />
                        AI Chat
                    </h1>
                    <p className="text-gray-400 text-sm">Ask questions about your vault files — powered by Pinecone + Groq.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/search')}
                    className="gradient-button-small flex items-center gap-1.5 text-sm"
                >
                    Search Vault
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.length === 0 && (
                    <div className="dark-glass-neon p-8 text-center mt-8">
                        <SparklesIcon className="w-12 h-12 text-green-400/50 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-white mb-1">Ready to chat</h3>
                        <p className="text-gray-500 text-sm">
                            Ask anything about your uploaded files. The AI will automatically find relevant context from your vault.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {['What files do I have?', 'Summarize my documents', 'Find my Aadhaar details'].map(q => (
                                <button
                                    key={q}
                                    onClick={() => setInput(q)}
                                    className="px-3 py-1.5 text-xs bg-gray-800/50 text-gray-400 rounded-full hover:bg-gray-700/50 hover:text-gray-300 transition"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role !== 'user' && (
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="w-4 h-4 text-green-400" />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl p-4 ${msg.role === 'user'
                                ? 'bg-green-600/20 border border-green-500/30 text-white'
                                : msg.role === 'system'
                                    ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-200'
                            }`}>
                            {/* Show files used */}
                            {msg.filesUsed && msg.filesUsed.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {[...new Set(msg.filesUsed)].map((f, j) => (
                                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                                            <DocumentTextIcon className="w-3 h-3" />
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <UserCircleIcon className="w-4 h-4 text-blue-400" />
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-3">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className="dark-glass-input flex-1"
                    placeholder="Ask about your files..."
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="gradient-button px-4 flex items-center gap-2"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send
                </button>
            </form>
        </div>
    );
}
