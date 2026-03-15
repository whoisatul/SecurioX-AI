'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (response.ok) {
        // Let NextAuth handle the sign in but use manual redirect to bust Next.js App Router cache
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.error) {
           setError('Registration successful, but automatic login failed.');
        } else if (result?.ok) {
           window.location.href = '/onboard-keys';
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Registration failed');
      }
    } catch (error) {
      setError('An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-gradient-to-b from-green-500/[0.06] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
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
          <h2 className="text-2xl font-bold text-center mb-1 text-white tracking-tight">Create your account</h2>
          <p className="text-center text-gray-500 text-sm mb-8">Start securing your files today</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="dark-glass-input"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="dark-glass-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="dark-glass-input"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="dark-glass-input"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="gradient-button mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-green-400 hover:text-green-300 font-medium transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
