/**
 * app/api/vectorize/route.ts
 *
 * POST /api/vectorize
 *
 * Receives plaintext text (extracted client-side) for a file.
 * Pipeline:
 *   1. Validate inputs (fileId, text)
 *   2. Verify file ownership
 *   3. Split text → LangChain RecursiveCharacterTextSplitter
 *   4. Embed chunks → Google Gemini (gemini-embedding-001, 3072-dim)
 *   5. Upsert chunk vectors + text into Pinecone
 *   6. Update vectorizedAt in PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { splitTextIntoChunks, embedDocuments } from '@/lib/server/langchain-pipeline';
import { upsertFileVectors } from '@/lib/server/pinecone';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { fileId: string; text: string; fileName: string; fileType: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { fileId, text, fileName, fileType } = body;

    // --- Input validation ---
    if (!fileId || typeof fileId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid fileId' }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
    }

    // --- Verify ownership ---
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
        console.log(`[/api/vectorize] Splitting text for "${fileName}", textLen=${text.length}`);
        const chunks = await splitTextIntoChunks(text, { fileName: fileName || '', fileId });
        const chunkTexts = chunks.map(c => c.pageContent).filter(t => t.trim().length > 0);

        if (chunkTexts.length === 0) {
            console.warn(`[/api/vectorize] No text content after splitting for "${fileName}"`);
            return NextResponse.json({ success: true, message: 'No text content to index.' });
        }

        // Step 2: Embed all chunks with Gemini
        console.log(`[/api/vectorize] Embedding ${chunkTexts.length} chunks for "${fileName}"`);
        const embeddings = await embedDocuments(chunkTexts);

        if (!embeddings?.length || !embeddings[0]?.length) {
            throw new Error('Embedding model returned empty or null vectors');
        }

        const dim = embeddings[0].length;
        console.log(`[/api/vectorize] Embedding dim=${dim}, chunks=${embeddings.length}`);

        // Step 3: Upsert into Pinecone
        const upserted = await upsertFileVectors(
            fileId,
            session.user.id,
            fileName || 'unknown',
            fileType || 'unknown',
            chunkTexts,
            embeddings,
        );

        // Step 4: Update DB to mark as vectorized
        await prisma.encryptedFile.update({
            where: { id: fileId },
            data: {
                vectorizedAt: new Date(),
                fileType: fileType || 'unknown',
            },
        });

        revalidatePath('/dashboard/search');
        console.log(`[/api/vectorize] ✅ Indexed "${fileName}" (${upserted} chunks, dim=${dim})`);

        return NextResponse.json({ success: true, chunksIndexed: upserted, dim });
    } catch (error: any) {
        console.error('[/api/vectorize] ❌ Error:', {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            fileId,
        });
        return NextResponse.json(
            { error: `Vectorization failed: ${error.message}` },
            { status: 500 }
        );
    }
}
