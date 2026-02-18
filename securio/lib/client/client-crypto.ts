/**
 * lib/client/client-crypto.ts
 *
 * TRUE ZERO-KNOWLEDGE CLIENT-SIDE CRYPTOGRAPHY
 * All operations use the Web Crypto API (window.crypto.subtle).
 * Nothing in this file ever touches the network.
 *
 * Stack:
 *  - Key wrapping:    RSA-OAEP 2048-bit (SHA-256)
 *  - File encryption: AES-GCM 256-bit
 *  - Passphrase KDF:  PBKDF2 (SHA-256, 100,000 iterations)
 *  - Key generation:  RSA-OAEP 2048-bit
 */

'use client';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const RSA_KEY_SIZE = 2048;
const AES_KEY_BITS = 256;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';
const SALT_BYTES = 32;
const IV_BYTES = 12; // AES-GCM standard

// ---------------------------------------------------------------------------
// HELPERS: ArrayBuffer <-> Base64 / Hex
// ---------------------------------------------------------------------------

export function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, 2), 16);
    }
    return bytes.buffer;
}

// Correct hex parsing (handles full string, not just 2 chars)
function hexStringToBuffer(hex: string): ArrayBuffer {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes.buffer;
}

// ---------------------------------------------------------------------------
// PEM UTILITIES
// ---------------------------------------------------------------------------

function pemToBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN [^-]+-----/, '')
        .replace(/-----END [^-]+-----/, '')
        .replace(/\s/g, '');
    return base64ToBuffer(base64);
}

function bufferToPem(buffer: ArrayBuffer, type: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
    const base64 = bufferToBase64(buffer);
    const lines = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
    return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

// ---------------------------------------------------------------------------
// 1. RSA KEY PAIR GENERATION
// ---------------------------------------------------------------------------

export interface AsapKeyPair {
    publicKey: string;  // PEM SPKI
    privateKey: string; // PEM PKCS#8
}

/**
 * Generates a 2048-bit RSA-OAEP key pair using the Web Crypto API.
 * Returns PEM-encoded public (SPKI) and private (PKCS#8) keys.
 */
export async function generateAsapKeyPair(): Promise<AsapKeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: RSA_KEY_SIZE,
            publicExponent: new Uint8Array([1, 0, 1]), // 65537
            hash: 'SHA-256',
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );

    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
        publicKey: bufferToPem(publicKeyBuffer, 'PUBLIC KEY'),
        privateKey: bufferToPem(privateKeyBuffer, 'PRIVATE KEY'),
    };
}

// ---------------------------------------------------------------------------
// 2. PASSPHRASE-BASED PRIVATE KEY ENCRYPTION (PBKDF2 + AES-GCM)
// ---------------------------------------------------------------------------

interface EncryptedKeyEnvelope {
    ciphertext: string; // Base64
    salt: string;       // Base64
    iv: string;         // Base64
    iterations: number;
}

/**
 * Encrypts a PEM private key using a passphrase.
 * KDF: PBKDF2 (SHA-256, 100k iterations)
 * Cipher: AES-GCM 256-bit
 * Returns a JSON string (safe to store in DB).
 */
export async function encryptWithPassphrase(privateKeyPem: string, passphrase: string): Promise<string> {
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));

    // Derive a 256-bit key from the passphrase
    const passphraseKey = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: PBKDF2_HASH,
        },
        passphraseKey,
        { name: 'AES-GCM', length: AES_KEY_BITS },
        false,
        ['encrypt']
    );

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(privateKeyPem)
    );

    const envelope: EncryptedKeyEnvelope = {
        ciphertext: bufferToBase64(ciphertext),
        salt: bufferToBase64(salt.buffer),
        iv: bufferToBase64(iv.buffer),
        iterations: PBKDF2_ITERATIONS,
    };

    return JSON.stringify(envelope);
}

/**
 * Decrypts an encrypted private key envelope using a passphrase.
 * Returns the PEM private key string, or throws on wrong passphrase.
 */
