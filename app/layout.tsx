import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Aura Live | AI Voice Command Center',
  description: 'High-end sci-fi command center AI voice companion featuring real-time streaming, Aura avatar, memory learning, and interactive live chat.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
