'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function KeySetupRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    const hasEncryptionKeys = (session?.user as any)?.hasEncryptionKeys;
    
    if (!hasEncryptionKeys) {
      router.push('/onboard-keys');
    }
  }, [session, status, router]);

  return null; // This component doesn't render anything
}
