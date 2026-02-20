/**
 * lib/server/pinecone.ts
 *
 * Pinecone vector DB client — singleton initialization and helpers.
 * Stores document chunk embeddings for semantic search.
 */

import { Pinecone } from '@pinecone-database/pinecone';

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------
let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
    if (!pineconeClient) {
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) throw new Error('PINECONE_API_KEY env var is not set');
        pineconeClient = new Pinecone({ apiKey });
    }
    return pineconeClient;
}

// ---------------------------------------------------------------------------
// Get the index (must already exist in Pinecone dashboard)
// ---------------------------------------------------------------------------
function getIndex() {
    const indexName = process.env.PINECONE_INDEX || 'securiox';
    return getPinecone().index(indexName);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VectorMetadata {
    userId: string;
    fileId: string;
    fileName: string;
    fileType: string;
    text: string;        // The chunk text (for RAG context retrieval)
    chunkIndex: number;
}

export interface SearchResult {
    fileId: string;
    fileName: string;
    fileType: string;
    score: number;
    text: string;        // The chunk text
    chunkIndex: number;
}

// ---------------------------------------------------------------------------
// Upsert vectors for a file (replaces any existing vectors for that fileId)
// ---------------------------------------------------------------------------
export async function upsertFileVectors(
    fileId: string,
    userId: string,
    fileName: string,
    fileType: string,
    chunks: string[],
    embeddings: number[][],
): Promise<number> {
    const index = getIndex();

    // Delete existing vectors for this file first (in case of re-index)
    try {
        await index.namespace(userId).deleteMany({
            filter: { fileId: { $eq: fileId } },
        });
    } catch (e) {
        // Namespace might not exist yet, that's fine
        console.log(`[Pinecone] No existing vectors to delete for fileId=${fileId}`);
    }

    // Build vector records
    const vectors = chunks.map((text, i) => ({
        id: `${fileId}_chunk_${i}`,
        values: embeddings[i],
        metadata: {
            userId,
            fileId,
            fileName,
            fileType,
            text: text.slice(0, 35000), // Pinecone metadata limit ~40KB per vector
            chunkIndex: i,
        } as VectorMetadata,
    }));

    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Pinecone SDK types are tricky here, but this is the correct signature for v2+
        await index.namespace(userId).upsert({ records: batch });
    }

    console.log(`[Pinecone] ✅ Upserted ${vectors.length} vectors for file "${fileName}" (userId=${userId})`);
    return vectors.length;
}

// ---------------------------------------------------------------------------
// Query similar vectors for a user
// ---------------------------------------------------------------------------
export async function queryVectors(
    userId: string,
    queryEmbedding: number[],
    topK: number = 5,
): Promise<SearchResult[]> {
    const index = getIndex();

    const response = await index.namespace(userId).query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
    });

    if (!response.matches?.length) {
        return [];
    }

    return response.matches
        .filter(m => m.metadata && m.score !== undefined)
        .map(m => {
            const meta = m.metadata as unknown as VectorMetadata;
            return {
                fileId: meta.fileId,
                fileName: meta.fileName,
                fileType: meta.fileType,
                score: m.score!,
                text: meta.text,
                chunkIndex: meta.chunkIndex,
            };
        });
}

// ---------------------------------------------------------------------------
// Delete all vectors for a file
// ---------------------------------------------------------------------------
export async function deleteFileVectors(userId: string, fileId: string): Promise<void> {
    const index = getIndex();
    try {
        await index.namespace(userId).deleteMany({
            filter: { fileId: { $eq: fileId } },
        });
        console.log(`[Pinecone] Deleted vectors for fileId=${fileId}`);
    } catch (e) {
        console.warn(`[Pinecone] Failed to delete vectors for fileId=${fileId}:`, e);
    }
}
