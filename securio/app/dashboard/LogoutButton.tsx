'use client';

import { signOut } from 'next-auth/react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200"
    >
      <ArrowRightOnRectangleIcon className="w-[18px] h-[18px]" />
      <span>Logout</span>
    </button>
  );
}
