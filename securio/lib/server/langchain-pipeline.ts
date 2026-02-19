/**
 * lib/server/langchain-pipeline.ts
 *
 * Server-only LangChain utilities for semantic search.
 *
 * Models:
 *   - Embeddings: gemini-embedding-001 (3072 dims)
 *
 * Exports:
 *   - embedDocuments(texts) → number[][]
 *   - embedQuery(text) → number[]
 *   - splitTextIntoChunks(text, metadata?)
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

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
            model: 'gemini-embedding-001',  // 3072-dim
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
