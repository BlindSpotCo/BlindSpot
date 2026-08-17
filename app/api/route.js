// app/api/av-localities/route.js
// Proxies AsliVastu's pincode-level neighbourhood scores, grouped by city,
// for the city → locality picker on the combined-score property page.
// AV's data is genuinely pincode-level (not GPS-level) — there's no single
// "locality name" field in their dataset, so pin_code IS the locality unit
// here. Server-to-server call (not client-side) so the AV base URL never
// needs to be exposed to the browser and there's no CORS concern.

import { NextResponse } from 'next/server';

const AV_BASE_URL = process.env.AV_BASE_URL || 'https://aslivastu.com';

export async function GET() {
  try {
    const res = await fetch(`${AV_BASE_URL}/api/all`, {
      // Revalidate hourly — this is a slow-moving dataset (government
      // records), no need to hit AV on every single page load.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Neighbourhood Score returned HTTP ${res.status}` }, { status: 502 });
    }
    const records = await res.json();

    const byCity = {};
    for (const r of records) {
      if (!byCity[r.city]) byCity[r.city] = [];
      byCity[r.city].push({
        pin_code: r.pin_code,
        nqi_composite: r.nqi_composite,
        grade: r.grade,
      });
    }
    // Sort each city's list by score, best first — makes the picker more
    // useful than an arbitrary pincode order.
    for (const city of Object.keys(byCity)) {
      byCity[city].sort((a, b) => b.nqi_composite - a.nqi_composite);
    }

    return NextResponse.json({ cities: byCity });
  } catch (err) {
    console.error('[av-localities] Failed to fetch AV data:', err?.message || err);
    return NextResponse.json({ error: 'Could not reach Neighbourhood Score' }, { status: 502 });
  }
}
