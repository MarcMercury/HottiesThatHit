import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Pacifico } from 'next/font/google';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AuthProvider } from '@/lib/auth-context';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Pacifico({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hotties That Hit — Every open court in LA. One screen.',
  description:
    'Find open tennis courts, players, and tee times across Los Angeles. Hot pink courts only.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hottiesthathit.com'),
  openGraph: {
    title: 'Hotties That Hit',
    description: 'Every open court in LA. One screen.',
    images: ['/logo.png'],
  },
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#ff1f8f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
