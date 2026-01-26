'use client';

import React, { useState } from 'react';
import { decryptWithPassphrase, decryptFileWithAes } from '@/lib/client/client-crypto';
import { performKeyDecryption } from '@/app/actions/decrypt';
import { saveAs } from 'file-saver';

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

export default function FileTable({ files, encryptedPrivateKey }: FileTableProps) {
    const [passphrase, setPassphrase] = useState('');
    const [message, setMessage] = useState('');
    const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const handleDecrypt = async (file: FileRecord) => {
        setLoadingFileId(file.id);
        setMessage('');

        if (passphrase.length < 12) {
            setMessage("❌ Please enter your master passphrase (min 12 characters).");
            setLoadingFileId(null);
            return;
        }

        try {
            // Step 1: Client-Side Decrypt Private Key
            const decryptedAsapPrivateKeyJson = decryptWithPassphrase(
                encryptedPrivateKey, 
                passphrase
            );
            
            if (!decryptedAsapPrivateKeyJson) {
                setMessage("❌ Invalid Passphrase. Decryption failed.");
                setLoadingFileId(null);
                return;
            }
            setMessage("⏳ Passphrase valid. Retrieving AES key...");

            // Step 2: Server-Side Decrypt AES Key
            const keyResult = await performKeyDecryption(
                file.id, 
                decryptedAsapPrivateKeyJson
            );

            if (!keyResult.success || !keyResult.plaintextAesKey) {
                setMessage(`❌ Key Decryption Failed: ${keyResult.message}`);
                setLoadingFileId(null);
                return;
            }

            const plaintextAesKey = keyResult.plaintextAesKey;
            setMessage("⏳ AES Key retrieved. Downloading encrypted file...");

            // Step 3: Client-Side Download Encrypted File
            const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${file.cloudinaryPublicId}`;
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
                throw new Error(`Cloudinary download failed: ${response.status}`);
            }
            
            const payload = await response.json();
            const encryptedFileBase64 = payload.file.split(',')[1];
            const iv = payload.iv;
            
            // Step 4: Client-Side Decrypt File
            setMessage("⏳ Decrypting file data...");
            const decryptedArrayBuffer = decryptFileWithAes(
                encryptedFileBase64, 
                plaintextAesKey, 
                iv
            );

            // Step 5: Trigger Browser Download
            const decryptedBlob = new Blob([decryptedArrayBuffer], { type: 'application/pdf' }); 
            saveAs(decryptedBlob, file.fileName);
            
            setMessage(`✅ File '${file.fileName}' downloaded and decrypted.`);
            setPassphrase(''); // Clear passphrase on success

        } catch (error: any) {
            console.error("Decryption pipeline error:", error);
            setMessage(`❌ A critical error occurred: ${error.message}`);
        } finally {
            setLoadingFileId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="dark-glass-neon p-6">
                <label htmlFor="passphrase-input" className="block font-semibold mb-2 text-gray-300">
                  Master Passphrase
                </label>
                <p className="text-sm text-gray-400 mb-3">
                  Enter your passphrase to decrypt and download files.
                </p>
                <input
                    id="passphrase-input"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                    className="dark-glass-input"
                    placeholder="Enter your Passphrase (min 12)"
                />
            </div>
            
            {message && (
                <p className={`p-3 rounded-lg font-medium ${
                  message.startsWith('✅') ? 'bg-green-900/50 text-green-300' : 
                  message.startsWith('❌') ? 'bg-red-900/50 text-red-300' : 
                  'bg-blue-900/50 text-blue-300'
                }`}>
                    {message}
                </p>
            )}

            <div className="dark-glass-neon overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">File Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size (KB)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Uploaded</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {files.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                    You haven't uploaded any files yet.
                                </td>
                            </tr>
                        )}
                        {files.map((file) => (
                            <tr key={file.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{file.fileName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(file.fileSize / 1024).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(file.uploadDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => handleDecrypt(file)}
                                        disabled={loadingFileId === file.id || loadingFileId !== null || passphrase.length < 12}
                                        className="gradient-button-small" // Use the new gradient button
                                    >
                                        {loadingFileId === file.id ? 'Decrypting...' : 'Decrypt & Download'}
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
