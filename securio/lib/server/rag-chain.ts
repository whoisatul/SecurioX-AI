/**
 * lib/server/rag-chain.ts
 *
 * LangChain RAG chain powered by Groq (Llama 3.3 70B).
 *
 * - Chat/streaming: Groq (GROQ_API_KEY)
 * - Embeddings: still Gemini (GOOGLE_API_KEY) — Groq doesn't have embedding models
 */

import { ChatGroq } from '@langchain/groq';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

// ---------------------------------------------------------------------------
// LLM Singletons (Groq — Llama 3.3 70B)
// ---------------------------------------------------------------------------
let streamingLlm: ChatGroq | null = null;
let nonStreamingLlm: ChatGroq | null = null;

function getLlm(streaming: boolean): ChatGroq {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY env var is not set');

    if (streaming) {
        if (!streamingLlm) {
            streamingLlm = new ChatGroq({
                apiKey,
                model: 'llama-3.3-70b-versatile',
                streaming: true,
                temperature: 0.3,
                maxTokens: 2048,
            });
        }
        return streamingLlm;
    } else {
        if (!nonStreamingLlm) {
            nonStreamingLlm = new ChatGroq({
                apiKey,
                model: 'llama-3.3-70b-versatile',
                streaming: false,
                temperature: 0.3,
                maxTokens: 256,
            });
        }
        return nonStreamingLlm;
    }
}

// ---------------------------------------------------------------------------
// RAG Prompt
// ---------------------------------------------------------------------------
const RAG_PROMPT = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are a helpful AI assistant for SecurioX, a zero-knowledge encrypted file vault.
You have been given excerpts from the user's decrypted files as context.
Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information to answer, say so clearly.
Be concise, accurate, and helpful.

CONTEXT FROM USER'S FILES:
{context}`,
    ],
    ['human', '{question}'],
]);

// ---------------------------------------------------------------------------
// Streaming RAG Chain
// ---------------------------------------------------------------------------
export function buildStreamingRagChain(): RunnableSequence {
    const llm = getLlm(true);
    const outputParser = new StringOutputParser();
    return RunnableSequence.from([RAG_PROMPT, llm, outputParser]);
}

// ---------------------------------------------------------------------------
// Non-streaming RAG Chain
// ---------------------------------------------------------------------------
export function buildRagChain(): RunnableSequence {
    const llm = getLlm(false);
    const outputParser = new StringOutputParser();
    return RunnableSequence.from([RAG_PROMPT, llm, outputParser]);
}

// ---------------------------------------------------------------------------
// Context Formatter
// ---------------------------------------------------------------------------
export interface ContextDocument {
    fileName: string;
    excerpt: string;
    relevanceScore?: number;
}

export function formatContextForPrompt(docs: ContextDocument[]): string {
    if (docs.length === 0) {
        return 'No relevant documents found in the vault. Let the user know you could not find relevant files.';
    }

    return docs
        .map((doc, i) => {
            const score = doc.relevanceScore !== undefined
                ? ` (relevance: ${Math.round(doc.relevanceScore * 100)}%)`
                : '';
            return `--- Document ${i + 1}: ${doc.fileName}${score} ---\n${doc.excerpt}`;
        })
        .join('\n\n');
}

// ---------------------------------------------------------------------------
// Chat Title Generator
// ---------------------------------------------------------------------------
export async function generateChatTitle(firstMessage: string): Promise<string> {
    const llm = getLlm(false);
    const outputParser = new StringOutputParser();

    const titlePrompt = ChatPromptTemplate.fromMessages([
        ['system', 'Generate a very short title (3-5 words max) for this chat. Return ONLY the title, no quotes.'],
        ['human', '{message}'],
    ]);

    const chain = RunnableSequence.from([titlePrompt, llm, outputParser]);
    const title = await chain.invoke({ message: firstMessage });
    return title.trim().slice(0, 60);
}
