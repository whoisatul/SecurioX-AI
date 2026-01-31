'use server';

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
// Import the renamed function
import { decryptAesKeyWithAsap } from '@/lib/shared/asap-crypto-js';

const prisma = new PrismaClient();

/**
 * Performs server-side ASAP decryption of the AES key.
 * @param fileId - ID of the file record.
 * @param decryptedAsapPrivateKeyPem - The user's ASAP Private Key (PEM format, decrypted by Passphrase on client).
 */
export async function performKeyDecryption(
    fileId: string,
    decryptedAsapPrivateKeyPem: string // Expecting PEM format private key
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) { // Check ID
        return { success: false, message: "Authentication required." };
    }

    if (!fileId || !decryptedAsapPrivateKeyPem) {
        return { success: false, message: "Missing file ID or private key for decryption." };
    }

    try {
        // 1. Retrieve file metadata
        const fileRecord = await prisma.encryptedFile.findUnique({
            where: { id: fileId, userId: session.user.id }, // Ensure user owns the file
            select: { encryptedAesKey: true } // Only fetch the encrypted key
        });

        if (!fileRecord || !fileRecord.encryptedAesKey) {
             console.error(`Decryption error: File record ${fileId} not found or missing encrypted key for user ${session.user.id}`);
            return { success: false, message: "File not found, access denied, or key missing." };
        }

        // --- ASAP Decryption Step ---
        let plaintextAesKeyHex: string;
        try {
            // *** Use the renamed function ***
            plaintextAesKeyHex = await decryptAesKeyWithAsap(
                decryptedAsapPrivateKeyPem,
                fileRecord.encryptedAesKey // This is the Base64 ASAP encrypted key
            );
        } catch (decryptError: any) {
             console.error(`ASAP key decryption failed for file ${fileId}, user ${session.user.id}:`, decryptError);
             return { success: false, message: `Key decryption failed: ${decryptError.message}` };
        }
        // --- End ASAP Decryption ---

        return {
            success: true,
            plaintextAesKey: plaintextAesKeyHex, // Return key in hex format
            message: "AES key successfully retrieved."
        };

    } catch (error: any) {
        console.error(`Server error during key decryption for file ${fileId}:`, error);
        return { success: false, message: "An unexpected server error occurred during key decryption." };
    }
}