import './globals.css';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';

const SITE_URL = 'https://blindspotco.net';

// Next's App Router splits viewport out of `metadata` (a `viewport` key
// inside metadata is ignored with a build warning as of Next 14+) -- this
// was missing entirely, so the page was relying on the browser's own
// default rather than declaring one. themeColor matches the site's own
// paper background (--paper in globals.css) so a mobile browser's chrome
// (and Google's mobile search result frame) tints to match instead of
// defaulting to plain white/black.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFDF8',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  // Google Search Console ownership verification -- REQUIRED to submit
  // the sitemap directly and see indexing/coverage status, rather than
  // waiting for Google to discover the site organically (which can take
  // weeks). Get this from search.google.com/search-console -> Add
  // property -> blindspotco.net -> "HTML tag" verification method (NOT
  // the file-upload or DNS methods) -- it gives you a <meta> tag with a
  // content="..." value; set that value as GOOGLE_SITE_VERIFICATION in
  // Vercel's project environment variables (no NEXT_PUBLIC_ prefix
  // needed, this only ever renders server-side) and redeploy. Renders no
  // tag at all until that env var is set, rather than shipping a broken
  // "content=undefined" meta tag.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  title: {
    default: "BlindSpot - See What Listings Don't Tell You",
    template: '%s | BlindSpot',
  },
  description:
    'Know the neighbourhood. See the sunlight. Property intelligence from Neighbourhood Score and Home Comfort Score, free, data-backed, no broker spin. Crime, air quality, schools, sunlight and shadow analysis for any flat before you buy or rent.',
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
    title: "BlindSpot - See What Listings Don't Tell You",
    description:
      'Neighbourhood Score and Home Comfort Score, data-backed property intelligence, before you sign anything.',
  },
  twitter: {
    card: 'summary_large_image',
    title: "BlindSpot - See What Listings Don't Tell You",
    description:
      'Neighbourhood Score and Home Comfort Score, data-backed property intelligence, before you sign anything.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

// Was a WebSite schema with a SearchAction pointing at "/?q={search_term_string}"
// -- but the homepage never reads a `q` query param (grepped app/page.js,
// no searchParams/useSearchParams handling one at all), so that action
// described a feature that does not exist. Structured data is a claim
// Google can check against the actual page; an action that goes nowhere
// is exactly the kind of thing that gets flagged as invalid in Search
// Console, and worse, IS occasionally honored (a "sitelinks search box"
// in results) -- which would send someone straight to a dead search.
// Dropped it rather than leaving false structured data live. Added an
// Organization entity instead, since that one's real and is what backs
// the logo/name showing up correctly in a Google knowledge panel or
// rich result -- every field below is something the repo actually has
// (mark.png, the real site description), nothing invented to fill the
// schema out.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BlindSpot',
    url: SITE_URL,
    description:
      "See what listings don't tell you, Neighbourhood Score and Home Comfort Score property intelligence.",
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BlindSpot',
    url: SITE_URL,
    logo: `${SITE_URL}/mark.png`,
    description:
      'Property intelligence combining a Neighbourhood Score (crime, air quality, schools, infrastructure) and a Home Comfort Score (sunlight, shadow, heat, view, privacy) for a specific flat.',
  },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Playfair+Display:ital,wght@1,600&display=swap"
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

