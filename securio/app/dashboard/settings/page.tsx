'use server'; // This page now needs to be a server component to get session

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

// This is the file you showed in the screenshot
export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  // Custom properties from JWT/Session callback
  const isMfaEnabled = (session?.user as any)?.isMfaEnabled;
  const hasEncryptionKeys = (session?.user as any)?.hasEncryptionKeys;

  // If user doesn't have encryption keys, redirect to setup
  if (!hasEncryptionKeys) {
    redirect('/onboard-keys');
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-white">Settings</h1>
      <p className="text-lg text-gray-400">Manage your account and security settings.</p>

      {/* Security Settings */}
      <div className="dark-glass-neon p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Security Settings</h2>
        
        <div className="space-y-6">
          {/* Encryption Keys Card */}
          <div className="dark-glass-neon p-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Encryption Keys</h3>
              {/* --- TEXT REPLACED --- */}
              <p className="text-gray-400">Your ASAP-2048 key pair for file encryption</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium border bg-green-500/10 text-green-300 border-green-400/30">
                Active
              </span>
            </div>
          </div>

          {/* MFA Card */}
          <div className="dark-glass-neon p-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Two-Factor Authentication</h3>
              <p className="text-gray-400">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                isMfaEnabled 
                  ? 'bg-green-500/10 text-green-300 border-green-400/30' 
                  : 'bg-orange-500/10 text-orange-300 border-orange-400/30'
              }`}>
                {isMfaEnabled ? 'Enabled' : 'Not Set Up'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="dark-glass-neon p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Account Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input 
              type="text" 
              value={session?.user?.name || ''} 
              disabled
              className="dark-glass-input bg-black/20 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input 
              type="email" 
              value={session?.user?.email || ''} 
              disabled
              className="dark-glass-input bg-black/20 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Hybrid Cryptography Info */}
      <div className="dark-glass-neon border-green-400/30 p-6">
        <h2 className="text-2xl font-bold text-green-300 mb-4">🔐 Hybrid Cryptography</h2>
        <div className="space-y-3 text-gray-300">
          <p><strong>Symmetric Encryption (AES-256):</strong> Each file is encrypted with a unique AES key for fast encryption/decryption.</p>
          {/* --- TEXT REPLACED --- */}
          <p><strong>Asymmetric Encryption (ASAP-2048):</strong> Your AES keys are encrypted with your ASAP public key for secure key exchange.</p>
          <p><strong>Client-Side Encryption:</strong> All encryption happens in your browser before files reach our servers.</p>
          <p><strong>Zero-Knowledge:</strong> We never have access to your private keys or file contents.</p>
        </div>
      </div>
    </div>
  );
}