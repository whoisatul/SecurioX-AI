/**
 * app/api/search/route.ts
 *
 * POST /api/search
 *
 * Server-side semantic search using Pinecone.
 * 1. Embed query with Gemini
 * 2. Query Pinecone (filtered by userId namespace)
 * 3. Group results by file, take best score per file
 * 4. Return ranked file results with text excerpts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { embedQuery } from '@/lib/server/langchain-pipeline';
import { queryVectors, SearchResult } from '@/lib/server/pinecone';
import { prisma } from '@/lib/server/prisma';

interface FileResult {
    fileId: string;
    fileName: string;
    fileType: string;
    score: number;
    excerpts: string[];
    fileSize: number;
    uploadDate: string;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { query: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { query } = body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return NextResponse.json({ error: 'Missing or empty query' }, { status: 400 });
    }

    try {
        // Step 1: Embed the query with Gemini
        console.log(`[/api/search] Embedding query: "${query.slice(0, 50)}"`);
        const queryEmbedding = await embedQuery(query);

        // Step 2: Query Pinecone (namespace = userId for isolation)
        const results = await queryVectors(session.user.id, queryEmbedding, 10);
        console.log(`[/api/search] Pinecone returned ${results.length} chunks`);

        if (results.length === 0) {
            return NextResponse.json({ results: [] });
        }

        // Step 3: Group by file, take best score per file
        const fileMap = new Map<string, { best: SearchResult; excerpts: string[] }>();
        for (const r of results) {
            const existing = fileMap.get(r.fileId);
            if (!existing || r.score > existing.best.score) {
                fileMap.set(r.fileId, {
                    best: r,
                    excerpts: existing
                        ? [...existing.excerpts, r.text.slice(0, 200)]
                        : [r.text.slice(0, 200)],
                });
            } else {
                existing.excerpts.push(r.text.slice(0, 200));
            }
        }

        // Step 4: Fetch file metadata from DB
        const fileIds = Array.from(fileMap.keys());
        const files = await prisma.encryptedFile.findMany({
            where: { id: { in: fileIds }, userId: session.user.id },
            select: { id: true, fileName: true, fileSize: true, uploadDate: true, cloudinaryPublicId: true },
        });

        const fileMetaMap = new Map(files.map(f => [f.id, f]));

        // Step 5: Build response
        const fileResults: FileResult[] = Array.from(fileMap.entries())
            .map(([fileId, data]) => {
                const meta = fileMetaMap.get(fileId);
                return {
                    fileId,
                    fileName: meta?.fileName || data.best.fileName,
                    fileType: data.best.fileType,
                    score: Math.round(data.best.score * 100),
                    excerpts: data.excerpts.slice(0, 3),
                    fileSize: meta?.fileSize || 0,
                    uploadDate: meta?.uploadDate?.toISOString() || '',
                };
            })
            .sort((a, b) => b.score - a.score);

        console.log(`[/api/search] Returning ${fileResults.length} files`);
        return NextResponse.json({ results: fileResults });
    } catch (error: any) {
        console.error('[/api/search] ❌ Error:', error.message);
        return NextResponse.json(
            { error: `Search failed: ${error.message}` },
            { status: 500 }
        );
    }
}
