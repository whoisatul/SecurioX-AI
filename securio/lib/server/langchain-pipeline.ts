/**
 * lib/server/langchain-pipeline.ts
 *
 * Core LangChain.js server-side pipeline utilities.
 * Uses Google Gemini for embeddings (text-embedding-004, 768-dim).
 *
 * This module is server-only ('use server' not needed — imported only from API routes).
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

// ---------------------------------------------------------------------------
// Embedding Model Singleton
// ---------------------------------------------------------------------------
let embeddingModel: GoogleGenerativeAIEmbeddings | null = null;

export function getEmbeddingModel(): GoogleGenerativeAIEmbeddings {
    if (!embeddingModel) {
        embeddingModel = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY!,
            model: 'text-embedding-004', // 768-dim, best Gemini embedding model
        });
    }
    return embeddingModel;
}

// ---------------------------------------------------------------------------
// Text Splitting
// ---------------------------------------------------------------------------

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', ''],
});

/**
 * Splits text into overlapping chunks for better embedding coverage.
 * Returns LangChain Document objects with metadata.
 */
export async function splitTextIntoChunks(
    text: string,
    metadata: Record<string, string> = {}
): Promise<Document[]> {
    const docs = await textSplitter.createDocuments([text], [metadata]);
    return docs;
}

// ---------------------------------------------------------------------------
// Embedding Generation
// ---------------------------------------------------------------------------

/**
 * Embeds a single text string using Gemini text-embedding-004.
 * Returns a 768-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
    const model = getEmbeddingModel();
    const [embedding] = await model.embedDocuments([text]);
    return embedding;
}

/**
 * Embeds a search query (uses query-optimized embedding).
 * Returns a 768-dimensional float array.
 */
export async function embedQuery(query: string): Promise<number[]> {
    const model = getEmbeddingModel();
    return model.embedQuery(query);
}

/**
 * Embeds multiple text chunks in a single batch call.
 * More efficient than calling embedText() in a loop.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
    const model = getEmbeddingModel();
    return model.embedDocuments(texts);
}

// ---------------------------------------------------------------------------
// Cosine Similarity & Ranking
// ---------------------------------------------------------------------------

/**
 * Computes cosine similarity between two vectors.
 * Returns a value in [-1, 1], where 1 = identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Ranks candidate documents by cosine similarity to a query vector.
 * Returns sorted descending (most relevant first).
 */
export function rankDocuments(
    queryVector: number[],
    candidates: Array<{ id: string; vector: number[] }>
): Array<{ id: string; score: number }> {
    return candidates
        .map(({ id, vector }) => ({
            id,
            score: cosineSimilarity(queryVector, vector),
        }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Converts a cosine similarity score to a human-readable percentage.
 */
export function scoreToPercent(score: number): number {
    return Math.max(0, Math.round(((score + 1) / 2) * 100));
}

// ---------------------------------------------------------------------------
// Vector Serialization (for DB storage)
// ---------------------------------------------------------------------------

/**
 * Serializes a number[] embedding to a compact Base64 string via Float32Array.
 * 768 floats × 4 bytes = 3072 bytes → ~4096 chars Base64.
 */
export function serializeVector(vector: number[]): string {
    const f32 = new Float32Array(vector);
    const bytes = new Uint8Array(f32.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Deserializes a Base64 string back to a number[] embedding.
 */
export function deserializeVector(base64: string): number[] {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return Array.from(new Float32Array(bytes.buffer));
}
