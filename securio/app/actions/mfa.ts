// app/actions/mfa.ts
'use server';

import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { generateMfaSecret, generateMfaUri, verifyMfaCode } from "@/lib/server/mfa-utils";

const prisma = new PrismaClient();

// --- 2.1. Start MFA Setup ---
export async function startMfaSetup() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { success: false, message: "User not authenticated." };
  }

  try {
    const newSecret = generateMfaSecret();
    const email = session.user.email;
    
    // Create the URI for the QR code
    const uri = generateMfaUri(email, newSecret);

    // Temporarily store the secret in the user record
    await prisma.user.update({
      where: { email },
      data: { mfaSecret: newSecret },
    });
    
    return { 
      success: true, 
      message: "MFA secret generated.", 
      uri: uri, 
      secret: newSecret 
    };
  } catch (error) {
    console.error("Error starting MFA setup:", error);
    return { success: false, message: "Failed to start MFA setup." };
  }
}

// --- 2.2. Complete MFA Setup (Verify Code) ---
export async function completeMfaSetup(code: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { success: false, message: "User not authenticated." };
  }

  try {
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { mfaSecret: true }
    });

    if (!user || !user.mfaSecret) {
        return { success: false, message: "MFA setup not initialized." };
    }

    const isValid = verifyMfaCode(user.mfaSecret, code);

    if (isValid) {
      // If code is valid, permanently enable MFA
      await prisma.user.update({
        where: { email: session.user.email },
        data: { isMfaEnabled: true },
      });
      return { success: true, message: "MFA successfully enabled!" };
    } else {
      // If code is invalid, inform the user but do not clear the secret yet
      return { success: false, message: "Invalid code. Please try again." };
    }
  } catch (error) {
    console.error("Error completing MFA setup:", error);
    return { success: false, message: "Failed to complete MFA setup." };
  }
}