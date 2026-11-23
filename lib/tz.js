// lib/tz.js
// The pin's own time zone, worked out from its coordinates.
//
// Every sun time used to be computed in IST (a fixed +330 minutes), so
// anywhere outside India showed the wrong clock times -- Dubai 1.5h off,
// New Zealand's sunrise came out as 00:08, New York had sunset before
// sunrise. The sun maths was never the problem, only the clock it was
// read on. Now the pin decides: lat/lon -> IANA zone (tz-lookup) -> that
// zone's UTC offset on the given date (Intl), so daylight saving is
// handled too (London, Sydney, New York, Auckland...).
//
// Server-side only (tz-lookup's boundary data is ~70KB); the browser gets
// the zone name from /api/sunscout/solar and uses Intl directly.
import tzlookup from '@photostructure/tz-lookup';

export function timeZoneAt(lat, lon) {
  try {
    return tzlookup(lat, lon);
  } catch {
    return null;
  }
}

const fmtCache = new Map();
function formatterFor(timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    fmtCache.set(timeZone, f);
  }
  return f;
}

// Minutes east of UTC in `timeZone` at the instant `ms` (epoch millis).
export function offsetMinutesAt(timeZone, ms) {
  try {
    const parts = {};
    for (const p of formatterFor(timeZone).formatToParts(new Date(ms))) parts[p.type] = p.value;
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

// Offset for a local calendar date ('YYYY-MM-DD') at the pin. Read at
// midday UTC of that date, well clear of the ~2am local DST switch for
// every zone that has one. Falls back to the solar offset (15 deg of
// longitude per hour) if the lookup fails, which is the right answer at
// sea and never worse than the old fixed IST.
export function tzOffsetFor(lat, lon, dateStr) {
  const zone = timeZoneAt(lat, lon);
  if (zone) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const ms = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? Date.UTC(y, m - 1, d, 12, 0, 0)
      : Date.now();
    const off = offsetMinutesAt(zone, ms);
    if (off != null) return off;
  }
  return Math.round(lon / 15) * 60;
}

// Offset at a given instant (for a Date already in UTC).
export function tzOffsetAtInstant(lat, lon, date) {
  const zone = timeZoneAt(lat, lon);
  const off = zone ? offsetMinutesAt(zone, date.getTime()) : null;
  return off != null ? off : Math.round(lon / 15) * 60;
}

// Today's date at the pin, 'YYYY-MM-DD'.
export function localDateAt(lat, lon, now = new Date()) {
  const off = tzOffsetAtInstant(lat, lon, now);
  return new Date(now.getTime() + off * 60000).toISOString().slice(0, 10);
}
