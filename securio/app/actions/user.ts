// app/actions/user.ts
'use server';

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// This function receives the keys and the ENCRYPTED private key from the client
export async function completeKeySetup(
  publicKey: string,
  encryptedPrivateKey: string
) {
  const session = await getServerSession(authOptions); // Fetch session inside the action

  if (!session?.user?.id) { // Use ID for database operations
    return { success: false, message: "User not authenticated." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id }, // Use ID here
      data: {
        publicKey: publicKey,
        encryptedPrivateKey: encryptedPrivateKey,
      },
    });

    // Revalidate relevant paths to trigger UI/middleware updates
    revalidatePath('/dashboard', 'layout'); // Revalidate layout to potentially update session data faster
    revalidatePath('/onboard-keys', 'page');

    return { success: true, message: "Encryption keys successfully stored." };
  } catch (error) {
    console.error("Database error during key setup:", error);
    return { success: false, message: "Failed to store keys. Please try again." };
  }
}