// app/report/layout.js
//
// Hosts the report screen for both routes under it -- /report/locate (the
// map step) and /report (the verdict). Rendering it here rather than in
// each page is what keeps a single instance alive across navigation
// between them; see components/report/ReportShell.js for why that
// matters. The pages themselves render nothing and exist for their URLs
// and metadata.

import { Suspense } from 'react';

// The report and map screens are app-like: pinching should zoom the 3D map,
// not the page (a page zoom pushed the top bar off screen), and tapping a
// field shouldn't zoom the page in either.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFFDF8',
};
import ReportShell from '@/components/report/ReportShell';

export default function ReportLayout({ children }) {
  return (
    <>
      <Suspense fallback={<div className="bsr-boot">Opening this address…</div>}>
        <ReportShell />
      </Suspense>
      {children}
    </>
  );
}
