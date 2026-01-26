import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { compare } from 'bcryptjs';
import { verifyMfaCode } from '@/lib/mfa-utils';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials) {
        console.log("------------------------------------------");
        console.log("Authorize function called at:", new Date().toISOString());
        console.log("Attempting login for email:", credentials?.email);

        // 1. Basic Validation
        if (!credentials?.email || !credentials?.password) {
          console.error("⛔ Authorize failed: Missing email or password.");
          throw new Error("CredentialsMissing");
        }

        // 2. Find User
        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
        } catch (dbError) {
          console.error("🔥 Database error finding user:", dbError);
          throw new Error("ServerError");
        }

        if (!user || !user.password) {
          console.log(`⛔ Authorize failed: User ${credentials.email} not found.`);
          throw new Error("UserNotFound");
        }
        console.log(`✅ User found: ${user.email} (ID: ${user.id})`);

        // 3. Verify Password
        let passwordIsValid = false;
        try {
            passwordIsValid = await compare(credentials.password, user.password);
        } catch (bcryptError) {
            console.error("🔥 Error during password comparison:", bcryptError);
            throw new Error("ServerError");
        }

        if (!passwordIsValid) {
          console.log(`⛔ Authorize failed: Invalid password for ${credentials.email}.`);
          throw new Error("InvalidPassword");
        }
        console.log("✅ Password validation successful.");

        // --- MFA Check ---
        if (user.isMfaEnabled) {
          console.log(`ℹ️ MFA is enabled for ${credentials.email}. Checking code...`);
          const mfaCode = credentials.mfaCode;

          if (!mfaCode) {
             console.log(`⛔ Authorize failed: MFA code required but not provided.`);
             throw new Error("MfaRequired");
          }

          if (user.mfaSecret) {
              let mfaIsValid = false;
              try {
                  mfaIsValid = verifyMfaCode(user.mfaSecret, mfaCode);
              } catch (mfaError) {
                  console.error("🔥 Error during MFA code verification:", mfaError);
                  throw new Error("ServerError");
              }

              if (!mfaIsValid) {
                console.log(`⛔ Authorize failed: MFA validation failed for ${credentials.email}.`);
                throw new Error("InvalidMfaCode");
              }
              console.log("✅ MFA validation successful.");
          } else {
              console.error(`🚨 Authorize Error: MFA is enabled for ${credentials.email} but mfaSecret is null.`);
              throw new Error("ConfigurationError");
          }
        } else {
            console.log(`ℹ️ MFA is not enabled for ${credentials.email}. Skipping MFA check.`);
        }
        // --- End MFA Check ---

        // 6. Success
        console.log(`✅ Authorize successful for ${credentials.email}. Returning user object.`);
        // Return all the data we need for the token
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            isMfaEnabled: user.isMfaEnabled,
            // We calculate this here so the token gets it on FIRST login
            hasEncryptionKeys: !!user.publicKey && !!user.encryptedPrivateKey,
        };
      }, // End authorize
    }), // End CredentialsProvider
  ], // End providers
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // --- THIS IS THE FIX (PART 1) ---
    async jwt({ token, user, trigger, session }) {
      // On initial sign in, 'user' object is passed.
      if (user) {
        console.log("JWT: Initial login, setting token from user object");
        token.id = user.id;
        token.isMfaEnabled = (user as any).isMfaEnabled;
        token.hasEncryptionKeys = (user as any).hasEncryptionKeys;
      }
      
      // This is the key: We re-fetch the user from the DB on *every* request
      // to ensure the token is NEVER stale.
      // This is not performant for production, but is GUARANTEED to work for your viva.
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isMfaEnabled: true, publicKey: true, encryptedPrivateKey: true }
        });

        if (dbUser) {
          console.log("JWT: Re-fetching user data to ensure session is fresh.");
          // Update the token with the LATEST data from the database
          token.isMfaEnabled = dbUser.isMfaEnabled;
          token.hasEncryptionKeys = !!dbUser.publicKey && !!dbUser.encryptedPrivateKey;
        }
      } catch (error) {
        console.error("JWT Error: Failed to re-fetch user data:", error);
      }
      
      return token;
    },
    // --- THIS IS THE FIX (PART 2) ---
    async session({ session, token }) {
      // This function copies the data from the (now fresh) token into the session
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).isMfaEnabled = token.isMfaEnabled;
        (session.user as any).hasEncryptionKeys = token.hasEncryptionKeys;
      }
      console.log("SESSION: Returning session with fresh data:", session);
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
