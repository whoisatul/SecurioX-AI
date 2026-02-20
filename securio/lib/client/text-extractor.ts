/**
 * lib/client/text-extractor.ts
 *
 * Client-side text extraction from decrypted file buffers.
 * Used by the chat page to extract text from decrypted files
 * before sending context to the RAG chain.
 *
 * Also used by the upload page to extract text before sending
 * to /api/vectorize for embedding.
 *
 * Supported formats:
 *  - PDF       → pdfjs-dist (Mozilla PDF.js)
 *  - TXT / MD  → TextDecoder (native)
 *  - DOCX      → mammoth.js
 *  - Others    → empty string
 */

'use client';

export type FileType = 'pdf' | 'text' | 'docx' | 'image' | 'unknown';

export function detectFileType(fileName: string, mimeType?: string): FileType {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
    if (['txt', 'md', 'markdown', 'csv', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'xml'].includes(ext)) return 'text';
    if (['doc', 'docx'].includes(ext)) return 'docx';
    return 'unknown';
}

const MAX_CHARS = 8000;

/**
 * Extracts plain text from a decrypted file ArrayBuffer.
 * Returns empty string if extraction fails or type is unsupported.
 */
export async function extractText(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType?: string
): Promise<{ text: string; fileType: FileType }> {
    const fileType = detectFileType(fileName, mimeType);

    try {
        switch (fileType) {
            case 'pdf':
                return { text: await extractPdfText(buffer), fileType };
            case 'text':
                return { text: extractPlainText(buffer), fileType };
            case 'docx':
                return { text: await extractDocxText(buffer), fileType };
            default:
                return { text: '', fileType: 'unknown' };
        }
    } catch (err) {
        console.warn(`[TextExtractor] Extraction failed for ${fileName}:`, err);
        return { text: '', fileType };
    }
}

// ---------------------------------------------------------------------------
// PDF extraction via PDF.js
// ---------------------------------------------------------------------------
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const textParts: string[] = [];
    let totalChars = 0;

    for (let i = 1; i <= pdf.numPages && totalChars < MAX_CHARS; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .filter((item) => 'str' in item)
            .map((item) => (item as { str: string }).str)
            .join(' ');
        textParts.push(pageText);
        totalChars += pageText.length;
    }

    return textParts.join('\n').slice(0, MAX_CHARS);
}

// ---------------------------------------------------------------------------
// Plain text / code / markdown
// ---------------------------------------------------------------------------
function extractPlainText(buffer: ArrayBuffer): string {
    return new TextDecoder('utf-8', { fatal: false })
        .decode(buffer)
        .slice(0, MAX_CHARS);
}

// ---------------------------------------------------------------------------
// DOCX via mammoth.js
// ---------------------------------------------------------------------------
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value.slice(0, MAX_CHARS);
}
