'use server';

/**
 * app/actions/user.ts
 *
 * Server actions for user account management.
 * getUserPublicKey: safely exposes the RSA public key (it's public — safe to return).
 * completeKeySetup: stores the public key + passphrase-encrypted private key.
 */

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

/**
 * Returns the authenticated user's RSA public key (SPKI PEM format).
 * Public keys are safe to expose — they are designed to be shared.
 * Used by the upload flow to encrypt the AES key client-side before upload.
 */
export async function getUserPublicKey(): Promise<{
  success: boolean;
  publicKey?: string;
  message?: string;
}> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, message: "Authentication required." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { publicKey: true },
    });

    if (!user?.publicKey) {
      return { success: false, message: "Encryption keys not set up. Please complete key setup." };
    }

    return { success: true, publicKey: user.publicKey };
  } catch (error: any) {
    console.error("[getUserPublicKey] DB error:", error);
    return { success: false, message: "Failed to retrieve public key." };
  }
}

/**
 * Stores the user's RSA public key and passphrase-encrypted private key.
 * The private key is NEVER stored in plaintext — only the encrypted envelope.
 * The server never sees the passphrase or the plaintext private key.
 */
export async function completeKeySetup(
  publicKey: string,
  encryptedPrivateKey: string
): Promise<{ success: boolean; message: string }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, message: "User not authenticated." };
  }

  if (!publicKey || !encryptedPrivateKey) {
    return { success: false, message: "Missing key material." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        publicKey,
        encryptedPrivateKey,
      },
    });

    revalidatePath('/dashboard', 'layout');
    revalidatePath('/onboard-keys', 'page');

    return { success: true, message: "Encryption keys successfully stored." };
  } catch (error) {
    console.error("[completeKeySetup] DB error:", error);
    return { success: false, message: "Failed to store keys. Please try again." };
  }
}