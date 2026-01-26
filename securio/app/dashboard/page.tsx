import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { ShieldCheckIcon, KeyIcon, ClockIcon } from "@heroicons/react/24/outline";

const prisma = new PrismaClient();

// --- Storage Donut Chart (NEW WIDGET) ---
const StorageDonutChart = ({ percentage = 15 }: { percentage: number }) => {
  const sqSize = 100;
  const strokeWidth = 10;
  const radius = (sqSize - strokeWidth) / 2;
  const viewBox = `0 0 ${sqSize} ${sqSize}`;
  const dashArray = radius * Math.PI * 2;
  const dashOffset = dashArray - (dashArray * percentage) / 100;

  return (
    <svg width="100%" height="100%" viewBox={viewBox} className="transform -rotate-90">
      <circle
        className="text-gray-700"
        cx={sqSize / 2}
        cy={sqSize / 2}
        r={radius}
        strokeWidth={`${strokeWidth}px`}
        fill="none"
        stroke="currentColor"
      />
      <circle
        className="text-green-400"
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
        className="text-xl font-bold text-white fill-current transform rotate-90"
        style={{ transformOrigin: '50% 50%' }}
      >
        {`${percentage}%`}
      </text>
    </svg>
  );
};

// --- StatusCard Component (Reskinned Badges) ---
const StatusCard = ({ title, status, color, message }: { title: string, status: string, color: string, message: string }) => {
    // Define neon colors based on the status color prop
    const neonColorClasses: Record<string, { bg: string, text: string, border: string }> = {
        green: { bg: 'bg-green-500/10', text: 'text-green-300', border: 'border-green-400/30' },
        red: { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-400/30' },
        orange: { bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-400/30' },
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-400/30' },
        gray: { bg: 'bg-gray-500/10', text: 'text-gray-300', border: 'border-gray-400/30' }, // Fallback
    };
    
    // Get the specific classes for this card's color
    const currentColors = neonColorClasses[color] || neonColorClasses['gray'];

    return (
        <div className="dark-glass-neon p-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
            {/* --- UPDATED BADGE STYLING --- */}
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${currentColors.bg} ${currentColors.text} ${currentColors.border} mb-3`}>
                {status}
            </div>
            <p className="text-sm text-gray-400">{message}</p>
        </div>
     );
};
// --- End StatusCard ---

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
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-white">Welcome back, {session?.user?.name || session?.user?.email}!</h1>
            <p className="text-lg text-gray-400">Here is your security dashboard.</p>

            {!hasEncryptionKeys && (
                <div className="dark-glass-neon p-5 border border-red-500/50">
                    <h3 className="font-bold text-lg text-red-300">⚠️ Action Required!</h3>
                    <p className="mt-1 text-gray-300">Encryption keys are not set up. You cannot upload or download files.</p>
                    <Link href="/onboard-keys" className="mt-3 inline-block text-green-400 hover:underline font-semibold">
                        Setup Encryption Keys Now &rarr;
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard
                    title="Encryption Key Status"
                    status={hasEncryptionKeys ? "Active" : "Not Set Up"}
                    color={hasEncryptionKeys ? "green" : "red"}
                    message={hasEncryptionKeys ? "Your master keys are generated and secured." : "Setup required to use file features."}
                />
                <StatusCard
                    title="2FA Status"
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

            {/* --- NEW WIDGETS TO FILL SPACE --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                {/* --- WIDGET 1: Storage Usage --- */}
                <div className="dark-glass-neon p-6 lg:col-span-1">
                  <h3 className="text-xl font-semibold text-white mb-4">Storage Usage</h3>
                  <div className="flex items-center space-x-6">
                    <div className="w-24 h-24">
                      <StorageDonutChart percentage={15} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">1.5 GB / 10 GB</p>
                      <p className="text-gray-400">15% Used</p>
                      <button className="mt-3 text-sm text-green-400 hover:text-green-300">
                        Upgrade Plan &rarr;
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- WIDGET 2: Recent Activity --- */}
                <div className="dark-glass-neon p-6 lg:col-span-2">
                  <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="w-5 h-5 text-gray-400" />
                      <p className="text-gray-300">You successfully uploaded <span className="font-medium text-white">"viva_presentation.pdf"</span>.</p>
                      <span className="text-xs text-gray-500 ml-auto">5m ago</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="w-5 h-5 text-gray-400" />
                      <p className="text-gray-300">You successfully logged in from a new device.</p>
                      <span className="text-xs text-gray-500 ml-auto">1h ago</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="w-5 h-5 text-gray-400" />
                      <p className="text-gray-300">2FA was successfully enabled.</p>
                      <span className="text-xs text-gray-500 ml-auto">1d ago</span>
                    </div>
                  </div>
                </div>
            </div>
            
            {/* --- WIDGET 3: Security Overview --- */}
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-white mb-4">Your Security Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="dark-glass-neon p-6 flex items-start space-x-4">
                  <ShieldCheckIcon className="w-10 h-10 text-green-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Client-Side Encryption</h3>
                    <p className="text-gray-400">Your files are encrypted in your browser with AES-256 *before* they are uploaded. We never see your unencrypted data.</p>
                  </div>
                </div>
                <div className="dark-glass-neon p-6 flex items-start space-x-4">
                  <KeyIcon className="w-10 h-10 text-green-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Zero-Knowledge</h3>
                    {/* --- TEXT REPLACED --- */}
                    <p className="text-gray-400">Your AES keys are encrypted with your personal ASAP key. Your private key is encrypted with your passphrase. We know nothing.</p>
                  </div>
                </div>
              </div>
            </div>
        </div>
    );
}