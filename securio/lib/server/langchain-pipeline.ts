/**
 * lib/server/langchain-pipeline.ts
 *
 * Server-only LangChain utilities for semantic search.
 *
 * Models (as of 2025):
 *   - Embeddings: gemini-embedding-001 (3072 dims)
 *   - Chat: gemini-2.0-flash (in rag-chain.ts)
 *
 * Exports:
 *   - embedDocuments(texts) → number[][]
 *   - embedQuery(text) → number[]
 *   - splitTextIntoChunks(text, metadata?)
 *   - serializeVector(vector) → base64 string
 *   - Re-exports shared utils (cosineSimilarity, etc.)
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

// Re-export shared utils so callers only need one import
export {
    cosineSimilarity,
    rankDocuments,
    scoreToPercent,
    deserializeVector,
} from '@/lib/shared/vector-utils';

// ---------------------------------------------------------------------------
// Embedding model singleton
// ---------------------------------------------------------------------------
let embeddingModel: GoogleGenerativeAIEmbeddings | null = null;

function getEmbeddingModel(): GoogleGenerativeAIEmbeddings {
    if (!embeddingModel) {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) throw new Error('GOOGLE_API_KEY env var is not set');
        embeddingModel = new GoogleGenerativeAIEmbeddings({
            apiKey,
            model: 'gemini-embedding-001',  // 3072-dim, the only available embedding model
        });
    }
    return embeddingModel;
}

// ---------------------------------------------------------------------------
// Text splitter (lazy singleton)
// ---------------------------------------------------------------------------
let splitter: RecursiveCharacterTextSplitter | null = null;

function getTextSplitter(): RecursiveCharacterTextSplitter {
    if (!splitter) {
        splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }
    return splitter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping chunks with optional metadata.
 */
export async function splitTextIntoChunks(
    text: string,
    metadata?: Record<string, string>
): Promise<Document[]> {
    const ts = getTextSplitter();
    return ts.createDocuments([text], metadata ? [metadata] : undefined);
}

/**
 * Embed multiple texts in one batch call.
 * Returns array of 3072-dim vectors.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
    const model = getEmbeddingModel();
    return model.embedDocuments(texts);
}

/**
 * Embed a single query string. Returns a 3072-dim vector.
 */
export async function embedQuery(text: string): Promise<number[]> {
    const model = getEmbeddingModel();
    return model.embedQuery(text);
}

/**
 * Serialize a float vector to Base64 (server-only, uses Buffer).
 */
export function serializeVector(vector: number[]): string {
    const f32 = new Float32Array(vector);
    return Buffer.from(f32.buffer).toString('base64');
}
