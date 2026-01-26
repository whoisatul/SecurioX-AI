'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react'; // Import signOut
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { startMfaSetup, completeMfaSetup } from '@/app/actions/mfa';

interface MfaState {
  uri: string;
  secret: string;
}

export default function MfaSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // This check is fine
  if (session?.user && (session.user as any).isMfaEnabled) {
    router.push('/dashboard');
    return null;
  }

  const handleStartSetup = async () => {
    setIsLoading(true);
    setMessage('');
    const result = await startMfaSetup();
    if (result.success && result.uri && result.secret) {
      setMfaState({ uri: result.uri, secret: result.secret });
      setMessage("Scan the QR code with your authenticator app.");
    } else {
      setMessage(`Error: ${result.message}`);
    }
    setIsLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    if (!mfaCode) {
        setMessage('Please enter the 6-digit code.');
        setIsLoading(false);
        return;
    }

    const result = await completeMfaSetup(mfaCode);

    if (result.success) {
      // --- THIS IS THE FIX ---
      setMessage("Setup complete! Redirecting to login...");
      
      // We MUST sign the user out to destroy the old, stale session cookie.
      // We send them to the login page with a success message.
      await signOut({ redirect: false }); // Destroys the cookie
      
      // Redirect to login page with a message
      router.push('/login?message=SetupComplete'); 
      // --- END OF FIX ---
      
    } else {
      setMessage(result.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="dark-glass-neon p-8 rounded-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-4 text-center text-white">🔑 Enable Two-Factor</h2>
        <p className="mb-6 text-sm text-center text-gray-300">
          Add an extra layer of security with Google Authenticator or Authy.
        </p>

        {!mfaState ? (
          <button
            onClick={handleStartSetup}
            disabled={isLoading}
            className="gradient-button"
          >
            {isLoading ? 'Starting Setup...' : 'Begin MFA Setup'}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center p-4 rounded-lg bg-white">
                <QRCode value={mfaState.uri} size={180} level="H" /> 
            </div>
            <p className="text-center text-sm font-medium text-gray-400 break-words">
                Manual Key: <span className="text-white font-mono">{mfaState.secret}</span>
            </p>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-300 mb-1">Enter 6-digit Code</label>
                <input
                  id="mfa-code"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  required
                  maxLength={6}
                  className="dark-glass-input text-center text-xl tracking-widest"
                  placeholder="123456"
                />
              </div>
              {message && (
                <p className={`text-center text-sm font-medium ${message.includes('Error') || message.includes('Invalid') ? 'text-red-400' : 'text-green-400'}`}>
                  {message}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="gradient-button"
              >
                {isLoading ? 'Verifying...' : 'Verify & Finish Setup'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}