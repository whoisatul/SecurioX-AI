'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
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
        <div className="animate-spin w-10 h-10 border-[3px] border-green-500/30 border-t-green-500 rounded-full" />
      </div>
    );
  }

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
      setMessage("Setup complete! Redirecting to login...");
      await signOut({ redirect: false });
      router.push('/login?message=SetupComplete');
    } else {
      setMessage(result.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-to-b from-green-500/[0.06] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 animate-fade-in-up">
        <div className="dark-glass-neon p-8 rounded-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
              <span className="text-white text-xl">🔑</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Enable Two-Factor</h2>
            <p className="text-gray-500 text-sm mt-1">
              Add an extra layer of security with Google Authenticator or Authy.
            </p>
          </div>

          {!mfaState ? (
            <button
              onClick={handleStartSetup}
              disabled={isLoading}
              className="gradient-button"
            >
              {isLoading ? 'Starting Setup...' : 'Begin MFA Setup'}
            </button>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-center p-5 rounded-xl bg-white">
                <QRCode value={mfaState.uri} size={180} level="H" />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Manual Key</p>
                <p className="text-sm font-mono text-white bg-white/[0.04] px-3 py-2 rounded-lg break-all">{mfaState.secret}</p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label htmlFor="mfa-code" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Enter 6-digit Code</label>
                  <input
                    id="mfa-code"
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    required
                    maxLength={6}
                    className="dark-glass-input text-center text-lg tracking-[0.3em]"
                    placeholder="000000"
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
    </div>
  );
}