/**
 * lib/server/rag-chain.ts
 *
 * LangGraph RAG (Retrieval-Augmented Generation) chain.
 * Uses Gemini 1.5 Flash for streaming responses.
 *
 * Architecture:
 *   formatContext → generateAnswer → parseOutput
 *
 * The client sends decrypted file excerpts as context.
 * The server never touches the encrypted files directly.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

// ---------------------------------------------------------------------------
// LLM Singleton
// ---------------------------------------------------------------------------
let llmInstance: ChatGoogleGenerativeAI | null = null;

function getLlm(streaming = false): ChatGoogleGenerativeAI {
    if (!llmInstance || llmInstance.streaming !== streaming) {
        llmInstance = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY!,
            model: 'gemini-1.5-flash',
            streaming,
            temperature: 0.3, // Lower temp for factual RAG responses
            maxOutputTokens: 2048,
        });
    }
    return llmInstance;
}

// ---------------------------------------------------------------------------
// RAG Prompt Template
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
// RAG Chain (non-streaming, for simple responses)
// ---------------------------------------------------------------------------
export function buildRagChain(): RunnableSequence {
    const llm = getLlm(false);
    const outputParser = new StringOutputParser();

    return RunnableSequence.from([
        RAG_PROMPT,
        llm,
        outputParser,
    ]);
}

// ---------------------------------------------------------------------------
// Streaming RAG Chain
// ---------------------------------------------------------------------------
export function buildStreamingRagChain(): RunnableSequence {
    const llm = getLlm(true);
    const outputParser = new StringOutputParser();

    return RunnableSequence.from([
        RAG_PROMPT,
        llm,
        outputParser,
    ]);
}

// ---------------------------------------------------------------------------
// Context Formatter
// ---------------------------------------------------------------------------

export interface ContextDocument {
    fileName: string;
    excerpt: string;
    relevanceScore?: number;
}

/**
 * Formats retrieved document excerpts into a structured context string
 * for the RAG prompt.
 */
export function formatContextForPrompt(docs: ContextDocument[]): string {
    if (docs.length === 0) {
        return 'No relevant documents found in the vault.';
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

/**
 * Generates a short title for a chat session based on the first message.
 * Uses Gemini with a simple prompt — no RAG needed.
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
    const llm = getLlm(false);
    const outputParser = new StringOutputParser();

    const titlePrompt = ChatPromptTemplate.fromMessages([
        ['system', 'Generate a very short title (3-5 words max) for a chat that starts with this message. Return ONLY the title, no quotes or punctuation.'],
        ['human', firstMessage],
    ]);

    const chain = RunnableSequence.from([titlePrompt, llm, outputParser]);
    const title = await chain.invoke({ input: firstMessage });
    return title.trim().slice(0, 60);
}
