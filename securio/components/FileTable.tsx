'use client';

/**
 * components/FileTable.tsx
 *
 * TRUE ZK DECRYPT FLOW:
 * 1. User enters passphrase
 * 2. Browser decrypts RSA private key from passphrase (PBKDF2 + AES-GCM)
 * 3. Browser fetches encrypted AES key from server (server action — no crypto)
 * 4. Browser decrypts AES key using RSA private key (RSA-OAEP)
 * 5. Browser fetches encrypted file from Cloudinary
 * 6. Browser decrypts file using AES key (AES-GCM)
 * 7. Browser triggers download — file never stored anywhere
 *
 * The RSA private key NEVER leaves the browser.
 * The plaintext AES key NEVER leaves the browser.
 * The server is a blind storage layer.
 */

import React, { useState } from 'react';
import { decryptWithPassphrase, decryptAesKeyWithRsa, decryptFileWithAes } from '@/lib/client/client-crypto';
import { getEncryptedAesKey } from '@/app/actions/decrypt';
import { saveAs } from 'file-saver';
import {
    DocumentIcon,
    LockOpenIcon,
    ArrowDownTrayIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface FileRecord {
    id: string;
    fileName: string;
    fileSize: number;
    uploadDate: Date;
    cloudinaryPublicId: string;
    encryptedAesKey: string;
}

interface FileTableProps {
    files: FileRecord[];
    encryptedPrivateKey: string;
    isMfaEnabled: boolean;
}

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

type StatusType = 'idle' | 'info' | 'success' | 'error';

export default function FileTable({ files, encryptedPrivateKey }: FileTableProps) {
    const [passphrase, setPassphrase] = useState('');
    const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: 'idle', message: '' });
    const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const handleDecrypt = async (file: FileRecord) => {
        if (passphrase.length < 12) {
            setStatus({ type: 'error', message: 'Please enter your master passphrase (min 12 characters).' });
            return;
        }

        setLoadingFileId(file.id);
        setStatus({ type: 'idle', message: '' });

        // We'll hold the private key PEM in a local variable and zero it after use
        let privateKeyPem: string | null = null;

        try {
            // ── Step 1: Decrypt private key from passphrase (browser only) ──────────
            setStatus({ type: 'info', message: 'Verifying passphrase...' });
            privateKeyPem = await decryptWithPassphrase(encryptedPrivateKey, passphrase);

            if (!privateKeyPem) {
                setStatus({ type: 'error', message: 'Invalid passphrase. Please try again.' });
                return;
            }

            // ── Step 2: Fetch encrypted AES key from server (no crypto on server) ───
            setStatus({ type: 'info', message: 'Retrieving encrypted key...' });
            const keyResult = await getEncryptedAesKey(file.id);

            if (!keyResult.success || !keyResult.encryptedAesKey) {
                setStatus({ type: 'error', message: keyResult.message || 'Failed to retrieve file key.' });
                return;
            }

            // ── Step 3: Decrypt AES key with RSA private key (browser only) ─────────
            setStatus({ type: 'info', message: 'Decrypting file key...' });
            let aesKeyHex: string;
            try {
                aesKeyHex = await decryptAesKeyWithRsa(keyResult.encryptedAesKey, privateKeyPem);
            } catch {
                setStatus({ type: 'error', message: 'Key decryption failed. Your keys may be from an older version — please re-run key setup.' });
                return;
            }

            // ── Step 4: Fetch encrypted file from Cloudinary ─────────────────────────
            setStatus({ type: 'info', message: 'Downloading encrypted file...' });
            const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${file.cloudinaryPublicId}`;
            const response = await fetch(fileUrl);

            if (!response.ok) {
                throw new Error(`Failed to download file: HTTP ${response.status}`);
            }

            const payload = await response.json();

            // Support both old (CBC) and new (GCM) payload formats
            const encryptedFileBase64: string = payload.file?.split(',')[1] ?? payload.file;
            const iv: string = payload.iv;

            if (!encryptedFileBase64 || !iv) {
                throw new Error('Malformed file payload from storage.');
            }

            // ── Step 5: Decrypt file in browser (AES-GCM) ───────────────────────────
            setStatus({ type: 'info', message: 'Decrypting file...' });
            let decryptedBuffer: ArrayBuffer;
            try {
                decryptedBuffer = await decryptFileWithAes(encryptedFileBase64, aesKeyHex, iv);
            } catch {
                setStatus({ type: 'error', message: 'File decryption failed. The file may have been encrypted with an older version. Please re-upload.' });
                return;
            }

            // ── Step 6: Trigger browser download ────────────────────────────────────
            const mimeTypes: Record<string, string> = {
                pdf: 'application/pdf',
                txt: 'text/plain',
                md: 'text/markdown',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                jpg: 'image/jpeg', jpeg: 'image/jpeg',
                png: 'image/png', webp: 'image/webp',
            };
            const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
            const mimeType = mimeTypes[ext] ?? 'application/octet-stream';

            const blob = new Blob([decryptedBuffer], { type: mimeType });
            saveAs(blob, file.fileName);

            setStatus({ type: 'success', message: `✅ '${file.fileName}' decrypted and downloaded successfully.` });
            setPassphrase(''); // Clear passphrase from state after success

        } catch (error: any) {
            console.error('[FileTable] Decryption error:', error);
            setStatus({ type: 'error', message: `Error: ${error.message}` });
        } finally {
            // ── Zero out key material from memory ────────────────────────────────────
            // JS doesn't have guaranteed memory wiping, but clearing references
            // allows GC to collect the sensitive strings sooner.
            privateKeyPem = null;
            setLoadingFileId(null);
        }
    };

    const isDecrypting = loadingFileId !== null;

    return (
        <div className="space-y-6">
            {/* Passphrase Input Card */}
            <div className="dark-glass-neon p-6">
                <div className="flex items-center gap-2 mb-1">
                    <LockOpenIcon className="w-5 h-5 text-green-400" />
                    <label htmlFor="passphrase-input" className="font-semibold text-white">
                        Master Passphrase
                    </label>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                    Your passphrase decrypts your private key locally — it never leaves your browser.
                </p>
                <input
                    id="passphrase-input"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    disabled={isDecrypting}
                    className="dark-glass-input"
                    placeholder="Enter your master passphrase (min 12 chars)"
                    autoComplete="current-password"
                />
            </div>

            {/* ZK Notice */}
            <div className="flex items-start gap-2 px-1">
                <ShieldCheckIcon className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                    Zero-Knowledge: All decryption happens in your browser. The server never sees your private key or file contents.
                </p>
            </div>

            {/* Status Message */}
            {status.message && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${status.type === 'success' ? 'bg-green-900/50 text-green-300' :
                        status.type === 'error' ? 'bg-red-900/50 text-red-300' :
                            'bg-blue-900/50 text-blue-300'
                    }`}>
                    {status.type === 'error' && <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />}
                    {status.message}
                </div>
            )}

            {/* File Table */}
            <div className="dark-glass-neon overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">File</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {files.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <DocumentIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">No files uploaded yet.</p>
                                    <p className="text-gray-500 text-sm mt-1">Upload your first encrypted file to get started.</p>
                                </td>
                            </tr>
                        )}
                        {files.map((file) => (
                            <tr key={file.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{getFileIcon(file.fileName)}</span>
                                        <span className="text-sm font-medium text-white truncate max-w-[200px]">{file.fileName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                                    {formatBytes(file.fileSize)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                                    {new Date(file.uploadDate).toLocaleDateString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleDecrypt(file)}
                                        disabled={isDecrypting || passphrase.length < 12}
                                        className="gradient-button-small flex items-center gap-1.5"
                                    >
                                        {loadingFileId === file.id ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                Decrypting...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                                Decrypt & Download
                                            </>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
