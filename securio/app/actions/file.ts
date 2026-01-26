'use server'; // Directive to mark functions as Server Actions

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
// Import the renamed function
import { encryptAesKeyWithAsap } from '@/lib/asap-crypto-js';
import { revalidatePath } from "next/cache";

// Instantiate Prisma Client
const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Converts a File object (from FormData) into a Base64 data URI string.
 */
async function bufferToDataUri(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

/**
 * Server Action to handle the secure file upload process.
 */
export async function uploadEncryptedFile(formData: FormData) {
  // 1. Authenticate the user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.error("Upload Error: User not authenticated.");
    return { success: false, message: "Authentication required." };
  }
  const userId = session.user.id;

  // 2. Extract and validate data
  const encryptedFile = formData.get("encryptedFile") as File | null;
  const fileName = formData.get("fileName") as string | null;
  const plaintextAesKeyHex = formData.get("plaintextAesKey") as string | null;
  const iv = formData.get("iv") as string | null;

  if (!encryptedFile || !fileName || !plaintextAesKeyHex || !iv) {
    console.error(`Upload Error: Missing data for user ${userId}.`);
    return { success: false, message: "Missing required file data, key, or initialization vector for upload." };
  }

  try {
    // 3. Retrieve User's Public Key
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, publicKey: true },
    });

    if (!user?.publicKey || typeof user.publicKey !== 'string' || user.publicKey.trim() === '') {
        console.error(`Upload error: Missing or invalid public key for user ${userId}`);
        return { success: false, message: "User encryption keys are not properly set up." };
    }
    const userPublicKeyPem = user.publicKey;

    // --- ASAP Encryption Step (Server-Side) ---
    // 4. Encrypt the received AES key using the user's ASAP public key
    let encryptedAesKeyBase64: string;
    try {
        // *** Use the renamed function ***
        encryptedAesKeyBase64 = await encryptAesKeyWithAsap(userPublicKeyPem, plaintextAesKeyHex);
    } catch (encryptError: any) {
        console.error(`🔴 ASAP key encryption failed for user ${userId}:`, encryptError);
        return { success: false, message: `Failed to secure file key: ${encryptError.message}` };
    }
    // --- End ASAP Encryption ---

    // 5. Convert file to data URI
    const fileDataUri = await bufferToDataUri(encryptedFile);

    // 6. Create the final JSON payload
    const payloadObject = {
        file: fileDataUri,
        encryptedAesKey: encryptedAesKeyBase64,
        iv: iv,
        originalFileName: fileName,
        encryptedDate: new Date().toISOString()
    };
    const payloadBuffer = Buffer.from(JSON.stringify(payloadObject));

    // 7. Upload the payload Buffer to Cloudinary
    console.log(`☁️ Uploading payload for ${fileName} to Cloudinary for user ${userId}...`);
    const uploadResult = await new Promise<UploadApiResponse | UploadApiErrorResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: 'raw',
            folder: `securio/${userId}`,
            public_id: fileName.replace(/[^a-zA-Z0-9_.-]/g, '_') + '_' + Date.now(),
            tags: ['securio_encrypted'],
        }, (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error("Cloudinary returned no result."));
            resolve(result);
        });
        uploadStream.end(payloadBuffer);
    });

    // 8. Check Cloudinary Response
    if ('error' in uploadResult) {
        console.error("🔴 Cloudinary upload resulted in an error response:", uploadResult.error);
        throw new Error(`Cloudinary upload failed: ${uploadResult.error.message}`);
    }
    if (!uploadResult?.public_id) {
        console.error("🔴 Cloudinary upload failed or did not return a public_id.");
        throw new Error("Cloudinary upload processing failed.");
    }
    const cloudinaryPublicId = uploadResult.public_id;
    console.log(`✅ Cloudinary upload successful. Public ID: ${cloudinaryPublicId}`);

    // 9. Save metadata to your database
    console.log(`💾 Saving file metadata to database for user ${userId}...`);
    await prisma.encryptedFile.create({
      data: {
        fileName: fileName,
        fileSize: encryptedFile.size,
        cloudinaryPublicId: cloudinaryPublicId,
        encryptedAesKey: encryptedAesKeyBase64, // Store the ASAP-encrypted AES key
        userId: userId,
      },
    });
    console.log(`✅ File metadata saved successfully for ${fileName}.`);

    // 10. Invalidate Next.js cache
    revalidatePath("/dashboard/files");

    // 11. Return success response
    return { success: true, message: `File '${fileName}' securely uploaded.` };

  } catch (error: any) {
    console.error("🔴 File upload action failed:", error);
    return { success: false, message: `Upload error: ${error.message || 'An unexpected server error occurred.'}` };
  }
}