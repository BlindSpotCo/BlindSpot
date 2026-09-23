// app/report/page.js
//
// The screen a picked address lands on. No chooser step in between: the hero
// search knows the address, so this page opens straight into both answers.
//
// Everything it needs arrives in the query string:
//   /report?lat=&lon=&pin_code=&address=
// pin_code is optional -- an address outside neighbourhood coverage still
// gets the flat's half, and the page says so rather than failing.


export const metadata = {
  // The root layout sets canonical:'/' and any route that doesn't override
  // it inherits that, so every /report?lat=..&lon=.. page was telling Google
  // it was a duplicate of the homepage. It is per-address and has nothing
  // useful to crawl without its params, so it opts out rather than claiming
  // to be somewhere else.
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  title: 'Your BlindSpot report',
  description: 'The neighbourhood, the flat, and one clear summary of the two together.',
};

// Renders nothing: the screen itself lives in app/report/layout.js so that
// one instance survives navigation between /report/locate and /report
// (a report generating on the map keeps going on the verdict). This file
// exists for the URL of the verdict and its metadata.
export default function Page() {
  return null;
}
