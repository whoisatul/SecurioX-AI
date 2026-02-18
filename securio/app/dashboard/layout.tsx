'use client'; // This layout must be client-side to use usePathname

import Link from 'next/link';
import LogoutButton from './LogoutButton';
// import KeySetupRedirect from '@/components/KeySetupRedirect'; // <--- WE ARE REMOVING THIS
import {
  HomeIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    // Add padding to the main div to "float" the sidebar
    <div className="flex min-h-screen p-4 gap-4">

      {/* Sidebar: NEW Floating Glass Effect with Neon Hover */}
      <aside className="dark-glass-neon w-64 flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="p-6 flex items-center space-x-2 border-b border-green-400/10">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-teal-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-lg">S</span>
          </div>
          <span className="text-2xl font-bold text-white">Securio</span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-1">
          <NavLink href="/dashboard" icon={<HomeIcon className="w-5 h-5" />} active={pathname === '/dashboard'}>
            Dashboard
          </NavLink>
          <NavLink href="/dashboard/files" icon={<ArchiveBoxIcon className="w-5 h-5" />} active={pathname === '/dashboard/files'}>
            My Files
          </NavLink>
          <NavLink href="/dashboard/upload" icon={<ArrowUpTrayIcon className="w-5 h-5" />} active={pathname === '/dashboard/upload'}>
            Upload File
          </NavLink>
          <NavLink href="/dashboard/search" icon={<MagnifyingGlassIcon className="w-5 h-5" />} active={pathname === '/dashboard/search'}>
            Search Vault
          </NavLink>
          <NavLink href="/dashboard/chat" icon={<SparklesIcon className="w-5 h-5" />} active={pathname === '/dashboard/chat'}>
            AI Chat
          </NavLink>
          <NavLink href="/dashboard/settings" icon={<Cog6ToothIcon className="w-5 h-5" />} active={pathname === '/dashboard/settings'}>
            Settings
          </NavLink>
          <NavLink href="/onboard-keys" icon={<KeyIcon className="w-5 h-5" />} active={pathname === '/onboard-keys'} className="text-yellow-400 hover:text-yellow-300">
            Setup Keys
          </NavLink>
        </nav>

        {/* Logout Button at the bottom */}
        <div className="p-4 border-t border-green-400/10">
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* <KeySetupRedirect /> */} {/* <--- THE BAD LINE IS GONE */}
        {children}
      </main>
    </div>
  );
}

// Updated NavLink to support icons and active state
const NavLink = ({ href, children, icon, className = "", active = false }: {
  href: string,
  children: React.ReactNode,
  icon: React.ReactNode,
  className?: string,
  active?: boolean
}) => (
  <Link
    href={href}
    className={`flex items-center space-x-3 p-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition duration-150 
                  ${className} 
                  ${active ? 'bg-green-400/10 text-green-300' : ''}`}
  >
    {icon}
    <span>{children}</span>
  </Link>
);

