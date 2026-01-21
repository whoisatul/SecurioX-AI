// components/AuthSessionProvider.tsx
'use client'; // This must be a client component

import { SessionProvider } from 'next-auth/react';
import React from 'react';

/**
 * A wrapper component to provide NextAuth.js session context 
 * to all client components in the application.
 */
export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  // SessionProvider makes the session data accessible via useSession()
  return <SessionProvider>{children}</SessionProvider>;
}