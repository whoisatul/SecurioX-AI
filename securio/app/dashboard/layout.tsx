'use client';

import Link from 'next/link';
import Image from 'next/image';
import LogoutButton from './LogoutButton';
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.01]">
        {/* Header */}
        <div className="p-5 flex items-center space-x-1">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="mt-0.5" />
          <span className="text-lg font-semibold text-white tracking-tight">SecurioX</span>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-2 space-y-0.5 flex-1">
          <NavLink href="/dashboard" icon={<HomeIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard'}>
            Dashboard
          </NavLink>
          <NavLink href="/dashboard/files" icon={<ArchiveBoxIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard/files'}>
            My Files
          </NavLink>
          <NavLink href="/dashboard/upload" icon={<ArrowUpTrayIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard/upload'}>
            Upload File
          </NavLink>
          <NavLink href="/dashboard/search" icon={<MagnifyingGlassIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard/search'}>
            Search Vault
          </NavLink>
          <NavLink href="/dashboard/chat" icon={<SparklesIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard/chat'}>
            AI Chat
          </NavLink>

          <div className="h-px bg-white/[0.06] my-3" />

          <NavLink href="/dashboard/settings" icon={<Cog6ToothIcon className="w-[18px] h-[18px]" />} active={pathname === '/dashboard/settings'}>
            Settings
          </NavLink>
        </nav>

        {/* Logout Button at the bottom */}
        <div className="p-3 border-t border-white/[0.06]">
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

const NavLink = ({ href, children, icon, className = "", active = false }: {
  href: string,
  children: React.ReactNode,
  icon: React.ReactNode,
  className?: string,
  active?: boolean
}) => (
  <Link
    href={href}
    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
      ${className}
      ${active
        ? 'bg-white/[0.06] text-white'
        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
      }`}
  >
    {icon}
    <span>{children}</span>
  </Link>
);
