'use client'; 

import * as CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt'; 

// --- ASAP Key Generation (Used by Onboarding) ---
// "ASAP" = Asymmetric Security Assets Protocol

export interface AsapKeyPair { publicKey: string; privateKey: string; }

export function generateAsapKeyPair(): AsapKeyPair {
  const crypt = new JSEncrypt({ default_key_size: "2048" });
  const publicKey = crypt.getPublicKey();
  const privateKey = crypt.getPrivateKey();
  
  if (!publicKey || !privateKey) {
    throw new Error("Failed to generate ASAP key pair.");
  }
  return { publicKey, privateKey };
}

// --- Passphrase Encryption/Decryption ---

export function encryptWithPassphrase(data: string, passphrase: string): string {
    // Uses AES-256 with default settings (KDF and IV handling)
    return CryptoJS.AES.encrypt(data, passphrase).toString();
}

export function decryptWithPassphrase(cipherText: string, passphrase: string): string | null {
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, passphrase);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedData) { 
            return null; // Incorrect passphrase often results in unreadable output
        }
        return decryptedData;
    } catch (error) {
        console.error("Passphrase decryption failed:", error);
        return null;
    }
}

// --- AES ENCRYPTION/DECRYPTION (Used by Upload and Decrypt Pages) ---

/**
 * Generates a random AES-256 key (32 bytes / 64 hex chars).
 */
export function generateAesKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypts the file data using the symmetric AES key and a unique IV.
 */
export function encryptFileWithAes(fileBuffer: ArrayBuffer, aesKey: string): { fileCipher: string, iv: string } {
    const iv = CryptoJS.lib.WordArray.random(16); // 128 bits for AES IV
    const key = CryptoJS.enc.Hex.parse(aesKey);
    
    const fileWordArray = CryptoJS.lib.WordArray.create(fileBuffer as any);

    const encrypted = CryptoJS.AES.encrypt(fileWordArray, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    return {
        fileCipher: encrypted.ciphertext.toString(CryptoJS.enc.Base64), 
        iv: iv.toString(CryptoJS.enc.Hex)
    };
}

/**
 * Decrypts the file data using the symmetric AES key and IV.
 */
export function decryptFileWithAes(fileCipherBase64: string, aesKey: string, ivHex: string): ArrayBuffer {
    const key = CryptoJS.enc.Hex.parse(aesKey);
    const ivParsed = CryptoJS.enc.Hex.parse(ivHex);
    
    // Prepare the Ciphertext object for decryption
    const cipherWordArray = CryptoJS.enc.Base64.parse(fileCipherBase64);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: cipherWordArray });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: ivParsed,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    // Convert decrypted WordArray back to ArrayBuffer for File/Blob
    const bytes = decrypted.toString(CryptoJS.enc.Latin1);
    const byteNumbers = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        byteNumbers[i] = bytes.charCodeAt(i);
    }
    return new Uint8Array(byteNumbers).buffer;
}