import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { LockClosedIcon, BoltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  // --- NEW MINIMAL BUTTONS ---
  
  // Solid, bright "Call to Action"
  const primaryButtonClasses = "bg-white text-gray-900 px-6 py-2 rounded-lg hover:bg-gray-200 transition-all duration-200 font-semibold transform hover:scale-105";
  
  // Subtle "secondary" button
  const secondaryButtonClasses = "border-2 border-white/20 text-white px-8 py-3 rounded-xl text-md font-semibold hover:bg-white/10 transition-all duration-200";

  return (
    <div className="min-h-screen">
      {/* Navigation: Uses STATIC glass */}
      <nav className="glass-effect sticky top-4 max-w-7xl mx-auto z-50 rounded-xl px-6 py-4 my-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-bold text-lg">S</span>
            </div>
            <span className="text-2xl font-bold text-white">Securio</span>
          </Link>
          <div className="flex items-center space-x-4">
            {session?.user ? (
              <Link href="/dashboard" className={primaryButtonClasses}>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Sign In
                </Link>
                <Link 
                  href="/signup" 
                  className={primaryButtonClasses}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          {/* --- SMALLER TEXT --- */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Secure Your Files with
            <br />
            {/* --- CLEAN WHITE TEXT --- */}
            <span className="text-green-200">
              Hybrid Cryptography
            </span>
          </h1>
          {/* --- SMALLER TEXT --- */}
          <p className="text-lg text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Experience the future of cloud storage. 
            Your files are protected by client-side hybrid cryptography 
            for maximum security and performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/signup" 
              className="bg-white text-gray-900 px-8 py-3 rounded-xl text-md font-semibold hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 shadow-2xl"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/login" 
              className={secondaryButtonClasses}
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features Grid: Uses LIQUID glass */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="liquid-glass p-8">
              {/* --- SUBTLE ICON --- */}
              <div className="w-12 h-12 glass-effect rounded-lg text-gray-300 flex items-center justify-center mb-6">
                <LockClosedIcon className="w-6 h-6" />
              </div>
              {/* --- SMALLER TEXT --- */}
              <h3 className="text-xl font-bold text-white mb-4">Military-Grade Encryption</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                Your files are protected with AES-256 encryption combined with RSA-2048 asymmetric keys.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="liquid-glass p-8">
              {/* --- SUBTLE ICON --- */}
              <div className="w-12 h-12 glass-effect rounded-lg text-gray-300 flex items-center justify-center mb-6">
                <BoltIcon className="w-6 h-6" />
              </div>
              {/* --- SMALLER TEXT --- */}
              <h3 className="text-xl font-bold text-white mb-4">Lightning Fast</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                Hybrid cryptography provides the perfect balance of security and performance.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="liquid-glass p-8">
              {/* --- SUBTLE ICON --- */}
              <div className="w-12 h-12 glass-effect rounded-lg text-gray-300 flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              {/* --- SMALLER TEXT --- */}
              <h3 className="text-xl font-bold text-white mb-4">Zero-Knowledge Architecture</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                We never have access to your keys or file contents. Your data is encrypted client-side.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works: Uses LIQUID glass */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            {/* --- SMALLER TEXT --- */}
            <h2 className="text-3xl font-bold text-white mb-6">How Securio Works</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Our system ensures your files are protected at every step
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="liquid-glass p-6 text-center">
              <div className="w-16 h-16 border-2 border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-4">Upload & Encrypt</h3>
              <p className="text-gray-400 text-sm">
                Files are encrypted client-side with AES-256
              </p>
            </div>

            <div className="liquid-glass p-6 text-center">
              <div className="w-16 h-16 border-2 border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-4">Key Protection</h3>
              <p className="text-gray-400 text-sm">
                AES keys are encrypted with your RSA public key
              </p>
            </div>
            
            <div className="liquid-glass p-6 text-center">
              <div className="w-16 h-16 border-2 border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className ="text-lg font-bold text-white mb-4">Secure Storage</h3>
              <p className="text-gray-400 text-sm">
                Encrypted files stored in secure cloud infrastructure
              </p>
            </div>
            
            <div className="liquid-glass p-6 text-center">
              <div className="w-16 h-16 border-2 border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">4</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-4">Decrypt & Download</h3>
              <p className="text-gray-400 text-sm">
                Files decrypted client-side with your private key
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section: Uses LIQUID glass */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="liquid-glass rounded-3xl p-12 text-center">
            {/* --- SMALLER TEXT --- */}
            <h2 className="text-3xl font-bold text-white mb-6">Ready to Secure Your Files?</h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of users who trust Securio with their most sensitive data. 
              Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/signup" 
                className="bg-white text-gray-900 px-8 py-3 rounded-xl text-md font-semibold hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 shadow-2xl"
              >
                Get Started Free
              </Link>
              <Link 
                href="/login" 
                className="text-white hover:text-gray-200 transition-colors duration-200"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/20 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-lg">S</span>
              </div>
              <span className="text-2xl font-bold text-white">Securio</span>
            </div>
            <p className="text-gray-400 text-center md:text-right">
              © 2025 Securio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}