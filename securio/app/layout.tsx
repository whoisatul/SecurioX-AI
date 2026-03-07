import "./globals.css";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { Geist } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Securio - Hybrid Encrypted Cloud Storage",
  description: "Secure your files with client-side hybrid cryptography. Military-grade AES-256 + RSA-2048 encryption, zero-knowledge architecture.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.className}>
      <body>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
