import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { ShieldCheckIcon, KeyIcon, ClockIcon } from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

// --- Storage Donut Chart ---
const StorageDonutChart = ({ percentage = 15 }: { percentage: number }) => {
  const sqSize = 100;
  const strokeWidth = 8;
  const radius = (sqSize - strokeWidth) / 2;
  const viewBox = `0 0 ${sqSize} ${sqSize}`;
  const dashArray = radius * Math.PI * 2;
  const dashOffset = dashArray - (dashArray * percentage) / 100;

  return (
    <svg width="100%" height="100%" viewBox={viewBox} className="transform -rotate-90">
      <circle
        className="text-white/[0.04]"
        cx={sqSize / 2}
        cy={sqSize / 2}
        r={radius}
        strokeWidth={`${strokeWidth}px`}
        fill="none"
        stroke="currentColor"
      />
      <circle
        className="text-green-500"
        cx={sqSize / 2}
        cy={sqSize / 2}
        r={radius}
        strokeWidth={`${strokeWidth}px`}
        fill="none"
        stroke="currentColor"
        style={{
          strokeDasharray: dashArray,
          strokeDashoffset: dashOffset,
          strokeLinecap: 'round',
          transition: 'stroke-dashoffset 0.5s ease-out'
        }}
      />
      <text
        x="50%"
        y="50%"
        dy=".3em"
        textAnchor="middle"
        className="text-lg font-semibold text-white fill-current transform rotate-90"
        style={{ transformOrigin: '50% 50%' }}
      >
        {`${percentage}%`}
      </text>
    </svg>
  );
};

// --- StatusCard Component ---
const StatusCard = ({ title, status, color, message }: { title: string, status: string, color: string, message: string }) => {
  const colorMap: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    green: { bg: 'bg-green-500/[0.08]', text: 'text-green-400', border: 'border-green-500/20', dot: 'bg-green-400' },
    red: { bg: 'bg-red-500/[0.08]', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
    orange: { bg: 'bg-orange-500/[0.08]', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' },
    blue: { bg: 'bg-blue-500/[0.08]', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
    gray: { bg: 'bg-white/[0.04]', text: 'text-gray-400', border: 'border-white/10', dot: 'bg-gray-400' },
  };

  const c = colorMap[color] || colorMap['gray'];

  return (
    <div className="dark-glass-neon p-5">
      <p className="text-sm text-gray-500 mb-3">{title}</p>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border} mb-3`}>
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status}
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  );
};

// --- Main Dashboard Page Component ---
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p className="p-8 text-red-500">Authentication error.</p>;

  const isMfaEnabled = (session?.user as any)?.isMfaEnabled;
  const hasEncryptionKeys = (session?.user as any)?.hasEncryptionKeys;
  let fileCount = 0;
  if (hasEncryptionKeys) {
    try {
      fileCount = await prisma.encryptedFile.count({
        where: { userId: session.user.id },
      });
    } catch (error) { console.error("Failed to fetch file count:", error); }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Welcome back, {session?.user?.name || session?.user?.email}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your security overview.</p>
      </div>

      {/* Key Setup Warning */}
      {!hasEncryptionKeys && (
        <div className="dark-glass-neon p-5 border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-white text-sm">Action Required</h3>
              <p className="mt-1 text-gray-400 text-sm">Encryption keys are not set up. You cannot upload or download files.</p>
              <Link href="/onboard-keys" className="mt-2 inline-block text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
                Setup Encryption Keys →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Encryption Keys"
          status={hasEncryptionKeys ? "Active" : "Not Set Up"}
          color={hasEncryptionKeys ? "green" : "red"}
          message={hasEncryptionKeys ? "Master keys generated and secured." : "Setup required for file features."}
        />
        <StatusCard
          title="Two-Factor Auth"
          status={isMfaEnabled ? "Enabled" : "Disabled"}
          color={isMfaEnabled ? "green" : "orange"}
          message={isMfaEnabled ? "Account secured with MFA." : "Recommended: Enable 2FA."}
        />
        <StatusCard
          title="Files Stored"
          status={hasEncryptionKeys ? `${fileCount} File${fileCount !== 1 ? 's' : ''}` : 'N/A'}
          color="blue"
          message={hasEncryptionKeys ? "Manage your encrypted documents." : "Setup keys to store files."}
        />
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Storage Usage */}
        <div className="dark-glass-neon p-5 lg:col-span-1">
          <p className="text-sm text-gray-500 mb-4">Storage Usage</p>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 flex-shrink-0">
              <StorageDonutChart percentage={15} />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">1.5 GB</p>
              <p className="text-xs text-gray-500">of 10 GB used</p>
              <button className="mt-2 text-xs text-green-400 hover:text-green-300 transition-colors">
                Upgrade Plan →
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dark-glass-neon p-5 lg:col-span-2">
          <p className="text-sm text-gray-500 mb-4">Recent Activity</p>
          <div className="space-y-3">
            {[
              { text: 'Uploaded "viva_presentation.pdf"', time: '5m ago' },
              { text: 'Logged in from a new device', time: '1h ago' },
              { text: '2FA was successfully enabled', time: '1d ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <ClockIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <p className="text-sm text-gray-400 flex-1">{item.text}</p>
                <span className="text-[11px] text-gray-600">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Overview */}
      <div>
        <p className="text-sm text-gray-500 mb-4">Security Architecture</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="dark-glass-neon p-5 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheckIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Client-Side Encryption</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Files are encrypted in your browser with AES-256 before upload. We never see your unencrypted data.</p>
            </div>
          </div>
          <div className="dark-glass-neon p-5 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <KeyIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Zero-Knowledge</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Your AES keys are encrypted with your personal RSA key. Your private key is encrypted with your passphrase.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}