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
       <div className="flex items-center justify-center gap-2 mt-4 mb-4">
  <svg
    width="36"
    height="36"
    viewBox="0 0 64 64"
    className="drop-shadow-[0_0_10px_#22c55e]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="100%" stopColor="#15803D" />
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    {/* Shield */}
    <path
      d="M32 4 L56 12 V28 C56 42 46 54 32 60 C18 54 8 42 8 28 V12 Z"
      fill="url(#shieldGradient)"
      filter="url(#glow)"
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

  <h1 className="text-xl font-semibold text-white">
    Securio<span className="text-green-400 font-bold">X</span>
  </h1>
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
