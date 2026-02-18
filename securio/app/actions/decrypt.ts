'use server';

/**
 * app/actions/decrypt.ts
 *
 * TRUE ZK: This server action ONLY fetches the encrypted AES key from the DB.
 * It performs ZERO cryptographic operations.
 * The client is responsible for all decryption using the Web Crypto API.
 */

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";

const prisma = new PrismaClient();

/**
 * Fetches the RSA-encrypted AES key for a given file.
 * Enforces ownership — users can only fetch their own file keys.
 * No crypto is performed server-side.
 */
export async function getEncryptedAesKey(fileId: string): Promise<{
    success: boolean;
    encryptedAesKey?: string;
    message?: string;
}> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return { success: false, message: "Authentication required." };
    }

    if (!fileId) {
        return { success: false, message: "File ID is required." };
    }

    try {
        const fileRecord = await prisma.encryptedFile.findUnique({
            where: {
                id: fileId,
                userId: session.user.id, // Ownership enforced at DB query level
            },
            select: {
                encryptedAesKey: true,
            },
        });

        if (!fileRecord) {
            // Return a generic message — don't reveal whether the file exists or is owned by someone else
            return { success: false, message: "File not found or access denied." };
        }

        return {
            success: true,
            encryptedAesKey: fileRecord.encryptedAesKey,
        };
    } catch (error: any) {
        console.error(`[getEncryptedAesKey] DB error for file ${fileId}:`, error);
        return { success: false, message: "An unexpected server error occurred." };
    }
}