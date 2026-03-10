import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { ShieldCheckIcon, KeyIcon, ClockIcon } from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

// --- Storage Donut Chart ---
const StorageDonutChart = ({ current, max }: { current: number, max: number }) => {
  const percentage = Math.min((current / max) * 100, 100);
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

// --- Helper for Time Ago ---
function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
}

// --- Main Dashboard Page Component ---
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p className="p-8 text-red-500">Authentication error.</p>;

  const isMfaEnabled = (session?.user as any)?.isMfaEnabled;
  const hasEncryptionKeys = (session?.user as any)?.hasEncryptionKeys;
  let fileCount = 0;
  let recentFiles: { fileName: string, uploadDate: Date }[] = [];

  if (hasEncryptionKeys) {
    try {
      fileCount = await prisma.encryptedFile.count({
        where: { userId: session.user.id },
      });
      recentFiles = await prisma.encryptedFile.findMany({
        where: { userId: session.user.id },
        orderBy: { uploadDate: 'desc' },
        take: 3,
        select: { fileName: true, uploadDate: true }
      });
    } catch (error) { console.error("Failed to fetch file data:", error); }
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
          title="Multi-Factor Auth"
          status={isMfaEnabled ? "Enabled" : "Disabled"}
          color={isMfaEnabled ? "green" : "orange"}
          message={isMfaEnabled ? "Account secured with MFA." : "Recommended: Enable MFA."}
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
        {/* Storage Usage (File Count) */}
        <div className="dark-glass-neon p-5 lg:col-span-1 border-white/[0.04]">
          <p className="text-sm font-medium text-gray-400 tracking-wide mb-4 uppercase">Storage Limit</p>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 flex-shrink-0 relative">
              <StorageDonutChart current={fileCount} max={100} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">
                {fileCount} <span className="text-gray-500 text-lg font-medium">/ 100</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">files uploaded</p>
              <Link href="/dashboard/files" className="text-xs text-green-400 hover:text-green-300 font-medium mt-3 transition-colors">
                Your files →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dark-glass-neon p-5 lg:col-span-2 border-white/[0.04]">
          <p className="text-sm font-medium text-gray-400 tracking-wide mb-4 uppercase">Recent Activity</p>
          <div className="space-y-3">
            {recentFiles.length > 0 ? (
              recentFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-4 py-2 hover:bg-white/[0.02] rounded-lg transition-colors group px-2 -mx-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                    <ClockIcon className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">Uploaded &quot;{file.fileName}&quot;</p>
                  </div>
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide bg-white/[0.04] px-2 py-1 rounded-md">{timeAgo(file.uploadDate)}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">No recent activity.</p>
                <Link href="/dashboard/upload" className="text-xs text-green-400 hover:text-green-300 mt-2 inline-block">Upload a file →</Link>
              </div>
            )}
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