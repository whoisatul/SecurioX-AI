'use client';

import { signOut } from 'next-auth/react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function LogoutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: '/' })} 
      className="w-full flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition duration-150 font-medium"
    >
      <ArrowRightOnRectangleIcon className="w-5 h-5" />
      <span>Logout</span>
    </button>
  );
}
