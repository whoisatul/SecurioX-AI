/**
 * lib/shared/vector-utils.ts
 *
 * Pure math utilities for vector operations — no Node.js or browser-only APIs.
 * Safe to import in both server (API routes) and client (browser) code.
 *
 * Kept separate from langchain-pipeline.ts so LangChain (server-only) is
 * never accidentally bundled into the browser.
 */

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
 * Converts a cosine similarity score [-1,1] to a human-readable percentage [0,100].
 */
export function scoreToPercent(score: number): number {
    return Math.max(0, Math.round(((score + 1) / 2) * 100));
}

// ---------------------------------------------------------------------------
// Vector Serialization — browser-safe (uses pure JS, no Buffer/btoa)
// ---------------------------------------------------------------------------

/**
 * Deserializes a Base64 string back to a number[] embedding.
 * Browser-safe: uses pure JS without Buffer or atob internals.
 */
export function deserializeVector(base64: string): number[] {
    // Works in both browser and Node.js
    const binaryStr = typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('binary') // Node.js
        : atob(base64); // Browser

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return Array.from(new Float32Array(bytes.buffer));
}
