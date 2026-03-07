'use client';

/**
 * app/dashboard/search/page.tsx
 *
 * Server-side semantic search powered by Pinecone + Gemini embeddings.
 * No passphrase needed for search — only for downloading encrypted files.
 */

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    MagnifyingGlassIcon,
    SparklesIcon,
    ShieldCheckIcon,
    DocumentIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface FileResult {
    fileId: string;
    fileName: string;
    fileType: string;
    score: number;
    excerpts: string[];
    fileSize: number;
    uploadDate: string;
}

type StatusType = 'idle' | 'info' | 'success' | 'error';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx'].includes(ext || '')) return '📘';
    if (['txt', 'md'].includes(ext || '')) return '📄';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return '🖼️';
    return '📎';
}

function ScoreBar({ score }: { score: number }) {
    const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 w-8 text-right">{score}%</span>
        </div>
    );
}

export default function SearchPage() {
    const { status } = useSession({ required: true });
    const router = useRouter();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FileResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [statusType, setStatusType] = useState<StatusType>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    const setStatus = (type: StatusType, msg: string) => { setStatusType(type); setStatusMsg(msg); };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setResults([]);
        setHasSearched(false);
        setStatus('info', 'Searching your vault with Gemini + Pinecone...');

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query.trim() }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Search failed: HTTP ${res.status}`);
            }

            const { results: fileResults } = await res.json() as { results: FileResult[] };

            setResults(fileResults);
            setHasSearched(true);
            setStatus(
                fileResults.length > 0 ? 'success' : 'info',
                fileResults.length > 0
                    ? `Found ${fileResults.length} relevant file${fileResults.length !== 1 ? 's' : ''}.`
                    : `No relevant files found for "${query}". Try different keywords.`
            );
        } catch (error: any) {
            console.error('[Search]', error);
            setStatus('error', `Search failed: ${error.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    if (status === 'loading') {
        return <div className="dark-glass-neon p-8 text-center max-w-3xl"><div className="animate-spin w-8 h-8 border-[3px] border-green-500/30 border-t-green-500 rounded-full mx-auto" /></div>;
    }

    return (
        <div className="space-y-5 max-w-3xl">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Semantic Search</h1>
                    <p className="text-gray-500 text-sm mt-1">Search your vault by meaning — powered by Gemini + Pinecone.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/chat')}
                    className="gradient-button-small flex items-center gap-1.5"
                >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    AI Chat
                </button>
            </div>

            {/* Info */}
            <div className="dark-glass-neon p-4 flex items-start gap-3">
                <ShieldCheckIcon className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="font-semibold text-green-400">How it works:</span> Your query is embedded by Gemini, then matched against your document vectors in Pinecone. Results are ranked by semantic similarity.
                </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="dark-glass-neon p-5 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Search Query</label>
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={isSearching}
                            className="dark-glass-input pl-9"
                            placeholder='e.g. "quarterly revenue" or "passport scan"'
                        />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">Finds semantically related content — not just exact keyword matches.</p>
                </div>
                <button type="submit" disabled={isSearching || !query.trim()} className="gradient-button">
                    {isSearching ? (
                        <span className="flex items-center gap-2 justify-center">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Searching...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 justify-center"><MagnifyingGlassIcon className="w-4 h-4" />Search Vault</span>
                    )}
                </button>
            </form>

            {/* Status */}
            {statusMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${statusType === 'error' ? 'bg-red-500/[0.08] text-red-400 border-red-500/20' :
                    statusType === 'success' ? 'bg-green-500/[0.08] text-green-400 border-green-500/20' :
                        'bg-blue-500/[0.08] text-blue-400 border-blue-500/20'
                    }`}>
                    {statusType === 'error' && <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    {statusMsg}
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Results</p>
                    {results.map((file) => (
                        <div key={file.fileId} className="dark-glass-neon p-4 hover:border-white/[0.1] transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <span className="text-xl flex-shrink-0">{getFileIcon(file.fileName)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{file.fileName}</p>
                                        <p className="text-[10px] text-gray-600 mt-0.5">
                                            {formatBytes(file.fileSize)} · {new Date(file.uploadDate).toLocaleDateString()}
                                        </p>
                                        <div className="mt-2 max-w-[180px]"><ScoreBar score={file.score} /></div>
                                        {file.excerpts.length > 0 && (
                                            <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 italic">
                                                &ldquo;{file.excerpts[0]}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasSearched && results.length === 0 && statusType !== 'error' && (
                <div className="dark-glass-neon p-10 text-center">
                    <DocumentIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No matching files found.</p>
                    <p className="text-gray-600 text-xs mt-1">Try different keywords or upload more files.</p>
                </div>
            )}
        </div>
    );
}