export async function decryptWithPassphrase(encryptedJson: string, passphrase: string): Promise<string | null> {
    try {
        const envelope: EncryptedKeyEnvelope = JSON.parse(encryptedJson);

        const salt = base64ToBuffer(envelope.salt);
        const iv = base64ToBuffer(envelope.iv);
        const ciphertext = base64ToBuffer(envelope.ciphertext);

        const passphraseKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const aesKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: envelope.iterations ?? PBKDF2_ITERATIONS,
                hash: PBKDF2_HASH,
            },
            passphraseKey,
            { name: 'AES-GCM', length: AES_KEY_BITS },
            false,
            ['decrypt']
        );

        const plaintext = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            ciphertext
        );

        return new TextDecoder().decode(plaintext);
    } catch {
        // Wrong passphrase or corrupted data — AES-GCM auth tag will fail
        return null;
    }
}

// ---------------------------------------------------------------------------
// 3. RSA-OAEP KEY WRAPPING (AES key encryption/decryption)
// ---------------------------------------------------------------------------

/**
 * Encrypts a hex AES key using an RSA-OAEP public key (PEM SPKI format).
 * Returns Base64-encoded ciphertext.
 */
export async function encryptAesKeyWithRsa(aesKeyHex: string, publicKeyPem: string): Promise<string> {
    const publicKeyBuffer = pemToBuffer(publicKeyPem);

    const publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );

    const aesKeyBytes = hexStringToBuffer(aesKeyHex);

    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        aesKeyBytes
    );

    return bufferToBase64(encrypted);
}

/**
 * Decrypts a Base64-encoded RSA-OAEP encrypted AES key using a PEM PKCS#8 private key.
 * Returns the AES key as a hex string.
 */
export async function decryptAesKeyWithRsa(encryptedKeyBase64: string, privateKeyPem: string): Promise<string> {
    const privateKeyBuffer = pemToBuffer(privateKeyPem);

    const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt']
    );

    const encryptedBytes = base64ToBuffer(encryptedKeyBase64);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedBytes
    );

    return bufferToHex(decrypted);
}

// ---------------------------------------------------------------------------
// 4. AES-GCM FILE ENCRYPTION / DECRYPTION
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random 256-bit AES key.
 * Returns as a hex string.
 */
export function generateAesKey(): string {
    const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
    return bufferToHex(keyBytes.buffer);
}

/**
 * Encrypts a file ArrayBuffer using AES-GCM 256-bit.
 * Returns Base64 ciphertext and hex IV.
 */
export async function encryptFileWithAes(
    fileBuffer: ArrayBuffer,
    aesKeyHex: string
): Promise<{ fileCipher: string; iv: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const keyBytes = hexStringToBuffer(aesKeyHex);

    const aesKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        fileBuffer
    );

    return {
        fileCipher: bufferToBase64(ciphertext),
        iv: bufferToHex(iv.buffer),
    };
}

/**
 * Decrypts a Base64 AES-GCM ciphertext using the hex AES key and hex IV.
 * Returns the plaintext as an ArrayBuffer.
 * Throws if the auth tag is invalid (wrong key or tampered data).
 */
export async function decryptFileWithAes(
    fileCipherBase64: string,
    aesKeyHex: string,
    ivHex: string
): Promise<ArrayBuffer> {
    const keyBytes = hexStringToBuffer(aesKeyHex);
    const iv = hexStringToBuffer(ivHex);
    const ciphertext = base64ToBuffer(fileCipherBase64);

    const aesKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    return window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
    );
}

// ---------------------------------------------------------------------------
// LEGACY COMPAT SHIMS (for onboard-keys page — will be updated separately)
// ---------------------------------------------------------------------------

/** @deprecated Use generateAsapKeyPair() — now async */
export function generateAsapKeyPairSync(): never {
    throw new Error('generateAsapKeyPairSync is removed. Use the async generateAsapKeyPair() instead.');
}