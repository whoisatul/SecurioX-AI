/**
 * app/api/chat/route.ts
 *
 * POST /api/chat
 *
 * LangChain RAG chat endpoint with SSE streaming.
 * Input:  { query, context[], sessionId? }
 * Output: Server-Sent Events stream of Gemini response.
 *
 * The server never touches encrypted files — context is assembled by the client.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import {
    buildStreamingRagChain,
    formatContextForPrompt,
    generateChatTitle,
    type ContextDocument,
} from '@/lib/server/rag-chain';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let body: { query: string; context: ContextDocument[]; sessionId?: string };

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
        try {
            const title = await generateChatTitle(query).catch(() => 'New Chat');
            const newSession = await prisma.chatSession.create({
                data: { userId: session.user.id, title },
                select: { id: true },
            });
            activeSessionId = newSession.id;
        } catch (err: any) {
            console.error('[/api/chat] Session creation error:', err.message);
            // Fall through — we can still chat without a saved session
            activeSessionId = 'temp-' + Date.now();
        }
    }

    // Save user message (skip if temp session)
    if (!activeSessionId.startsWith('temp-')) {
        try {
            await prisma.chatMessage.create({
                data: {
                    role: 'user',
                    content: query,
                    sessionId: activeSessionId,
                },
            });
        } catch (err: any) {
            console.warn('[/api/chat] Failed to save user message:', err.message);
        }
    }

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
                // Send session ID
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: activeSessionId })}\n\n`)
                );

                // Stream the LLM response
                console.log('[/api/chat] Starting stream for query:', query.slice(0, 50));
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
                if (!activeSessionId!.startsWith('temp-')) {
                    try {
                        await prisma.chatMessage.create({
                            data: {
                                role: 'assistant',
                                content: fullResponse,
                                sessionId: activeSessionId!,
                            },
                        });
                    } catch (err: any) {
                        console.warn('[/api/chat] Failed to save assistant message:', err.message);
                    }
                }

                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                );
                controller.close();
            } catch (error: any) {
                console.error('[/api/chat] Stream error:', error.message);
                const errorMsg = error.message?.includes('429')
                    ? 'Gemini API rate limit exceeded. Please wait a minute and try again.'
                    : error.message?.includes('404')
                        ? 'Gemini model not available. Check GOOGLE_API_KEY and model configuration.'
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
}
