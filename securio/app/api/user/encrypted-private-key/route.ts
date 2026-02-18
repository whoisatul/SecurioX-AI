/**
 * app/api/user/encrypted-private-key/route.ts
 *
 * GET /api/user/encrypted-private-key
 *
 * Returns the user's encrypted private key envelope.
 * Safe to return — it's AES-GCM encrypted with PBKDF2 and
 * cannot be used without the user's passphrase.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { encryptedPrivateKey: true },
        });

        if (!user?.encryptedPrivateKey) {
            return NextResponse.json(
                { error: 'Encryption keys not set up.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ encryptedPrivateKey: user.encryptedPrivateKey });
    } catch (error) {
        console.error('[API /user/encrypted-private-key]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
