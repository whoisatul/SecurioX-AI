/**
 * app/api/vectors/route.ts
 *
 * GET /api/vectors
 *
 * Returns all encrypted vectors for the current user's files.
 * The client decrypts them locally using the user's private key → AES key → vector.
 * Server returns opaque blobs — it cannot read them.
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
        const files = await prisma.encryptedFile.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                fileName: true,
                fileSize: true,
                uploadDate: true,
                cloudinaryPublicId: true,
                encryptedAesKey: true,
                encryptedVector: true,
                fileType: true,
                vectorizedAt: true,
            },
            orderBy: { uploadDate: 'desc' },
        });

        return NextResponse.json({ files });
    } catch (error: any) {
        console.error('[/api/vectors] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch vectors' }, { status: 500 });
    }
}
