/**
 * app/api/vectorize/route.ts
 *
 * POST /api/vectorize
 *
 * Receives plaintext text (decrypted client-side) + the file's raw AES key (hex).
 * Pipeline:
 *   1. Validate inputs (fileId, text, aesKeyHex length)
 *   2. Verify file ownership
 *   3. Split text → LangChain RecursiveCharacterTextSplitter
 *   4. Embed chunks → GoogleGenerativeAIEmbeddings (text-embedding-004)
 *   5. Average chunk embeddings → single 768-dim doc vector
 *   6. Serialize vector → Float32 Base64
 *   7. AES-256-GCM encrypt vector using the file's AES key
 *   8. Store encrypted vector in DB
 */

import { createCipheriv, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import {
    splitTextIntoChunks,
    embedDocuments,
    serializeVector,
} from '@/lib/server/langchain-pipeline';

// ---------------------------------------------------------------------------
// Server-side AES-GCM encryption
// Blob format: iv(12 bytes) | authTag(16 bytes) | ciphertext
// Client decrypts using Web Crypto: needs ciphertext | authTag concatenated
// ---------------------------------------------------------------------------
function encryptVectorServer(vectorBase64: string, aesKeyHex: string): string {
    // aesKeyHex must be exactly 64 hex chars (32 bytes for AES-256)
    if (!/^[0-9a-fA-F]{64}$/.test(aesKeyHex)) {
        throw new Error(
            `Invalid aesKeyHex: expected 64 hex chars, got ${aesKeyHex.length} chars. ` +
            `Value: ${aesKeyHex.slice(0, 8)}...`
        );
    }

    const key = Buffer.from(aesKeyHex, 'hex'); // 32 bytes
    const iv = randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const data = Buffer.from(vectorBase64, 'utf-8');
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // Layout: iv(12) | authTag(16) | ciphertext
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
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

    // --- Input validation ---
    if (!fileId || typeof fileId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid fileId' }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
    }
    if (!aesKeyHex || typeof aesKeyHex !== 'string') {
        return NextResponse.json({ error: 'Missing aesKeyHex' }, { status: 400 });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(aesKeyHex)) {
        console.error(`[/api/vectorize] Bad aesKeyHex: length=${aesKeyHex.length}, value=${aesKeyHex.slice(0, 8)}...`);
        return NextResponse.json({
            error: `Invalid aesKeyHex: must be 64 hex chars (got ${aesKeyHex.length})`,
        }, { status: 400 });
    }

    // --- Verify ownership (findFirst for compound condition) ---
    const file = await prisma.encryptedFile.findFirst({
        where: { id: fileId, userId: session.user.id },
        select: { id: true },
    });

    if (!file) {
        console.error(`[/api/vectorize] File not found: fileId=${fileId}, userId=${session.user.id}`);
        return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
    }

    try {
        // Step 1: Split text into overlapping chunks
        console.log(`[/api/vectorize] Splitting text for fileId=${fileId}, textLen=${text.length}`);
        const chunks = await splitTextIntoChunks(text, { fileName: fileName || '', fileId });
        const chunkTexts = chunks.map(c => c.pageContent).filter(t => t.trim().length > 0);

        if (chunkTexts.length === 0) {
            console.warn(`[/api/vectorize] No text content after splitting for fileId=${fileId}`);
            return NextResponse.json({ success: true, message: 'No text content to index.' });
        }

        console.log(`[/api/vectorize] Embedding ${chunkTexts.length} chunks for fileId=${fileId}`);

        // Step 2: Embed all chunks (single Gemini batch call)
        const embeddings = await embedDocuments(chunkTexts);

        if (!embeddings?.length || !embeddings[0]?.length) {
            throw new Error('Embedding model returned empty or null vectors');
        }

        // Step 3: Average chunk embeddings → single document vector
        const dim = embeddings[0].length;
        console.log(`[/api/vectorize] Embedding dim=${dim}, chunks=${embeddings.length}`);

        const avgVector = new Array<number>(dim).fill(0);
        for (const emb of embeddings) {
            if (emb.length !== dim) throw new Error(`Inconsistent embedding dim: ${emb.length} vs ${dim}`);
            for (let i = 0; i < dim; i++) {
                avgVector[i] += emb[i] / embeddings.length;
            }
        }

        // Step 4: Serialize vector → Base64 Float32
        const serialized = serializeVector(avgVector);
        console.log(`[/api/vectorize] Serialized vector length: ${serialized.length} chars`);

        // Step 5: AES-GCM encrypt the serialized vector
        const encryptedVector = encryptVectorServer(serialized, aesKeyHex);
        console.log(`[/api/vectorize] Encrypted vector length: ${encryptedVector.length} chars`);

        // Step 6: Store in DB
        await prisma.encryptedFile.update({
            where: { id: fileId },
            data: {
                encryptedVector,
                vectorizedAt: new Date(),
                fileType: fileType || 'unknown',
            },
        });

        revalidatePath('/dashboard/search');
        console.log(`[/api/vectorize] ✅ Indexed fileId=${fileId} (${chunkTexts.length} chunks, dim=${dim})`);

        return NextResponse.json({ success: true, chunksIndexed: chunkTexts.length, dim });
    } catch (error: any) {
        console.error('[/api/vectorize] ❌ Error:', {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            fileId,
            aesKeyHexLength: aesKeyHex?.length,
        });
        return NextResponse.json(
            { error: `Vectorization failed: ${error.message}` },
            { status: 500 }
        );
    }
}
