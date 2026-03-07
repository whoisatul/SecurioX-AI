'use client';

/**
 * app/onboard-keys/page.tsx
 *
 * Key Setup Flow (ZK-compliant):
 * 1. User enters a strong passphrase (min 12 chars)
 * 2. Browser generates RSA-OAEP 2048-bit key pair (Web Crypto API)
 * 3. Browser encrypts private key with passphrase (PBKDF2 + AES-GCM)
 * 4. Browser sends: public key (PEM SPKI) + encrypted private key envelope to server
 * 5. Server stores both — it never sees the passphrase or plaintext private key
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { generateAsapKeyPair, encryptWithPassphrase } from '@/lib/client/client-crypto';
import { completeKeySetup } from '@/app/actions/user';
import { LockClosedIcon, ShieldCheckIcon, CheckIcon, KeyIcon } from '@heroicons/react/24/outline';

type Step = 1 | 2 | 3;

const STEPS = [
  { label: 'Set Passphrase' },
  { label: 'Generating Keys' },
  { label: 'Complete' },
];

export default function KeySetupPage() {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      const hasKeys = (session?.user as any)?.hasEncryptionKeys;
      if (hasKeys) router.push('/dashboard');
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [session, status, router]);

  const passphraseStrength = (): { label: string; color: string; width: string } => {
    const len = passphrase.length;
    const hasUpper = /[A-Z]/.test(passphrase);
    const hasLower = /[a-z]/.test(passphrase);
    const hasNum = /[0-9]/.test(passphrase);
    const hasSpecial = /[^A-Za-z0-9]/.test(passphrase);
    const score = [len >= 12, len >= 16, hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;

    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
    if (score <= 4) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-1/2' };
    if (score <= 5) return { label: 'Strong', color: 'bg-green-500', width: 'w-3/4' };
    return { label: 'Very Strong', color: 'bg-green-400', width: 'w-full' };
  };

  const addLog = (msg: string) => setGenerationLog((prev) => [...prev, msg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    if (passphrase.length < 12) {
      setError('Passphrase must be at least 12 characters.');
      return;
    }

    setIsLoading(true);
    setStep(2);
    setGenerationLog([]);

    try {
      addLog('⏳ Generating RSA-OAEP 2048-bit key pair...');
      const { publicKey, privateKey } = await generateAsapKeyPair();
      addLog('✅ Key pair generated.');

      addLog('⏳ Encrypting private key with PBKDF2 + AES-GCM...');
      const encryptedPrivateKey = await encryptWithPassphrase(privateKey, passphrase);
      addLog('✅ Private key encrypted.');

      addLog('⏳ Storing keys on server...');
      const result = await completeKeySetup(publicKey, encryptedPrivateKey);

      if (result.success) {
        addLog('✅ Keys stored securely.');
        setStep(3);
        setTimeout(() => {
          window.location.href = '/mfa-setup';
        }, 2500);
      } else {
        setError(result.message || 'Failed to store keys.');
        setStep(1);
      }
    } catch (err: any) {
      console.error('[KeySetup] Error:', err);
      setError(`Key generation failed: ${err.message}`);
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && (session?.user as any)?.hasEncryptionKeys)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-[3px] border-green-500/30 border-t-green-500 rounded-full" />
      </div>
    );
  }

  const strength = passphrase ? passphraseStrength() : null;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-to-b from-green-500/[0.06] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-500/20">
            <LockClosedIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Setup Encryption Keys</h2>
          <p className="text-gray-500 text-sm">Your keys are generated and encrypted entirely in your browser.</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const stepNum = (i + 1) as Step;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-green-500/15 border border-green-500/40 text-green-400' : 'bg-white/[0.04] border border-white/[0.08] text-gray-500'}`}>
                  {isDone ? <CheckIcon className="w-4 h-4" /> : stepNum}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-10 h-px transition-all duration-300 ${step > stepNum ? 'bg-green-500' : 'bg-white/[0.08]'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Passphrase Form */}
        {step === 1 && (
          <div className="dark-glass-neon p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="passphrase" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Master Passphrase
                </label>
                <input
                  id="passphrase"
                  type="password"
                  required
                  minLength={12}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="dark-glass-input"
                  placeholder="Enter a strong passphrase (min 12 chars)"
                  autoComplete="new-password"
                />
                {strength && (
                  <div className="mt-2.5">
                    <div className="w-full bg-white/[0.04] rounded-full h-1">
                      <div className={`h-1 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                    </div>
                    <p className={`text-xs mt-1.5 ${strength.color.replace('bg-', 'text-')}`}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassphrase" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Confirm Passphrase
                </label>
                <input
                  id="confirmPassphrase"
                  type="password"
                  required
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="dark-glass-input"
                  placeholder="Confirm your passphrase"
                  autoComplete="new-password"
                />
                {confirmPassphrase && passphrase !== confirmPassphrase && (
                  <p className="text-xs text-red-400 mt-1.5">Passphrases do not match.</p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="gradient-button">
                Generate Encryption Keys
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Key Generation in Progress */}
        {step === 2 && (
          <div className="dark-glass-neon p-8 text-center">
            <div className="animate-spin w-10 h-10 border-[3px] border-green-500/30 border-t-green-500 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-semibold text-white mb-4">Generating Your Keys</h3>
            <div className="space-y-2 text-sm text-left mt-4">
              {generationLog.map((log, i) => (
                <p key={i} className={log.startsWith('✅') ? 'text-green-400' : 'text-gray-400'}>{log}</p>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="dark-glass-neon p-8 text-center">
            <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckIcon className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Keys Generated!</h3>
            <p className="text-gray-400 text-sm mb-1">Your RSA-2048 key pair has been created.</p>
            <p className="text-gray-500 text-xs mb-5">Private key encrypted with PBKDF2 + AES-GCM.</p>
            <div className="space-y-2 text-sm text-left mb-5">
              {generationLog.map((log, i) => (
                <p key={i} className="text-green-400">{log}</p>
              ))}
            </div>
            <p className="text-gray-500 text-sm animate-pulse">Redirecting to MFA setup...</p>
          </div>
        )}

        {/* Security Warning */}
        <div className="dark-glass-neon border-yellow-500/20 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-400 text-sm mb-1">Save Your Passphrase</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                If you forget your passphrase, <span className="underline font-medium text-gray-300">you will permanently lose access to all your files</span>. We cannot recover or reset it.
              </p>
            </div>
          </div>
        </div>

        {/* Crypto Details */}
        <div className="dark-glass-neon p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyIcon className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cryptographic Details</p>
          </div>
          <div className="space-y-1 text-[11px] text-gray-600">
            <p>• Key pair: RSA-OAEP 2048-bit (Web Crypto API)</p>
            <p>• Key derivation: PBKDF2 SHA-256 · 100,000 iterations</p>
            <p>• Private key encryption: AES-GCM 256-bit</p>
            <p>• All operations run in your browser</p>
          </div>
        </div>
      </div>
    </div>
  );
}