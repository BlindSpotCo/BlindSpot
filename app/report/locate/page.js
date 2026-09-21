// app/report/locate/page.js
//
// Step one of two: the 3D block with the day running over it, where the
// pin gets placed on the actual building.
//
// It is its own route rather than a flag on /report so the browser's own
// Back button does the obvious thing -- back from the verdict returns to
// the map you placed the pin on, instead of skipping the whole flow and
// landing on the homepage. Same query string as /report, plus ?pin=1 once
// a tap has moved the pin off the geocoded centre.


export const metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  title: 'Place your pin',
  description: 'Put the pin on your building before the report is scored.',
};

// Renders nothing: the screen itself lives in app/report/layout.js so that
// one instance survives navigation between /report/locate and /report
// (a report generating on the map keeps going on the verdict). This file
// exists for the URL of the map step and its metadata.
export default function Page() {
  return null;
}
