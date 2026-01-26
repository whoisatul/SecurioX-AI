'use client';

import { useState, useEffect } from 'react'; // Import useEffect
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // State for the success message
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // --- THIS IS THE NEW PART ---
  // Check for the success message from the URL
  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'SetupComplete') {
      setSuccess('✅ Setup complete! Please log in to continue.');
    }
  }, [searchParams]);
  // --- END OF NEW PART ---

  const gradientButton = "w-full bg-gradient-to-r from-green-400 to-teal-500 text-black p-3 rounded-lg font-semibold hover:from-green-500 hover:to-teal-600 transition duration-150 disabled:opacity-50";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(''); // Clear success message on submit
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
    <main className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="dark-glass-neon p-8 rounded-2xl w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-teal-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-xl">S</span>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center mb-2 text-white">
          Sign in to Securio
        </h2>
        <p className="text-center text-gray-400 mb-8">Welcome back to your secure vault.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* --- NEW SUCCESS MESSAGE --- */}
          {success && (
            <p className="text-green-300 bg-green-900/50 p-3 rounded-lg text-sm font-medium text-center">
              {success}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isMfaRequired}
              className="dark-glass-input"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">2FA Code</label>
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
                className="dark-glass-input text-center tracking-widest border-green-500"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="gradient-button"
          >
            {isLoading ? 'Processing...' : isMfaRequired ? 'Verify & Log In' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/signup"
            className="text-sm text-green-400 hover:text-green-300 transition duration-150"
          >
            Don't have an account? Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}