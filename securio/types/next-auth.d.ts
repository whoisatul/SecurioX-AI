// types/next-auth.d.ts
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      isMfaEnabled?: boolean
      hasEncryptionKeys?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    isMfaEnabled?: boolean
    hasEncryptionKeys?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isMfaEnabled?: boolean
    hasEncryptionKeys?: boolean
  }
}
