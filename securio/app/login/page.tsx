'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'SetupComplete') {
      setSuccess(' Setup complete! Please log in to continue.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        mfaCode: isMfaRequired ? mfaCode : undefined,
      });

      setIsLoading(false);

      if (result?.error) {
        switch (result.error) {
          case "MfaRequired":
            setIsMfaRequired(true);
            setError('Two-Factor Authentication required. Enter code.');
            break;
          case "InvalidPassword":
            setError('Invalid password. Please try again.');
            setIsMfaRequired(false);
            setMfaCode('');
            break;
          case "InvalidMfaCode":
            setError('Invalid MFA code. Please try again.');
            setIsMfaRequired(true);
            setMfaCode('');
            break;
          case "UserNotFound":
            setError('No account found with this email.');
            setIsMfaRequired(false);
            setMfaCode('');
            break;
          default:
            setError("Login failed. Check credentials or MFA code.");
            if (isMfaRequired) {
              setIsMfaRequired(false);
              setMfaCode('');
            }
        }
      } else if (result?.ok) {
        router.push(callbackUrl);
      } else {
        setError('An unexpected issue occurred during login.');
      }
    } catch (error: any) {
      setIsLoading(false);
      setError('Login failed due to an unexpected client-side error.');
    }
  };

  return (
    <div className="relative w-full max-w-sm animate-fade-in-up">
      {/* Logo */}
     <Link href="/" className="flex items-center justify-center space-x-2 group mb-4">

  {/* SVG Logo */}
  <svg
    width="36"
    height="36"
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-all duration-300 group-hover:scale-105"
  >
    <defs>
      {/* Gradient */}
      <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="100%" stopColor="#15803D" />
      </linearGradient>

      {/* Glow Filter */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    {/* Shield */}
    <path
      d="M32 4 L56 12 V28 C56 42 46 54 32 60 C18 54 8 42 8 28 V12 Z"
      fill="url(#shieldGradient)"
      filter="url(#glow)"
      className="animate-pulse"
    />

    {/* Lock Body */}
    <rect x="22" y="30" width="20" height="16" rx="3" fill="white" />

    {/* Lock Top */}
    <path
      d="M26 30 V24 C26 20 29 18 32 18 C35 18 38 20 38 24 V30"
      stroke="white"
      strokeWidth="3"
      fill="none"
    />
  </svg>

  {/* Text */}
  <h1 className="text-2xl font-semibold tracking-tight text-white">
    Securio
    <span className="text-green-400 font-bold drop-shadow-[0_0_8px_#4ade80] group-hover:drop-shadow-[0_0_12px_#4ade80] transition">
      X
    </span>
  </h1>

</Link>

      {/* Card */}
      <div className="dark-glass-neon p-8 rounded-2xl">
        <h2 className="text-2xl font-bold text-center mb-1 text-white tracking-tight">
          Welcome back
        </h2>
        <p className="text-center text-gray-500 text-sm mb-8">Sign in to your secure vault</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm font-medium text-center">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isMfaRequired}
              className="dark-glass-input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading || isMfaRequired}
              className="dark-glass-input"
              placeholder="••••••••"
            />
          </div>

          {isMfaRequired && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">2FA Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                required
                maxLength={6}
                disabled={isLoading}
                autoFocus
                className="dark-glass-input text-center tracking-[0.3em] text-lg border-green-500/30"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="gradient-button"
          >
            {isLoading ? 'Processing...' : isMfaRequired ? 'Verify & Log In' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/signup"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-200"
          >
            Don&apos;t have an account? <span className="text-green-400 font-medium">Sign Up</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-to-b from-green-500/[0.06] to-transparent rounded-full blur-3xl" />
      </div>

      <Suspense fallback={
        <div className="w-full max-w-sm">
          <div className="dark-glass-neon p-8 rounded-2xl text-center">
            <div className="animate-spin w-8 h-8 border-[3px] border-green-500/30 border-t-green-500 rounded-full mx-auto" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  );
}