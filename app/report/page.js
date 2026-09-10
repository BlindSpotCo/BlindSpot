// app/report/page.js
//
// The screen a picked address lands on. No chooser step in between: the hero
// search knows the address, so this page opens straight into both answers.
//
// Everything it needs arrives in the query string:
//   /report?lat=&lon=&pin_code=&address=
// pin_code is optional -- an address outside neighbourhood coverage still
// gets the flat's half, and the page says so rather than failing.

import { Suspense } from 'react';
import ReportScreen from '@/components/report/ReportScreen';

export const metadata = {
  // The root layout sets canonical:'/' and any route that doesn't override
  // it inherits that, so every /report?lat=..&lon=.. page was telling Google
  // it was a duplicate of the homepage. It is per-address and has nothing
  // useful to crawl without its params, so it opts out rather than claiming
  // to be somewhere else.
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  title: 'Your BlindSpot report',
  description: 'The neighbourhood, the flat, and one honest verdict for the two together.',
};

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="bsr-boot">Opening this address…</div>}>
      <ReportScreen />
    </Suspense>
  );
}
