'use server'; // Directive to ensure server-only execution

import crypto from 'crypto'; // Node.js built-in crypto module

// --- ASAP ENCRYPTION/DECRYPTION ---

/**
 * Encrypts the plaintext AES key (hex string) using the ASAP Public Key (PEM format).
 * "ASAP" = Asymmetric Security Assets Protocol
 * @param publicKeyPem - The PEM-formatted public key string from the database.
 * @param plaintextAesKeyHex - The symmetric AES key as a hexadecimal string.
 * @returns {Promise<string>} - A Promise resolving to the Base64 encoded encrypted AES key.
 * @throws {Error} If encryption fails.
 */
export async function encryptAesKeyWithAsap(publicKeyPem: string, plaintextAesKeyHex: string): Promise<string> {
    try {
        // Convert the hex AES key string to a Buffer for Node.js crypto functions
        const bufferToEncrypt = Buffer.from(plaintextAesKeyHex, 'hex');

        // Use Node.js crypto.publicEncrypt for Asymmetric encryption
        const encryptedBuffer = crypto.publicEncrypt(
            {
                key: publicKeyPem, // The public key in PEM format
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, // Standard secure padding scheme
                oaepHash: "sha256", // Standard hash algorithm for OAEP padding
            },
            bufferToEncrypt // The data to encrypt (AES key)
        );

        // Return the encrypted data encoded as a Base64 string for easy storage/transfer
        return encryptedBuffer.toString('base64');
    } catch (error: any) {
        // Log the error securely on the server
        console.error("🔴 ASAP Encryption failed:", error);
        // Extract a safe error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Throw a new error to be caught by the calling Server Action
        throw new Error(`Failed to encrypt AES key with ASAP public key: ${errorMessage}`);
    }
}

/**
 * Decrypts the ASAP-encrypted AES key (Base64 string) using the Private Key (PEM format).
 * @param privateKeyPem - The PEM-formatted private key string (decrypted from passphrase on client, sent temporarily to server).
 * @param encryptedAesKeyBase64 - The Base64 encoded encrypted AES key retrieved from storage.
 * @returns {Promise<string>} - A Promise resolving to the decrypted plaintext AES key as a hexadecimal string.
 * @throws {Error} If decryption fails.
 */
export async function decryptAesKeyWithAsap(privateKeyPem: string, encryptedAesKeyBase64: string): Promise<string> {
    try {
        // Convert the Base64 encoded encrypted key back into a Buffer
        const bufferToDecrypt = Buffer.from(encryptedAesKeyBase64, 'base64');

        // Use Node.js crypto.privateDecrypt for Asymmetric decryption
        const decryptedBuffer = crypto.privateDecrypt(
            {
                key: privateKeyPem, // The private key in PEM format
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, // Must match padding used for encryption
                oaepHash: "sha256", // Must match hash used for encryption
            },
            bufferToDecrypt // The encrypted data (AES key)
        );

        // Return the decrypted AES key as a hex string (to match client-side generation format)
        return decryptedBuffer.toString('hex');
    } catch (error: any) {
        // Log the error securely on the server
        console.error("🔴 ASAP Decryption failed:", error);
        // Extract a safe error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Throw a new error to be caught by the calling Server Action
        throw new Error(`Failed to decrypt AES key. Check private key or data integrity: ${errorMessage}`);
    }
}