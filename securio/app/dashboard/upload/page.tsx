'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { uploadEncryptedFile } from '@/app/actions/file';
import { generateAesKey, encryptFileWithAes } from '@/lib/client/client-crypto';
import Link from 'next/link';
import { ArrowUpTrayIcon, DocumentCheckIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keysExist, setKeysExist] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      const hasKeys = !!(session?.user as any)?.hasEncryptionKeys;
      setKeysExist(hasKeys);
      if (!hasKeys) {
        setStatusMessage("Encryption keys are not set up. Please set them up first.");
      }
    } else if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard/upload');
    }
  }, [session, status, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files[0].type === 'application/pdf') {
        setFile(e.target.files[0]);
        setStatusMessage('');
      } else {
        setStatusMessage('❌ Only PDF files are allowed.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files[0].type === 'application/pdf') {
        setFile(e.dataTransfer.files[0]);
        setStatusMessage('');
      } else {
        setStatusMessage('❌ Only PDF files are allowed.');
      }
      e.dataTransfer.clearData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keysExist) { setStatusMessage("❌ Cannot upload: Encryption keys are missing."); return; }
    if (!file) { setStatusMessage("❌ Please select a file."); return; }

    setIsLoading(true);
    setStatusMessage("Encrypting file in browser...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const aesKey = generateAesKey();
      const { fileCipher, iv } = encryptFileWithAes(arrayBuffer, aesKey);
      const binaryFile = new File([Buffer.from(fileCipher, 'base64')], file.name + '.enc', { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append("encryptedFile", binaryFile);
      formData.append("fileName", file.name);
      formData.append("plaintextAesKey", aesKey);
      formData.append("iv", iv);
      setStatusMessage("Uploading and securing key...");
      const result = await uploadEncryptedFile(formData);
      if (result.success) {
        setStatusMessage(`✅ ${result.message} Redirecting...`);
        setFile(null);
        setTimeout(() => router.push('/dashboard/files'), 1500);
      } else {
        setStatusMessage(`❌ Upload Failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error("File upload process failed:", error);
      setStatusMessage(`An unexpected error occurred: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || keysExist === null) {
    return (
      <div className="dark-glass-neon text-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6 text-white">Secure File Upload</h1>

      {!keysExist ? (
        <div className="dark-glass-neon p-6 border border-red-500/50">
          <h3 className="font-bold text-lg text-red-300">Keys Not Set Up</h3>
          <p className="mt-1 text-gray-300">You must set up your encryption keys before you can upload.</p>
          <Link href="/onboard-keys" className="mt-3 inline-block text-green-400 hover:underline font-semibold">
            Go to Key Setup &rarr;
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* --- NEW "NEON" UPLOAD ZONE --- */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`dark-glass-neon p-8 border-2 border-dashed border-gray-600 rounded-2xl text-center cursor-pointer
                          transition-all duration-300
                          ${isDragging ? 'border-green-400 bg-green-500/10' : 'hover:border-gray-400'}`}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                required
                disabled={isLoading}
                id="file-upload-input"
                className="hidden" // The div is our new button
              />
              <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-400" />
              <p className="mt-4 text-lg font-semibold text-white">
                Drag & Drop your PDF here
              </p>
              <p className="mt-1 text-gray-400">
                or <span className="text-green-400 font-medium">browse to select file</span>
              </p>
            </div>
          )}

          {/* --- NEW "FILE STAGED" CARD --- */}
          {file && (
            <div className="dark-glass-neon p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <DocumentCheckIcon className="w-10 h-10 text-green-400" />
                <div>
                  <p className="text-lg font-medium text-white">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={isLoading}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <XCircleIcon className="w-8 h-8" />
              </button>
            </div>
          )}

          {statusMessage && (
            <p className={`p-3 rounded-lg font-medium text-center ${
              statusMessage.startsWith('✅') ? 'bg-green-900/50 text-green-300' :
              statusMessage.startsWith('❌') ? 'bg-red-900/50 text-red-300' :
              'bg-blue-900/50 text-blue-300'
            }`}>
              {statusMessage}
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
