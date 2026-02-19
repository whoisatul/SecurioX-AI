/**
 * lib/server/langchain-pipeline.ts
 *
 * Core LangChain.js server-side pipeline utilities.
 * Uses Google Gemini for embeddings (text-embedding-004, 768-dim).
 *
 * SERVER-ONLY — never import this in client components.
 * Pure math/serialization utils live in lib/shared/vector-utils.ts.
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

// Re-export shared utils so callers only need one import
export { cosineSimilarity, rankDocuments, scoreToPercent, deserializeVector } from '@/lib/shared/vector-utils';

// ---------------------------------------------------------------------------
// Embedding Model Singleton
// ---------------------------------------------------------------------------
let embeddingModel: GoogleGenerativeAIEmbeddings | null = null;

export function getEmbeddingModel(): GoogleGenerativeAIEmbeddings {
    if (!embeddingModel) {
        embeddingModel = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY!,
            model: 'text-embedding-004', // 768-dim
        });
    }
    return embeddingModel;
}

// ---------------------------------------------------------------------------
// Text Splitting (lazy singleton — not initialized at import time)
// ---------------------------------------------------------------------------
let textSplitter: RecursiveCharacterTextSplitter | null = null;

function getTextSplitter(): RecursiveCharacterTextSplitter {
    if (!textSplitter) {
        textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ['\n\n', '\n', '. ', ' ', ''],
        });
    }
    return textSplitter;
}

/**
 * Splits text into overlapping chunks for better embedding coverage.
 */
export async function splitTextIntoChunks(
    text: string,
    metadata: Record<string, string> = {}
): Promise<Document[]> {
    return getTextSplitter().createDocuments([text], [metadata]);
}

// ---------------------------------------------------------------------------
// Embedding Generation
// ---------------------------------------------------------------------------

/** Embeds a single string. Returns a 768-dim float array. */
export async function embedText(text: string): Promise<number[]> {
    const [embedding] = await getEmbeddingModel().embedDocuments([text]);
    return embedding;
}

/** Embeds a search query (query-optimized). Returns a 768-dim float array. */
export async function embedQuery(query: string): Promise<number[]> {
    return getEmbeddingModel().embedQuery(query);
}

/** Embeds multiple text chunks in a single batch call. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
    return getEmbeddingModel().embedDocuments(texts);
}

// ---------------------------------------------------------------------------
// Vector Serialization — SERVER-ONLY (uses Node.js Buffer)
// For browser deserialization use deserializeVector from lib/shared/vector-utils
// ---------------------------------------------------------------------------

/**
 * Serializes a number[] embedding to a compact Base64 string.
 * Node.js only — uses Buffer.from().
 * 768 floats × 4 bytes = 3072 bytes → ~4096 chars Base64.
 */
export function serializeVector(vector: number[]): string {
    const f32 = new Float32Array(vector);
    return Buffer.from(f32.buffer).toString('base64');
}
