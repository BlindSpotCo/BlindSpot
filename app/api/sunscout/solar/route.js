// app/api/sunscout/solar/route.js
// Ported from SunScout's app/api/solar/route.ts.
import { NextResponse } from 'next/server';
import {
  getSunTimes, buildPathData, getSolarPos, getEdge,
  calculateSolarRadiation, computeSolarAzimuth,
} from '@/lib/sunscout/solar';
import { timeZoneAt, tzOffsetFor, localDateAt } from '@/lib/tz';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  // Was `parseFloat(get('lat') || '51.505')` -- a London default carried
  // over from the SunScout port. An empty string is falsy, so `?lat=&lon=`
  // did not fail, it silently fell back to central London and returned a
  // complete, plausible-looking sun path: the map would animate the wrong
  // city's sun over an Indian block with nothing anywhere saying so. Every
  // other endpoint here 400s on unusable coordinates; this one now does
  // too, and the callers all pass real coordinates already.
  const lat      = parseFloat(searchParams.get('lat'));
  const lon      = parseFloat(searchParams.get('lon'));
  // ?tzOffset= is still accepted from old clients but ignored: the pin's
  // own time zone decides (lib/tz.js). It used to be a fixed IST 330 from
  // the report page, which is what put New Zealand's sunrise at 00:08.

  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 });
  }
  const simTimeP = searchParams.get('simTime') || null;
  const dateParam = searchParams.get('date');
  let dateStr;
  if (dateParam) {
    dateStr = dateParam;
  } else {
    dateStr = localDateAt(lat, lon);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const timeZone = timeZoneAt(lat, lon);
  const tzOffset = tzOffsetFor(lat, lon, dateStr);

  const sunTimes = getSunTimes(lat, lon, dateStr);
  const pathData = buildPathData(lat, lon, 250, sunTimes.riseDate, sunTimes.setDate);

  let simDate;
  if (simTimeP) {
    const [hh, mm] = simTimeP.split(':').map(Number);
    const [y, mo, d] = dateStr.split('-').map(Number);
    simDate = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0) - tzOffset * 60000);
  } else {
    simDate = new Date();
  }

  const simPos    = getSolarPos(lat, lon, 250, simDate);
  const riseAz    = computeSolarAzimuth(lat, lon, sunTimes.riseDate);
  const setAz     = computeSolarAzimuth(lat, lon, sunTimes.setDate);
  const riseEdge  = getEdge(lat, lon, riseAz, 250);
  const setEdge   = getEdge(lat, lon, setAz,  250);
  const radiation = calculateSolarRadiation(simPos.elevation);

  const year = parseInt(dateStr.slice(0, 4), 10);
  const seasonDates = {
    Summer: `${year}-06-21`,
    Autumn: `${year}-10-15`,
    Spring: `${year}-04-01`,
    Winter: `${year}-12-21`,
  };
  const seasonal = {};
  for (const [sid, sd] of Object.entries(seasonDates)) {
    const st = getSunTimes(lat, lon, sd);
    const pts = [];
    let c = new Date(st.riseDate.getTime());
    while (c <= st.setDate) {
      const p = getSolarPos(lat, lon, 250, c);
      pts.push([p.sunLat, p.sunLon]);
      c = new Date(c.getTime() + 20 * 60000);
    }
    seasonal[sid] = pts;
  }

  return NextResponse.json({
    // timeZone/tzOffset/date: the map iframe needs the pin's clock to turn
    // its own 'HH:MM' times back into real instants (Map3DShadow.js).
    sunTimes: {
      rise: sunTimes.rise, set: sunTimes.set, noon: sunTimes.noon,
      date: dateStr, timeZone, tzOffset, polar: sunTimes.polar,
    },
    pathData, simPos: {
      sunLat: simPos.sunLat, sunLon: simPos.sunLon,
      shadowLat: simPos.shadowLat, shadowLon: simPos.shadowLon,
      azimuth: simPos.azimuth, elevation: simPos.elevation,
    },
    riseEdge, setEdge, radiation, seasonal,
  });
}
