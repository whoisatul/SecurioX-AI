'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  const isMfaEnabled = (session?.user as any)?.isMfaEnabled;
  const hasEncryptionKeys = (session?.user as any)?.hasEncryptionKeys;

  if (!hasEncryptionKeys) {
    redirect('/onboard-keys');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and security.</p>
      </div>

      {/* Security Settings */}
      <div className="dark-glass-neon p-5">
        <p className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">Security</p>

        <div className="space-y-3">
          {/* Encryption Keys Card */}
          <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
            <div>
              <h3 className="text-sm font-medium text-white">Encryption Keys</h3>
              <p className="text-xs text-gray-500 mt-0.5">RSA-2048 key pair for file encryption</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-green-500/[0.08] text-green-400 border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Active
            </span>
          </div>

          {/* MFA Card */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-sm font-medium text-white">Two-Factor Authentication</h3>
              <p className="text-xs text-gray-500 mt-0.5">Extra security layer for your account</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${isMfaEnabled
                ? 'bg-green-500/[0.08] text-green-400 border-green-500/20'
                : 'bg-orange-500/[0.08] text-orange-400 border-orange-500/20'
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isMfaEnabled ? 'bg-green-400' : 'bg-orange-400'}`} />
              {isMfaEnabled ? 'Enabled' : 'Not Set Up'}
            </span>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="dark-glass-neon p-5">
        <p className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">Account</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={session?.user?.name || ''}
              disabled
              className="dark-glass-input opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="dark-glass-input opacity-60 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Hybrid Cryptography Info */}
      <div className="dark-glass-neon p-5">
        <p className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">Cryptography</p>
        <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
          <p><span className="text-white font-medium">AES-256:</span> Each file is encrypted with a unique AES key for fast encryption/decryption.</p>
          <p><span className="text-white font-medium">RSA-2048:</span> Your AES keys are encrypted with your RSA public key for secure key exchange.</p>
          <p><span className="text-white font-medium">Client-Side:</span> All encryption happens in your browser before files reach our servers.</p>
          <p><span className="text-white font-medium">Zero-Knowledge:</span> We never have access to your private keys or file contents.</p>
        </div>
      </div>
    </div>
  );
}