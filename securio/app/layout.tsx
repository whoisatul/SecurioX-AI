import './globals.css'; // Import the stylesheet
import AuthSessionProvider from '@/components/AuthSessionProvider'; 
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Securio - Hybrid Encrypted Cloud Storage',
  description: 'Secure your files with client-side hybrid cryptography.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}> 
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}

