'use client';

/**
 * app/dashboard/search/page.tsx
 *
 * Privacy-preserving semantic search powered by LangChain + Gemini.
 *
 * Pipeline:
 * 1. User enters passphrase + query
 * 2. Client decrypts RSA private key from passphrase (browser)
 * 3. Server embeds query with Gemini text-embedding-004 (/api/search/embed)
 * 4. Client fetches all encrypted vectors (/api/vectors)
 * 5. Client decrypts each vector: RSA → AES key → vector (browser)
 * 6. Client ranks by cosine similarity (browser)
 * 7. Results shown with relevance scores
 * 8. User can decrypt & download any result
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { decryptWithPassphrase, decryptAesKeyWithRsa, decryptFileWithAes } from '@/lib/client/client-crypto';
import { searchVault, type VaultFile, type SearchResult } from '@/lib/client/vector-client';
import { extractText } from '@/lib/client/text-extractor';
import { saveAs } from 'file-saver';
import {
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    ArrowDownTrayIcon,
    DocumentIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
        pdf: '📄', txt: '📝', md: '📝', doc: '📃', docx: '📃',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️',
    };
    return icons[ext ?? ''] ?? '📁';
}

function ScoreBar({ score }: { score: number }) {
    const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-gray-600';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-xs text-gray-400 w-8 text-right">{score}%</span>
        </div>
    );
}

export default function SearchPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [passphrase, setPassphrase] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [statusType, setStatusType] = useState<'idle' | 'info' | 'success' | 'error'>('idle');
    const [isSearching, setIsSearching] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [isReindexing, setIsReindexing] = useState(false);
    const [reindexProgress, setReindexProgress] = useState('');
    const privateKeyRef = useRef<string | null>(null);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const setStatus = (type: typeof statusType, msg: string) => {
        setStatusType(type);
        setStatusMsg(msg);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) { setStatus('error', 'Please enter a search query.'); return; }
        if (passphrase.length < 12) { setStatus('error', 'Please enter your master passphrase (min 12 chars).'); return; }

        setIsSearching(true);
        setResults([]);
        setHasSearched(false);
        privateKeyRef.current = null;

        try {
            // Step 1: Fetch encrypted private key
            setStatus('info', 'Verifying passphrase...');
            const pkRes = await fetch('/api/user/encrypted-private-key');
            if (!pkRes.ok) throw new Error('Failed to fetch key material');
            const { encryptedPrivateKey } = await pkRes.json();

            // Step 2: Decrypt private key in browser
            const privateKeyPem = await decryptWithPassphrase(encryptedPrivateKey, passphrase);
            if (!privateKeyPem) { setStatus('error', 'Invalid passphrase.'); return; }
            privateKeyRef.current = privateKeyPem;

            // Step 3: Fetch all encrypted vectors
            setStatus('info', 'Fetching encrypted index...');
            const vectorsRes = await fetch('/api/vectors');
            if (!vectorsRes.ok) throw new Error('Failed to fetch vectors');
            const { files } = await vectorsRes.json() as { files: VaultFile[] };

            const indexedCount = files.filter(f => f.encryptedVector).length;
            if (indexedCount === 0) {
                setStatus('info', `No indexed files found. Upload files to build your search index. (${files.length} files total)`);
                setHasSearched(true);
                return;
            }

            // Step 4: Run full search pipeline (embed query + decrypt vectors + rank)
            setStatus('info', `Searching ${indexedCount} indexed files with Gemini...`);
            const searchResults = await searchVault(query, files, privateKeyPem);

            setResults(searchResults);
            setHasSearched(true);
            setStatus(
                searchResults.length > 0 ? 'success' : 'info',
                searchResults.length > 0
                    ? `Found ${searchResults.length} relevant file${searchResults.length !== 1 ? 's' : ''} across ${indexedCount} indexed files.`
                    : `No relevant files found for "${query}". Try different keywords.`
            );
        } catch (error: any) {
            console.error('[Search]', error);
            setStatus('error', `Search failed: ${error.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    // Re-index ALL files (including ones with bad/stale vectors)
    const handleReindex = async () => {
        if (passphrase.length < 12) { setStatus('error', 'Enter your passphrase first.'); return; }
        setIsReindexing(true);
        setReindexProgress('');
        try {
            // Decrypt private key
            const pkRes = await fetch('/api/user/encrypted-private-key');
            const { encryptedPrivateKey } = await pkRes.json();
            const privateKeyPem = await decryptWithPassphrase(encryptedPrivateKey, passphrase);
            if (!privateKeyPem) { setStatus('error', 'Invalid passphrase.'); return; }

            // Get ALL files (re-index everything to fix any bad vectors)
            const vectorsRes = await fetch('/api/vectors');
            const { files } = await vectorsRes.json() as { files: VaultFile[] };

            if (files.length === 0) { setStatus('info', 'No files to index.'); return; }

            let indexed = 0;
            let failed = 0;
            for (const file of files) {
                setReindexProgress(`Indexing ${file.fileName} (${indexed + failed + 1}/${files.length})...`);
                try {
                    console.log('[Reindex] Processing:', file.fileName);
                    const aesKeyHex = await decryptAesKeyWithRsa(file.encryptedAesKey, privateKeyPem);
                    console.log('[Reindex] AES key decrypted, length:', aesKeyHex.length);
                    const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${file.cloudinaryPublicId}`;
                    const resp = await fetch(fileUrl);
                    if (!resp.ok) { console.warn('[Reindex] Fetch failed:', resp.status); failed++; continue; }
                    const payload = await resp.json();
                    const encBase64: string = payload.file?.split(',')[1] ?? payload.file;
                    const decrypted = await decryptFileWithAes(encBase64, aesKeyHex, payload.iv);
                    const { text, fileType } = await extractText(decrypted, file.fileName);
                    console.log('[Reindex] Text extracted:', text.length, 'chars, type:', fileType);
                    if (!text.trim()) { console.warn('[Reindex] No text extracted for:', file.fileName); failed++; continue; }
                    const vecRes = await fetch('/api/vectorize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id, text, fileName: file.fileName, aesKeyHex, fileType }),
                    });
                    if (!vecRes.ok) {
                        console.error('[Reindex] Vectorize failed:', await vecRes.text());
                        failed++;
                        continue;
                    }
                    const vecData = await vecRes.json();
                    console.log('[Reindex] ✅ Indexed:', file.fileName, vecData);
                    indexed++;
                } catch (e: any) {
                    console.error(`[Reindex] Failed for ${file.fileName}:`, e.message);
                    failed++;
                }
            }
            setStatus('success', `Re-indexed ${indexed}/${files.length} files successfully.${failed > 0 ? ` ${failed} failed.` : ''} You can now search them.`);
        } catch (error: any) {
            setStatus('error', `Re-indexing failed: ${error.message}`);
        } finally {
            setIsReindexing(false);
            setReindexProgress('');
        }
    };

    const handleDownload = async (file: SearchResult) => {
        if (!privateKeyRef.current) { setStatus('error', 'Run a search first to authenticate.'); return; }
        setDownloadingId(file.id);
        try {
            const aesKeyHex = await decryptAesKeyWithRsa(file.encryptedAesKey, privateKeyRef.current);
            const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${file.cloudinaryPublicId}`;
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
            const payload = await response.json();
            const encryptedFileBase64: string = payload.file?.split(',')[1] ?? payload.file;
            const decryptedBuffer = await decryptFileWithAes(encryptedFileBase64, aesKeyHex, payload.iv);
            const mimeTypes: Record<string, string> = {
                pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
                doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
            };
            const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
            saveAs(new Blob([decryptedBuffer], { type: mimeTypes[ext] ?? 'application/octet-stream' }), file.fileName);
        } catch (error: any) {
            setStatus('error', `Download failed: ${error.message}`);
        } finally {
            setDownloadingId(null);
        }
    };

    if (status === 'loading') {
        return <div className="dark-glass-neon p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full mx-auto" /></div>;
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Semantic Search</h1>
                    <p className="text-gray-400 mt-1">Search your vault by meaning — powered by Gemini embeddings.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/chat')}
                    className="gradient-button-small flex items-center gap-1.5"
                >
                    <SparklesIcon className="w-4 h-4" />
                    AI Chat
                </button>
            </div>

            {/* ZK Notice */}
            <div className="dark-glass-neon p-4 flex items-start gap-3 border border-green-500/20">
                <ShieldCheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-300">
                    <span className="font-semibold text-green-400">How it works:</span> Your query is embedded by Gemini on the server. Stored vectors are decrypted locally in your browser. Ranking happens client-side — the server never sees your file contents.
                </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="dark-glass-neon p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Master Passphrase</label>
                    <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        disabled={isSearching}
                        className="dark-glass-input"
                        placeholder="Enter your master passphrase"
                        autoComplete="current-password"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Search Query</label>
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={isSearching}
                            className="dark-glass-input pl-9"
                            placeholder='e.g. "quarterly revenue" or "passport scan" or "tax documents"'
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Finds semantically related content — not just exact keyword matches.</p>
                </div>
                <button type="submit" disabled={isSearching || !query.trim() || passphrase.length < 12} className="gradient-button">
                    {isSearching ? (
                        <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            Searching...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2"><MagnifyingGlassIcon className="w-4 h-4" />Search Vault</span>
                    )}
                </button>
            </form>

            {/* Status */}
            {statusMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-start gap-2 ${statusType === 'error' ? 'bg-red-900/50 text-red-300' :
                    statusType === 'success' ? 'bg-green-900/50 text-green-300' :
                        'bg-blue-900/50 text-blue-300'
                    }`}>
                    {statusType === 'error' && <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                        {statusMsg}
                    </div>
                </div>
            )}

            {/* Re-index button — always available */}
            {passphrase.length >= 12 && (
                <div className="dark-glass-neon p-4 flex items-center justify-between border border-yellow-500/20">
                    <div>
                        <p className="text-sm text-gray-300 font-medium">🔄 Re-index all files</p>
                        <p className="text-xs text-gray-500 mt-0.5">Rebuilds search vectors for all files using your passphrase. Fixes any missing or corrupted indexes.</p>
                    </div>
                    <button
                        onClick={handleReindex}
                        disabled={isReindexing}
                        className="gradient-button-small flex items-center gap-1.5 flex-shrink-0 ml-4"
                    >
                        {isReindexing ? (
                            <span className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                {reindexProgress || 'Indexing...'}
                            </span>
                        ) : 'Rebuild Index'}
                    </button>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-white">Results</h2>
                    {results.map((file) => (
                        <div key={file.id} className="dark-glass-neon p-5 hover:border-green-500/30 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <span className="text-2xl flex-shrink-0">{getFileIcon(file.fileName)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white truncate">{file.fileName}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.fileSize)} · {new Date(file.uploadDate).toLocaleDateString()}</p>
                                        <div className="mt-2 max-w-[200px]"><ScoreBar score={file.scorePercent} /></div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDownload(file)}
                                    disabled={downloadingId !== null}
                                    className="gradient-button-small flex items-center gap-1.5 flex-shrink-0"
                                >
                                    {downloadingId === file.id
                                        ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        : <ArrowDownTrayIcon className="w-3.5 h-3.5" />}
                                    {downloadingId === file.id ? 'Decrypting...' : 'Download'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasSearched && results.length === 0 && statusType !== 'error' && (
                <div className="dark-glass-neon p-10 text-center">
                    <DocumentIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No matching files found.</p>
                    <p className="text-gray-500 text-sm mt-1">Try different keywords or upload more files.</p>
                </div>
            )}
        </div>
    );
}
