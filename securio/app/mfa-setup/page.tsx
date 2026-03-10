'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { startMfaSetup, completeMfaSetup } from '@/app/actions/mfa';
import { ShieldCheckIcon, DevicePhoneMobileIcon, KeyIcon } from '@heroicons/react/24/outline';

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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-500/20">
            <DevicePhoneMobileIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Two-Factor Auth</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
            Protect your vault with an extra layer of security using an authenticator app.
          </p>
        </div>

        <div className="dark-glass-neon p-8 rounded-3xl border-white/[0.04]">
          {!mfaState ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto mb-6">
                <ShieldCheckIcon className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Ready to secure your account?</h3>
              <p className="text-sm text-gray-400 mb-8">You will need an app like Google Authenticator, Authy, or 1Password to scan the QR code.</p>
              <button
                onClick={handleStartSetup}
                disabled={isLoading}
                className="gradient-button w-full text-base font-semibold py-3.5"
              >
                {isLoading ? 'Preparing Setup...' : 'Begin Setup'}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-400">1</span>
                  </div>
                  <p className="text-sm font-medium text-white">Scan this QR code</p>
                </div>

                <div className="flex justify-center p-6 rounded-2xl bg-white shadow-2xl mx-auto w-fit ring-4 ring-white/5">
                  <QRCode value={mfaState.uri} size={160} level="H" />
                </div>

                <div className="mt-5 text-center">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Or enter code manually</p>
                  <div className="flex items-center justify-center gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                    <KeyIcon className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-mono text-gray-300 break-all">{mfaState.secret}</p>
                  </div>
                </div>
              </div>

              <hr className="border-white/[0.04]" />

              {/* Step 2 */}
              <form onSubmit={handleVerifyCode} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-400">2</span>
                  </div>
                  <p className="text-sm font-medium text-white">Verify the code</p>
                </div>

                <div className="space-y-4">
                  <input
                    id="mfa-code"
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    required
                    maxLength={6}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-center text-2xl tracking-[0.4em] font-mono text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all placeholder:text-gray-600"
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                  {message && (
                    <p className={`text-center text-sm font-medium ${message.includes('Error') || message.includes('Invalid') ? 'text-red-400' : 'text-green-400'}`}>
                      {message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || mfaCode.length !== 6}
                    className="gradient-button w-full text-base font-semibold py-3.5 mt-2 disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Finish Setup'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}