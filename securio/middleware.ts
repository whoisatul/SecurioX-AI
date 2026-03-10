// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { NextRequestWithAuth } from "next-auth/middleware";

// Define the critical paths
const LOGIN_PAGE = '/login';
const KEY_SETUP_PAGE = '/onboard-keys';
const MFA_SETUP_PAGE = '/mfa-setup';
const DASHBOARD_PAGE = '/dashboard';

// Define protected paths
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboard-keys",
    "/mfa-setup",
  ],
};

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    // Note: The token is guaranteed to exist here if the user passed the initial NextAuth check 
    const pathname = req.nextUrl.pathname;

    // Check Custom Onboarding Steps (use optional chaining on token)
    // NOTE: This relies on the custom fields added in NextAuth.js JWT callback
    const hasEncryptionKeys = (token as any)?.hasEncryptionKeys;
    const isMfaEnabled = (token as any)?.isMfaEnabled;

    // A. User is authenticated, but hasn't set up encryption keys (MUST DO)
    if (!hasEncryptionKeys && pathname !== KEY_SETUP_PAGE) {
      // Allow signout to prevent lock-in
      if (pathname.includes('/api/auth/signout')) return NextResponse.next();

      return NextResponse.redirect(new URL(KEY_SETUP_PAGE, req.url));
    }

    // B. User has keys but hasn't enabled MFA (ENFORCED)
    if (hasEncryptionKeys && !isMfaEnabled && pathname !== MFA_SETUP_PAGE) {
      if (pathname.includes('/api/auth/signout')) return NextResponse.next();
      return NextResponse.redirect(new URL(MFA_SETUP_PAGE, req.url));
    }

    // C. User is complete and tries to go back to a setup page
    if (hasEncryptionKeys && isMfaEnabled) {
      if (pathname === KEY_SETUP_PAGE || pathname === MFA_SETUP_PAGE) {
        return NextResponse.redirect(new URL(DASHBOARD_PAGE, req.url));
      }
    }

    // Continue to requested page if no redirect is needed
    return NextResponse.next();
  },
  {
    // Auth configuration: if authorized() returns false, redirect to pages.signIn
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: LOGIN_PAGE,
    },
  }
);