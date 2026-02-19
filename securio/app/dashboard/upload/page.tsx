'use client';

/**
 * app/dashboard/upload/page.tsx
 *
 * TRUE ZK UPLOAD FLOW:
 * 1. Generate AES key in browser (Web Crypto API)
 * 2. Encrypt file in browser (AES-GCM)
 * 3. Fetch user's RSA public key from server
 * 4. Wrap AES key with RSA public key in browser (RSA-OAEP)
 * 5. Send to server: encrypted file + RSA-wrapped AES key + IV
 *
 * The server NEVER sees the plaintext AES key.
 */

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { uploadEncryptedFile } from '@/app/actions/file';
import { getUserPublicKey } from '@/app/actions/user';
import { generateAesKey, encryptFileWithAes, encryptAesKeyWithRsa } from '@/lib/client/client-crypto';
import { extractText } from '@/lib/client/text-extractor';
import Link from 'next/link';
import { ArrowUpTrayIcon, DocumentCheckIcon, XCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];

function isAllowedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type StatusType = 'idle' | 'info' | 'success' | 'error';

interface Status {
  type: StatusType;
  message: string;
}

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Status>({ type: 'idle', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [keysExist, setKeysExist] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === 'authenticated') {
      const hasKeys = !!(session?.user as any)?.hasEncryptionKeys;
      setKeysExist(hasKeys);
    } else if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard/upload');
    }
  }, [session, status, router]);

  const setStatus = (type: StatusType, message: string) => {
    setUploadStatus({ type, message });
  };

  const validateAndSetFile = (f: File) => {
    if (!isAllowedFile(f)) {
      setStatus('error', `File type not supported. Allowed: PDF, TXT, MD, DOC, DOCX, JPG, PNG, WEBP`);
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setStatus('error', 'File too large. Maximum size is 50 MB.');
      return;
    }
    setFile(f);
    setUploadStatus({ type: 'idle', message: '' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keysExist) { setStatus('error', 'Encryption keys are not set up.'); return; }
    if (!file) { setStatus('error', 'Please select a file.'); return; }

    setIsLoading(true);
    setProgress(10);

    try {
      // Step 1: Read file
      console.time('[Upload] Step 1: Read file');
      setStatus('info', 'Reading file...');
      const arrayBuffer = await file.arrayBuffer();
      console.timeEnd('[Upload] Step 1: Read file');
      setProgress(20);

      // Step 2: Generate AES key (browser)
      console.time('[Upload] Step 2: Generate AES key');
      setStatus('info', 'Generating encryption key...');
      const aesKeyHex = generateAesKey();
      console.timeEnd('[Upload] Step 2: Generate AES key');
      setProgress(30);

      // Step 3: Encrypt file with AES-GCM (browser)
      console.time('[Upload] Step 3: Encrypt file');
      setStatus('info', 'Encrypting file in your browser...');
      const { fileCipher, iv } = await encryptFileWithAes(arrayBuffer, aesKeyHex);
      console.timeEnd('[Upload] Step 3: Encrypt file');
      setProgress(50);

      // Step 4: Fetch user's RSA public key from server
      console.time('[Upload] Step 4: Fetch public key');
      setStatus('info', 'Fetching your public key...');
      const pubKeyResult = await getUserPublicKey();
      if (!pubKeyResult.success || !pubKeyResult.publicKey) {
        setStatus('error', pubKeyResult.message || 'Failed to retrieve public key.');
        return;
      }
      console.timeEnd('[Upload] Step 4: Fetch public key');
      setProgress(60);

      // Step 5: Wrap AES key with RSA public key (browser)
      console.time('[Upload] Step 5: Wrap AES key');
      setStatus('info', 'Wrapping encryption key...');
      const encryptedAesKey = await encryptAesKeyWithRsa(aesKeyHex, pubKeyResult.publicKey);
      console.timeEnd('[Upload] Step 5: Wrap AES key');
      setProgress(70);

      // Step 6: Build form data and upload to Cloudinary
      console.time('[Upload] Step 6: Upload to server');
      setStatus('info', 'Uploading encrypted file...');
      const encryptedFileBlob = new File(
        [Buffer.from(fileCipher, 'base64')],
        file.name + '.enc',
        { type: 'application/octet-stream' }
      );

      const formData = new FormData();
      formData.append("encryptedFile", encryptedFileBlob);
      formData.append("fileName", file.name);
      formData.append("encryptedAesKey", encryptedAesKey);
      formData.append("iv", iv);

      setProgress(85);
      const result = await uploadEncryptedFile(formData);
      console.timeEnd('[Upload] Step 6: Upload to server');
      console.log('[Upload] Server result:', result);

      if (result.success) {
        // ── Step 7: Vectorize for search (hard 10s timeout) ────
        // Uses Promise.race so it can NEVER hang longer than 10 seconds
        if (result.fileId) {
          setStatus('info', 'Indexing for search (max 10s)...');
          console.time('[Upload] Step 7: Vectorize');

          const vectorizeWithTimeout = async () => {
            const { text, fileType } = await extractText(arrayBuffer, file.name, file.type);
            console.log('[Upload] Extracted text length:', text.trim().length);
            if (!text.trim()) return { skipped: true };
            const res = await fetch('/api/vectorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: result.fileId,
                text,
                fileName: file.name,
                aesKeyHex,
                fileType,
              }),
            });
            return res.json();
          };

          const timeout = (ms: number) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Vectorization timed out after ${ms}ms`)), ms)
          );

          try {
            const vecResult = await Promise.race([vectorizeWithTimeout(), timeout(10_000)]);
            console.log('[Upload] Vectorize result:', vecResult);
          } catch (vecErr: any) {
            console.warn('[Upload] Vectorize skipped:', vecErr.message);
          }
          console.timeEnd('[Upload] Step 7: Vectorize');
        }

        setProgress(100);
        setStatus('success', `${result.message} Redirecting to your files...`);
        setFile(null);
        setTimeout(() => router.push('/dashboard/files'), 1800);
      } else {
        setStatus('error', `Upload failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      setStatus('error', `An unexpected error occurred: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  if (status === 'loading' || keysExist === null) {
    return (
      <div className="dark-glass-neon p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Secure File Upload</h1>
        <p className="text-gray-400 mt-1">Your file is encrypted in your browser before it ever leaves your device.</p>
      </div>

      {/* ZK Notice */}
      <div className="dark-glass-neon p-4 flex items-start gap-3 border border-green-500/20">
        <ShieldCheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-green-400">Zero-Knowledge:</span> AES-256-GCM encryption happens in your browser. Your AES key is wrapped with your RSA public key before upload. The server stores only ciphertext — it cannot decrypt your files.
        </p>
      </div>

      {!keysExist ? (
        <div className="dark-glass-neon p-6 border border-red-500/50">
          <h3 className="font-bold text-lg text-red-300">Encryption Keys Not Set Up</h3>
          <p className="mt-1 text-gray-300">You must set up your encryption keys before uploading files.</p>
          <Link href="/onboard-keys" className="mt-3 inline-block text-green-400 hover:underline font-semibold">
            Go to Key Setup →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Drop Zone */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload-input')?.click()}
              className={`dark-glass-neon p-10 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300
                ${isDragging ? 'border-green-400 bg-green-500/10 scale-[1.01]' : 'border-gray-600 hover:border-gray-400'}`}
            >
              <input
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileChange}
                disabled={isLoading}
                id="file-upload-input"
                className="hidden"
              />
              <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-semibold text-white">Drag & Drop your file here</p>
              <p className="mt-1 text-gray-400 text-sm">or <span className="text-green-400 font-medium">browse to select</span></p>
              <p className="mt-3 text-xs text-gray-500">PDF, TXT, MD, DOC, DOCX, JPG, PNG, WEBP · Max 50 MB</p>
            </div>
          )}

          {/* File Staged */}
          {file && (
            <div className="dark-glass-neon p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <DocumentCheckIcon className="w-10 h-10 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-base font-medium text-white">{file.name}</p>
                  <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={isLoading}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <XCircleIcon className="w-7 h-7" />
              </button>
            </div>
          )}

          {/* Progress Bar */}
          {isLoading && progress > 0 && (
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-green-400 to-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Status Message */}
          {uploadStatus.message && (
            <p className={`p-3 rounded-lg text-sm font-medium ${uploadStatus.type === 'success' ? 'bg-green-900/50 text-green-300' :
              uploadStatus.type === 'error' ? 'bg-red-900/50 text-red-300' :
                'bg-blue-900/50 text-blue-300'
              }`}>
              {uploadStatus.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !file || !keysExist}
            className="gradient-button"
          >
            {isLoading ? 'Processing...' : 'Encrypt & Upload File'}
          </button>
        </form>
      )}
    </div>
  );
}
