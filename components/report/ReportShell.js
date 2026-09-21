'use client';
// components/report/ReportShell.js
//
// The one ReportScreen both /report/locate and /report render, hosted by
// app/report/layout.js. A layout persists across navigation between its
// child routes, so this component -- and everything it holds -- stays
// mounted when someone goes from the map to the verdict and back:
//
//   - the Map3DShadow iframe, so the 3D scene never reloads;
//   - a sun report that is still generating, which is photographing that
//     same map and would otherwise be torn down mid-capture;
//   - the scores already fetched, the pin, the floor and facing.
//
// As two separate pages, each route built its own ReportScreen, and
// moving between them discarded the other one -- including any report in
// progress. The URL still decides which screen shows, so Back and Forward
// behave exactly as before.

import { usePathname } from 'next/navigation';
import ReportScreen from '@/components/report/ReportScreen';

export default function ReportShell() {
  const pathname = usePathname() || '';
  const view = pathname.endsWith('/locate') ? 'map' : 'verdict';
  return <ReportScreen view={view} />;
}
