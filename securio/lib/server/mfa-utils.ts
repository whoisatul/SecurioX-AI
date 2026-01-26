// lib/mfa-utils.ts

import { authenticator } from 'otplib';

// NOTE: You should set a unique TOTP issuer name for your application
const ISSUER = 'Securio';

/**
 * Generates a new, cryptographically secure TOTP secret.
 * @returns {string} The new base32 secret key.
 */
export function generateMfaSecret(): string {
  // Uses a 32-character secret by default (256-bit entropy)
  return authenticator.generateSecret();
}

/**
 * Generates the URL for the user to scan with their authenticator app (e.g., Google Authenticator).
 * @param {string} email - The user's email address.
 * @param {string} secret - The user's TOTP secret key.
 * @returns {string} The otpauth:// URI string.
 */
export function generateMfaUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

/**
 * Verifies the user-provided code against the stored secret.
 * @param {string} secret - The user's TOTP secret key.
 * @param {string} code - The 6-digit code provided by the user.
 * @returns {boolean} True if the code is valid within the time window, false otherwise.
 */
export function verifyMfaCode(secret: string, code: string): boolean {
  return authenticator.check(code, secret);
}