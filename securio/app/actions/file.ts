'use server';

/**
 * app/actions/file.ts
 *
 * TRUE ZK UPLOAD: The server receives an already-encrypted AES key (RSA-OAEP wrapped
 * by the client using the user's public key). The server NEVER sees the plaintext AES key.
 * The server NEVER performs any cryptographic operations.
 *
 * Upload payload from client:
 *  - encryptedFile:    AES-GCM encrypted file bytes
 *  - fileName:         Original filename
 *  - encryptedAesKey:  RSA-OAEP encrypted AES key (Base64) — wrapped client-side
 *  - iv:               AES-GCM IV (hex)
 */

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function bufferToDataUri(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

/**
 * Handles secure file upload.
 * Receives pre-encrypted file + pre-wrapped AES key from the client.
 * No crypto performed server-side.
 */
export async function uploadEncryptedFile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, message: "Authentication required." };
  }
  const userId = session.user.id;

  // Extract form data — note: encryptedAesKey is now RSA-wrapped by the CLIENT
  const encryptedFile = formData.get("encryptedFile") as File | null;
  const fileName = formData.get("fileName") as string | null;
  const encryptedAesKey = formData.get("encryptedAesKey") as string | null; // Already RSA-wrapped
  const iv = formData.get("iv") as string | null;

  if (!encryptedFile || !fileName || !encryptedAesKey || !iv) {
    return { success: false, message: "Missing required upload data." };
  }

  // Validate that the encrypted key looks like a Base64 blob (basic sanity check)
  if (encryptedAesKey.length < 100) {
    return { success: false, message: "Invalid encrypted key format." };
  }

  try {
    // Build the storage payload — everything here is ciphertext
    const fileDataUri = await bufferToDataUri(encryptedFile);

    const payloadObject = {
      file: fileDataUri,           // AES-GCM encrypted file (Base64)
      encryptedAesKey,             // RSA-OAEP wrapped AES key (Base64)
      iv,                          // AES-GCM IV (hex)
      originalFileName: fileName,
      encryptedDate: new Date().toISOString(),
    };

    const payloadBuffer = Buffer.from(JSON.stringify(payloadObject));

    // Upload to Cloudinary
    const uploadResult = await new Promise<UploadApiResponse | UploadApiErrorResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: `securio/${userId}`,
          public_id: fileName.replace(/[^a-zA-Z0-9_.-]/g, '_') + '_' + Date.now(),
          tags: ['securio_encrypted'],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Cloudinary returned no result."));
          resolve(result);
        }
      );
      uploadStream.end(payloadBuffer);
    });

    if ('error' in uploadResult) {
      throw new Error(`Cloudinary upload failed: ${(uploadResult as UploadApiErrorResponse).error.message}`);
    }

    const cloudinaryPublicId = (uploadResult as UploadApiResponse).public_id;

    // Persist metadata — encryptedAesKey stored as-is (it's already RSA-wrapped)
    const createdFile = await prisma.encryptedFile.create({
      data: {
        fileName,
        fileSize: encryptedFile.size,
        cloudinaryPublicId,
        encryptedAesKey, // RSA-OAEP wrapped — server cannot decrypt this
        userId,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/files");

    return { success: true, message: `File '${fileName}' securely uploaded.`, fileId: createdFile.id };
  } catch (error: any) {
    console.error("[uploadEncryptedFile] Error:", error);
    return { success: false, message: `Upload error: ${error.message || 'An unexpected error occurred.'}` };
  }
}