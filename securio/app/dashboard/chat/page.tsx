'use client';

/**
 * app/dashboard/chat/page.tsx
 *
 * AI Chat with your encrypted vault — powered by LangChain + Gemini 1.5 Flash.
 *
 * Pipeline:
 * 1. User enters passphrase + question
 * 2. Client decrypts private key (browser)
 * 3. Client fetches + decrypts top-K relevant files (browser)
 * 4. Client sends {query, context[]} to /api/chat
 * 5. Server runs LangGraph RAG chain → Gemini streams response
 * 6. Response streamed back via SSE
 *
 * The server never sees your encrypted files — only the context you send.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { decryptWithPassphrase, decryptAesKeyWithRsa, decryptFileWithAes } from '@/lib/client/client-crypto';
import { searchVault, type VaultFile } from '@/lib/client/vector-client';
import { extractText } from '@/lib/client/text-extractor';
import {
    SparklesIcon,
    PaperAirplaneIcon,
    ShieldCheckIcon,
    LockClosedIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export default function ChatPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [passphrase, setPassphrase] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [unlockError, setUnlockError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>();
    const [statusMsg, setStatusMsg] = useState('');
    const privateKeyRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passphrase.length < 12) { setUnlockError('Passphrase must be at least 12 characters.'); return; }
        setIsUnlocking(true);
        setUnlockError('');
        try {
            const pkRes = await fetch('/api/user/encrypted-private-key');
            if (!pkRes.ok) throw new Error('Failed to fetch key material');
            const { encryptedPrivateKey } = await pkRes.json();
            const privateKeyPem = await decryptWithPassphrase(encryptedPrivateKey, passphrase);
            if (!privateKeyPem) { setUnlockError('Invalid passphrase.'); return; }
            privateKeyRef.current = privateKeyPem;
            setIsUnlocked(true);
            setMessages([{
                role: 'assistant',
                content: "Vault unlocked! I can now search and read your encrypted files to answer your questions. What would you like to know?",
            }]);
        } catch (error: any) {
            setUnlockError(`Failed to unlock: ${error.message}`);
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSending || !privateKeyRef.current) return;

        const userMessage = input.trim();
        setInput('');
        setIsSending(true);
        setStatusMsg('');

        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        // Add placeholder for assistant
        setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

        try {
            // Step 1: Fetch all vectors and find relevant files
            setStatusMsg('Searching vault for relevant files...');
            console.log('[Chat] Step 1: Fetching vectors...');
            const vectorsRes = await fetch('/api/vectors');
            if (!vectorsRes.ok) throw new Error('Failed to fetch vectors');
            const { files } = await vectorsRes.json() as { files: VaultFile[] };
            console.log('[Chat] Files fetched:', files.length, '| with vectors:', files.filter(f => f.encryptedVector).length);

            // Step 2: Semantic search to find top-K relevant files
            let context: Array<{ fileName: string; excerpt: string; relevanceScore: number }> = [];

            const indexedFiles = files.filter(f => f.encryptedVector);
            console.log('[Chat] Indexed files:', indexedFiles.map(f => f.fileName));
            if (indexedFiles.length > 0) {
                setStatusMsg('Finding relevant files...');
                console.log('[Chat] Step 2: Running searchVault...');
                const searchResults = await searchVault(userMessage, files, privateKeyRef.current!, 3);
                console.log('[Chat] Search results:', searchResults.length, searchResults.map(r => ({ name: r.fileName, score: r.score })));

                // Step 3: Decrypt top-K files and extract text for context
                setStatusMsg('Decrypting relevant files...');
                for (const result of searchResults.slice(0, 3)) {
                    try {
                        console.log('[Chat] Step 3: Decrypting file:', result.fileName);
                        const aesKeyHex = await decryptAesKeyWithRsa(result.encryptedAesKey, privateKeyRef.current!);
                        console.log('[Chat] AES key decrypted, length:', aesKeyHex.length);
                        const fileUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${result.cloudinaryPublicId}`;
                        console.log('[Chat] Fetching file from:', fileUrl);
                        const response = await fetch(fileUrl);
                        if (!response.ok) { console.warn('[Chat] File fetch failed:', response.status); continue; }
                        const payload = await response.json();
                        console.log('[Chat] Payload keys:', Object.keys(payload));
                        const encryptedBase64: string = payload.file?.split(',')[1] ?? payload.file;
                        const decryptedBuffer = await decryptFileWithAes(encryptedBase64, aesKeyHex, payload.iv);
                        const { text } = await extractText(decryptedBuffer, result.fileName);
                        console.log('[Chat] Extracted text length:', text.trim().length, 'chars');
                        if (text.trim()) {
                            context.push({
                                fileName: result.fileName,
                                excerpt: text.slice(0, 2000),
                                relevanceScore: result.score,
                            });
                        }
                    } catch (fileErr: any) {
                        console.error('[Chat] File processing failed:', result.fileName, fileErr.message);
                    }
                }
            }

            console.log('[Chat] Context items:', context.length, context.map(c => ({ file: c.fileName, chars: c.excerpt.length })));
            setStatusMsg('Generating answer...');

            // Step 4: Stream from /api/chat
            const chatRes = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMessage, context, sessionId }),
            });

            if (!chatRes.ok) {
                const err = await chatRes.json();
                throw new Error(err.error || 'Chat request failed');
            }

            // Step 5: Stream SSE response
            const reader = chatRes.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'session') {
                            setSessionId(data.sessionId);
                        } else if (data.type === 'token') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, content: last.content + data.content };
                                }
                                return updated;
                            });
                        } else if (data.type === 'done') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, isStreaming: false };
                                }
                                return updated;
                            });
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch {
                        // Skip malformed SSE lines
                    }
                }
            }
        } catch (error: any) {
            console.error('[Chat]', error);
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: `Sorry, I encountered an error: ${error.message}`,
                        isStreaming: false,
                    };
                }
                return updated;
            });
        } finally {
            setIsSending(false);
            setStatusMsg('');
        }
    };

    if (status === 'loading') {
        return <div className="dark-glass-neon p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full mx-auto" /></div>;
    }

    // Unlock screen
    if (!isUnlocked) {
        return (
            <div className="max-w-md mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="w-8 h-8 text-green-400" />
                        AI Vault Chat
                    </h1>
                    <p className="text-gray-400 mt-1">Chat with your encrypted files using Gemini AI.</p>
                </div>

                <div className="dark-glass-neon p-4 flex items-start gap-3 border border-green-500/20">
                    <ShieldCheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-300">
                        <span className="font-semibold text-green-400">Zero-Knowledge RAG:</span> Your files are decrypted locally in your browser. Only the relevant text excerpts are sent to Gemini — your encrypted files never leave your device.
                    </p>
                </div>

                <form onSubmit={handleUnlock} className="dark-glass-neon p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <LockClosedIcon className="w-5 h-5 text-gray-400" />
                        <h2 className="font-semibold text-white">Unlock Your Vault</h2>
                    </div>
                    {unlockError && (
                        <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm">{unlockError}</div>
                    )}
                    <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        disabled={isUnlocking}
                        className="dark-glass-input"
                        placeholder="Enter your master passphrase"
                        autoComplete="current-password"
                    />
                    <button type="submit" disabled={isUnlocking || passphrase.length < 12} className="gradient-button">
                        {isUnlocking ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Unlocking...
                            </span>
                        ) : 'Unlock & Start Chatting'}
                    </button>
                </form>
            </div>
        );
    }

    // Chat interface
    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-green-400" />
                        AI Vault Chat
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">Powered by Gemini 1.5 Flash · Context from your encrypted files</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/search')}
                    className="gradient-button-small flex items-center gap-1.5"
                >
                    <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                    Search
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                            ? 'bg-green-500/20 text-white border border-green-500/30'
                            : 'dark-glass-neon text-gray-200'
                            }`}>
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-1.5 mb-2">
                                    <SparklesIcon className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-xs font-semibold text-green-400">Gemini</span>
                                </div>
                            )}
                            {msg.content || (msg.isStreaming && (
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {statusMsg && (
                    <div className="flex justify-start">
                        <div className="text-xs text-gray-500 italic px-2">{statusMsg}</div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isSending}
                    className="dark-glass-input flex-1"
                    placeholder="Ask anything about your files..."
                    autoComplete="off"
                />
                <button
                    type="submit"
                    disabled={isSending || !input.trim()}
                    className="gradient-button-small px-4 flex items-center gap-1.5"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
