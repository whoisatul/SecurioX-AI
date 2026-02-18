/**
 * app/api/search/embed/route.ts
 *
 * POST /api/search/embed
 *
 * Embeds a search query using Gemini text-embedding-004.
 * Returns the raw number[] vector to the client.
 * The client then decrypts stored vectors locally and computes similarity.
 *
 * This keeps search private: the server only sees the query string,
 * not the file contents or vectors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { embedQuery } from '@/lib/server/langchain-pipeline';

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
    if (!query?.trim()) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        const vector = await embedQuery(query.trim());
        return NextResponse.json({ vector });
    } catch (error: any) {
        console.error('[/api/search/embed] Error:', error);
        return NextResponse.json(
            { error: `Embedding failed: ${error.message}` },
            { status: 500 }
        );
    }
}
