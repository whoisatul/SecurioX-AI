import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { verifyMfaCode } from "./mfa-utils";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("CredentialsMissing");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("UserNotFound");
        }

        const valid = await compare(
          credentials.password,
          user.password
        );

        if (!valid) throw new Error("InvalidPassword");

        if (user.isMfaEnabled) {
          if (!credentials.mfaCode)
            throw new Error("MfaRequired");

          if (!user.mfaSecret)
            throw new Error("MfaConfigError");

          const ok = verifyMfaCode(
            user.mfaSecret,
            credentials.mfaCode
          );

          if (!ok) throw new Error("InvalidMfaCode");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isMfaEnabled: user.isMfaEnabled,
          hasEncryptionKeys:
            !!user.publicKey &&
            !!user.encryptedPrivateKey,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isMfaEnabled = (user as any).isMfaEnabled;
        token.hasEncryptionKeys = (user as any).hasEncryptionKeys;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: {
          isMfaEnabled: true,
          publicKey: true,
          encryptedPrivateKey: true,
        },
      });

      if (dbUser) {
        token.isMfaEnabled = dbUser.isMfaEnabled;
        token.hasEncryptionKeys =
          !!dbUser.publicKey &&
          !!dbUser.encryptedPrivateKey;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).isMfaEnabled =
          token.isMfaEnabled;
        (session.user as any).hasEncryptionKeys =
          token.hasEncryptionKeys;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  debug: process.env.NODE_ENV === "development",
};
