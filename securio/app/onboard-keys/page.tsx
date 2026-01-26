'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { generateAsapKeyPair, encryptWithPassphrase } from '@/lib/client-crypto';
import { completeKeySetup } from '@/app/actions/user';
import { LockClosedIcon, ShieldCheckIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function KeySetupPage() {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const router = useRouter(); // Keep router for the initial redirect check
  const { data: session, status } = useSession(); // Removed 'update' as it's no longer needed here

  useEffect(() => {
    if (status === 'authenticated') {
      const hasKeys = (session?.user as any)?.hasEncryptionKeys;
      if (hasKeys) {
        router.push('/dashboard');
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [session, status, router]);

  if (status === 'loading' || (status === 'authenticated' && (session?.user as any)?.hasEncryptionKeys)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }
    if (passphrase.length < 12) {
      setError('Passphrase must be at least 12 characters long');
      return;
    }
    setIsLoading(true);
    setStep(2);

    try {
      const { publicKey, privateKey } = generateAsapKeyPair();
      const encryptedPrivateKey = encryptWithPassphrase(privateKey, passphrase);
      const result = await completeKeySetup(publicKey, encryptedPrivateKey);

      if (result.success) {
        setStep(3);
        
        // --- THIS IS THE FIX ---
        // We DON'T call await update().
        // Instead, we show the success message for 2 seconds,
        // then force a hard redirect to the *correct* next page.
        // The hard refresh will fetch the new session on the next page.
        setTimeout(() => {
          window.location.href = '/mfa-setup';
        }, 2000); // 2-second delay to show success

      } else {
        setError(result.message || 'Failed to setup encryption keys on the server.');
        setStep(1);
      }
    } catch (error: any) {
      console.error("Key setup process failed:", error);
      setError(`An unexpected error occurred: ${error.message}`);
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  // --- handleContinue function removed ---

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <LockClosedIcon className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Setup Your Encryption Keys</h2>
          <p className="text-gray-300">This is the most important step to secure your files.</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>1</div>
          <div className={`w-16 h-1 ${step >= 2 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>2</div>
          <div className={`w-16 h-1 ${step >= 3 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>3</div>
        </div>

        {/* Step 1: Passphrase Form */}
        {step === 1 && (
          <div className="dark-glass-neon p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-center">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="passphrase" className="block text-sm font-medium text-gray-300 mb-2">
                  Master Passphrase
                </label>
                <input
                  id="passphrase"
                  name="passphrase"
                  type="password"
                  required
                  minLength={12}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="dark-glass-input"
                  placeholder="Enter a strong passphrase (min 12)"
                />
              </div>
              <div>
                <label htmlFor="confirmPassphrase" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Passphrase
                </label>
                <input
                  id="confirmPassphrase"
                  name="confirmPassphrase"
                  type="password"
                  required
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="dark-glass-input"
                  placeholder="Confirm your passphrase"
                />
              </div>
              <button type="submit" disabled={isLoading} className="gradient-button">
                {isLoading ? 'Processing...' : 'Generate Encryption Keys'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Key Generation Loading State */}
        {step === 2 && (
          <div className="dark-glass-neon p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-white mb-4">Generating Your Keys</h3>
            <p className="text-gray-300 mb-6">Creating your key pair and encrypting your private key...</p>
            <div className="space-y-2 text-sm text-gray-400 text-left">
              <p>✓ Generating ASAP key pair...</p>
              <p>✓ Encrypting private key with passphrase...</p>
              <p>⏳ Storing keys securely...</p>
            </div>
          </div>
        )}

        {/* Step 3: Success State */}
        {step === 3 && (
          <div className="dark-glass-neon p-8 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Keys Generated Successfully!</h3>
            <p className="text-gray-300 mb-8">
              Your encryption keys have been created and stored securely.
            </p>
            {/* --- Updated this part --- */}
            <p className="text-gray-400 animate-pulse">
              Redirecting you to MFA setup...
            </p>
            {/* --- Button removed --- */}
          </div>
        )}
        
        {/* Security Notice Box */}
        <div className="dark-glass-neon border border-yellow-500/50 p-6 mt-8">
          <div className="flex items-start space-x-3">
            <div className="shrink-0">
              <ShieldCheckIcon className="w-8 h-8 text-yellow-400 mt-0.5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-300">Important: Save Your Passphrase!</h3>
              <p className="text-base text-gray-300 mt-2 font-semibold">
                If you forget this, <span className='underline'>you will lose access to all your files</span>.
                <br />
                <span className="font-bold">We cannot recover or reset it.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}