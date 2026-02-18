/**
 * app/api/vectorize/route.ts
 *
 * POST /api/vectorize
 *
 * Receives plaintext text (decrypted client-side) + the file's AES key.
 * Uses LangChain to:
 *   1. Split text into chunks (RecursiveCharacterTextSplitter)
 *   2. Generate embedding (GoogleGenerativeAIEmbeddings, text-embedding-004)
 *   3. Serialize the vector
 *   4. AES-GCM encrypt the vector with the provided key
 *   5. Store in DB
 *
 * The server sees plaintext text briefly but never stores it.
 * Only the AES-encrypted embedding is persisted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { PrismaClient } from '@prisma/client';
import {
    splitTextIntoChunks,
    embedDocuments,
    serializeVector,
} from '@/lib/server/langchain-pipeline';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// AES-GCM encryption using Node.js crypto (server-side)
import { createCipheriv, randomBytes } from 'crypto';

function encryptVectorServer(vectorBase64: string, aesKeyHex: string): string {
    const key = Buffer.from(aesKeyHex, 'hex');
    const iv = randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const data = Buffer.from(vectorBase64, 'utf-8');
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv(12) + authTag(16) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { fileId: string; text: string; fileName: string; aesKeyHex: string; fileType: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { fileId, text, fileName, aesKeyHex, fileType } = body;

    if (!fileId || !text || !aesKeyHex) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const file = await prisma.encryptedFile.findUnique({
        where: { id: fileId, userId: session.user.id },
        select: { id: true },
    });

    if (!file) {
        return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
    }

    try {
        // Step 1: Split text into chunks
        const chunks = await splitTextIntoChunks(text, { fileName, fileId });

        // Step 2: Embed all chunks, then average for a single document vector
        const chunkTexts = chunks.map(c => c.pageContent).filter(t => t.trim().length > 0);

        if (chunkTexts.length === 0) {
            return NextResponse.json({ success: true, message: 'No text to index.' });
        }

        const embeddings = await embedDocuments(chunkTexts);

        // Average all chunk embeddings into a single document vector
        const dim = embeddings[0].length;
        const avgVector = new Array(dim).fill(0);
        for (const emb of embeddings) {
            for (let i = 0; i < dim; i++) avgVector[i] += emb[i] / embeddings.length;
        }

        // Step 3: Serialize vector to Base64
        const serialized = serializeVector(avgVector);

        // Step 4: AES-GCM encrypt the serialized vector
        const encryptedVector = encryptVectorServer(serialized, aesKeyHex);

        // Step 5: Store in DB
        await prisma.encryptedFile.update({
            where: { id: fileId },
            data: {
                encryptedVector,
                vectorizedAt: new Date(),
                fileType: fileType || 'unknown',
            },
        });

        revalidatePath('/dashboard/search');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[/api/vectorize] Error:', error);
        return NextResponse.json(
            { error: `Vectorization failed: ${error.message}` },
            { status: 500 }
        );
    }
}
