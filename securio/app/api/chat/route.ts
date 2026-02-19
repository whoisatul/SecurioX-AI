/**
 * app/api/chat/route.ts
 *
 * POST /api/chat
 *
 * RAG-powered chat using Pinecone for context + Groq for responses.
 * 1. Embed query with Gemini → query Pinecone for relevant chunks
 * 2. Stream response from Groq with file context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { embedQuery } from '@/lib/server/langchain-pipeline';
import { queryVectors } from '@/lib/server/pinecone';
import { buildStreamingRagChain } from '@/lib/server/rag-chain';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { query: string; sessionId?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { query, sessionId } = body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return NextResponse.json({ error: 'Missing or empty query' }, { status: 400 });
    }

    try {
        // ---- Retrieve context from Pinecone ----
        console.log(`[/api/chat] Embedding query for Pinecone: "${query.slice(0, 50)}"`);
        const queryEmbedding = await embedQuery(query);
        const pineconeResults = await queryVectors(session.user.id, queryEmbedding, 5);

        console.log(`[/api/chat] Pinecone returned ${pineconeResults.length} chunks`);

        // Format context from Pinecone results
        const formattedContext = pineconeResults.length > 0
            ? pineconeResults
                .map((r, i) => `--- File: ${r.fileName} (relevance: ${Math.round(r.score * 100)}%) ---\n${r.text}`)
                .join('\n\n')
            : 'No relevant documents found in the vault.';

        // ---- Manage chat session ----
        let activeSessionId = sessionId;
        if (!activeSessionId) {
            const newSession = await prisma.chatSession.create({
                data: { userId: session.user.id, title: query.slice(0, 50) },
            });
            activeSessionId = newSession.id;
        }

        // Save user message
        await prisma.chatMessage.create({
            data: { sessionId: activeSessionId, role: 'user', content: query },
        });

        // ---- Build streaming RAG chain (Groq) ----
        const chain = buildStreamingRagChain();
        const encoder = new TextEncoder();
        let fullResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send session ID to client
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: activeSessionId })}\n\n`)
                    );

                    // Send context info
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'context',
                            filesUsed: pineconeResults.map(r => r.fileName),
                            totalChunks: pineconeResults.length,
                        })}\n\n`)
                    );

                    console.log('[/api/chat] Starting Groq stream...');
                    const streamResult = await chain.stream({
                        context: formattedContext,
                        question: query,
                    });

                    for await (const chunk of streamResult) {
                        fullResponse += chunk;
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`)
                        );
                    }

                    // Save assistant message
                    await prisma.chatMessage.create({
                        data: { sessionId: activeSessionId!, role: 'assistant', content: fullResponse },
                    });

                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                    );
                    controller.close();
                } catch (error: any) {
                    console.error('[/api/chat] Stream error:', error.message);
                    const errorMsg = error.message?.includes('429')
                        ? 'API rate limit exceeded. Please wait a moment and try again.'
                        : error.message?.includes('404')
                            ? 'Model not available. Check API key configuration.'
                            : `Chat error: ${error.message}`;
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`)
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Session-Id': activeSessionId,
            },
        });
    } catch (error: any) {
        console.error('[/api/chat] ❌ Error:', error.message);
        return NextResponse.json(
            { error: `Chat failed: ${error.message}` },
            { status: 500 }
        );
    }
}
