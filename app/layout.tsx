import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "A'erkt - Digital Menu",
  description: 'Explore our authentic Ethiopian cuisine menu',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: "A'erkt - Digital Menu",
    description: 'Explore our authentic Ethiopian cuisine menu',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "A'erkt - Digital Menu",
    description: 'Explore our authentic Ethiopian cuisine menu',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-restaurant-bg text-restaurant-text dark:bg-restaurant-bg-dark dark:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
