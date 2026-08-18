import './globals.css';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';

const SITE_URL = 'https://blindspotco.net';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BlindSpot — See What Listings Don't Tell You",
    template: '%s | BlindSpot',
  },
  description:
    'Know the neighbourhood. See the sunlight. Property intelligence from Neighbourhood Score and Home Comfort Score — free, data-backed, no broker spin. Crime, air quality, schools, sunlight and shadow analysis for any flat before you buy or rent.',
  applicationName: 'BlindSpot',
  keywords: [
    'property intelligence',
    'neighbourhood score',
    'home comfort score',
    'apartment sunlight analysis',
    'flat shadow analysis',
    'buy a flat checklist',
    'neighbourhood safety score',
    'property research India',
  ],
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'BlindSpot',
    locale: 'en_IN',
    title: "BlindSpot — See What Listings Don't Tell You",
    description:
      'Neighbourhood Score and Home Comfort Score — data-backed property intelligence, before you sign anything.',
  },
  twitter: {
    card: 'summary_large_image',
    title: "BlindSpot — See What Listings Don't Tell You",
    description:
      'Neighbourhood Score and Home Comfort Score — data-backed property intelligence, before you sign anything.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'BlindSpot',
  url: SITE_URL,
  description:
    "See what listings don't tell you — Neighbourhood Score and Home Comfort Score property intelligence.",
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/property-score?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <Script
          id="ld-json-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

