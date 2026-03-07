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
        return <div className="dark-glass-neon p-8 text-center max-w-3xl"><div className="animate-spin w-8 h-8 border-[3px] border-green-500/30 border-t-green-500 rounded-full mx-auto" /></div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                        <SparklesIcon className="w-5 h-5 text-green-400" />
                        AI Chat
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">Ask questions about your vault files — powered by Pinecone + Groq.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/search')}
                    className="gradient-button-small flex items-center gap-1.5 text-xs"
                >
                    Search Vault
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                {messages.length === 0 && (
                    <div className="dark-glass-neon p-8 text-center mt-8">
                        <SparklesIcon className="w-10 h-10 text-green-500/30 mx-auto mb-3" />
                        <h3 className="text-sm font-medium text-white mb-1">Ready to chat</h3>
                        <p className="text-gray-600 text-xs">
                            Ask anything about your uploaded files. The AI will find relevant context from your vault.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {['What files do I have?', 'Summarize my documents', 'Find my Aadhaar details'].map(q => (
                                <button
                                    key={q}
                                    onClick={() => setInput(q)}
                                    className="px-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] text-gray-500 rounded-full hover:border-white/[0.1] hover:text-gray-400 transition-all"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role !== 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="w-3.5 h-3.5 text-green-400" />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl p-3.5 ${msg.role === 'user'
                            ? 'bg-white/[0.06] border border-white/[0.08] text-white'
                            : msg.role === 'system'
                                ? 'bg-red-500/[0.06] border border-red-500/20 text-red-400'
                                : 'bg-white/[0.02] border border-white/[0.06] text-gray-300'
                            }`}>
                            {/* Files used */}
                            {msg.filesUsed && msg.filesUsed.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {[...new Set(msg.filesUsed)].map((f, j) => (
                                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/[0.08] text-green-400 text-[10px] rounded-full border border-green-500/20">
                                            <DocumentTextIcon className="w-2.5 h-2.5" />
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                            {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" />
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                                <UserCircleIcon className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2">
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
                    className="gradient-button !w-auto px-4 flex items-center gap-2"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
