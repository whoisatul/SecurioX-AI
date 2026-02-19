/**
 * lib/client/vector-client.ts
 *
 * Client-side utilities for working with server-encrypted vectors.
 *
 * The server encrypts vectors using AES-256-GCM with Node.js crypto.
 * Format: iv(12 bytes) + authTag(16 bytes) + ciphertext
 * The client decrypts them using the Web Crypto API after unwrapping the AES key.
 */

'use client';

import { decryptAesKeyWithRsa, base64ToBuffer } from '@/lib/client/client-crypto';
import { deserializeVector, cosineSimilarity, rankDocuments, scoreToPercent } from '@/lib/shared/vector-utils';

// ---------------------------------------------------------------------------
// Server-encrypted vector decryption (client-side)
// ---------------------------------------------------------------------------

/**
 * Decrypts a server-encrypted vector blob using the file's AES key.
 * Server format: iv(12) + authTag(16) + ciphertext (AES-256-GCM)
 */
export async function decryptServerVector(
    encryptedBase64: string,
    aesKeyHex: string
): Promise<number[]> {
    const combined = new Uint8Array(base64ToBuffer(encryptedBase64));

    const iv = combined.slice(0, 12);
    const authTag = combined.slice(12, 28);
    const ciphertext = combined.slice(28);

    // Combine ciphertext + authTag for Web Crypto (it expects them concatenated)
    const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
    ciphertextWithTag.set(ciphertext, 0);
    ciphertextWithTag.set(authTag, ciphertext.length);

    const keyBytes = hexToBuffer(aesKeyHex);

    const aesKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertextWithTag
    );

    // Plaintext is a UTF-8 Base64 string of the serialized Float32Array
    const vectorBase64 = new TextDecoder().decode(plaintext);
    return deserializeVector(vectorBase64);
}

function hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Full search pipeline (client-side ranking)
// ---------------------------------------------------------------------------

export interface VaultFile {
    id: string;
    fileName: string;
    fileSize: number;
    uploadDate: Date;
    cloudinaryPublicId: string;
    encryptedAesKey: string;
    encryptedVector: string | null;
    fileType: string | null;
}

export interface SearchResult extends VaultFile {
    score: number;
    scorePercent: number;
}

/**
 * Full client-side search pipeline:
 * 1. Embed query via /api/search/embed (Gemini on server)
 * 2. Decrypt each file's AES key using RSA private key
 * 3. Decrypt each vector using AES key
 * 4. Rank by cosine similarity
 * 5. Return top-K results
 */
export async function searchVault(
    query: string,
    files: VaultFile[],
    privateKeyPem: string,
    topK = 10
): Promise<SearchResult[]> {
    // Step 1: Get query embedding from server (Gemini)
    const embedRes = await fetch('/api/search/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });

    if (!embedRes.ok) {
        const err = await embedRes.json();
        throw new Error(err.error || 'Failed to embed query');
    }

    const { vector: queryVector } = await embedRes.json() as { vector: number[] };

    // Step 2 & 3: Decrypt vectors for indexed files
    const indexedFiles = files.filter(f => f.encryptedVector);
    const candidates: Array<{ id: string; vector: number[] }> = [];

    for (const file of indexedFiles) {
        try {
            console.log('[searchVault] Decrypting vector for:', file.fileName);
            const aesKeyHex = await decryptAesKeyWithRsa(file.encryptedAesKey, privateKeyPem);
            console.log('[searchVault] AES key decrypted, length:', aesKeyHex.length);
            const vector = await decryptServerVector(file.encryptedVector!, aesKeyHex);
            console.log('[searchVault] Vector decrypted, dims:', vector.length);
            candidates.push({ id: file.id, vector });
        } catch (err: any) {
            console.error('[searchVault] Failed to decrypt vector for:', file.fileName, err.message);
        }
    }

    // Step 4: Rank by cosine similarity
    const ranked = rankDocuments(queryVector, candidates);

    // Step 5: Map back to full file metadata
    return ranked
        .slice(0, topK)
        .filter(r => r.score > -0.1)
        .map(r => {
            const file = files.find(f => f.id === r.id)!;
            return {
                ...file,
                score: r.score,
                scorePercent: scoreToPercent(r.score),
            };
        });
}

export { cosineSimilarity, rankDocuments, scoreToPercent };
