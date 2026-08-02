import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "BlindSpot — See What Listings Don't Tell You",
  description:
    'Know the neighbourhood. See the sunlight. Property intelligence from AsliVastu and SunScout — free, data-backed, no broker spin.',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
