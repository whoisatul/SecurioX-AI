/**
 * app/api/chat/route.ts
 *
 * POST /api/chat
 *
 * LangGraph RAG chat endpoint with streaming.
 * Receives: { query, context[], sessionId? }
 *   - query: user's question
 *   - context: array of { fileName, excerpt } — decrypted client-side
 *   - sessionId: optional, for persistent chat history
 *
 * Returns: Server-Sent Events stream of the Gemini response.
 *
 * The server never touches encrypted files — context is assembled by the client.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { PrismaClient } from '@prisma/client';
import {
    buildStreamingRagChain,
    formatContextForPrompt,
    generateChatTitle,
    type ContextDocument,
} from '@/lib/server/rag-chain';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let body: {
        query: string;
        context: ContextDocument[];
        sessionId?: string;
    };

    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const { query, context, sessionId } = body;

    if (!query?.trim()) {
        return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Ensure or create a chat session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
        const title = await generateChatTitle(query).catch(() => 'New Chat');
        const newSession = await prisma.chatSession.create({
            data: { userId: session.user.id, title },
            select: { id: true },
        });
        activeSessionId = newSession.id;
    }

    // Save user message
    await prisma.chatMessage.create({
        data: {
            role: 'user',
            content: query,
            sessionId: activeSessionId,
        },
    });

    // Format context for the RAG prompt
    const formattedContext = formatContextForPrompt(context || []);

    // Build streaming RAG chain
    const chain = buildStreamingRagChain();

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Send session ID first so client can track the session
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: activeSessionId })}\n\n`)
                );

                // Stream the LLM response
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

                // Save assistant message after streaming completes
                await prisma.chatMessage.create({
                    data: {
                        role: 'assistant',
                        content: fullResponse,
                        sessionId: activeSessionId!,
                    },
                });

                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                );
                controller.close();
            } catch (error: any) {
                console.error('[/api/chat] Stream error:', error);
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
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
}
