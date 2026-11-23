// lib/sunscout/solar.js
// Ported from SunScout's lib/solar.ts (TypeScript types stripped, logic
// unchanged) -- NOAA solar position algorithm, accurate to within ~1 minute
// for sunrise/sunset. Works at any latitude, either hemisphere. All times
// are handled in UTC internally; local display uses the pin's own time
// zone (lib/tz.js).

import { tzOffsetFor, tzOffsetAtInstant } from '../tz';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function julianCentury(jd) {
  return (jd - 2451545.0) / 36525.0;
}

function geomMeanLongSun(t) {
  return (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
}

function geomMeanAnomalySun(t) {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function eccentricityEarthOrbit(t) {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunEqOfCenter(t) {
  const m = geomMeanAnomalySun(t) * DEG2RAD;
  return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t))
       + Math.sin(2 * m) * (0.019993 - 0.000101 * t)
       + Math.sin(3 * m) * 0.000289;
}

function sunTrueLong(t) {
  return geomMeanLongSun(t) + sunEqOfCenter(t);
}

function sunApparentLong(t) {
  return sunTrueLong(t) - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * DEG2RAD);
}

function meanObliquityOfEcliptic(t) {
  return 23.0 + (26.0 + (21.448 - t * (46.8150 + t * (0.00059 - t * 0.001813))) / 60) / 60;
}

function obliquityCorrection(t) {
  return meanObliquityOfEcliptic(t) + 0.00256 * Math.cos((125.04 - 1934.136 * t) * DEG2RAD);
}

function sunDeclination(t) {
  return RAD2DEG * Math.asin(Math.sin(obliquityCorrection(t) * DEG2RAD) * Math.sin(sunApparentLong(t) * DEG2RAD));
}

function equationOfTime(t) {
  const eps = obliquityCorrection(t) * DEG2RAD;
  const l0  = geomMeanLongSun(t) * DEG2RAD;
  const e   = eccentricityEarthOrbit(t);
  const m   = geomMeanAnomalySun(t) * DEG2RAD;
  const y   = Math.tan(eps / 2) ** 2;
  const eot = y * Math.sin(2 * l0)
            - 2 * e * Math.sin(m)
            + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
            - 0.5 * y * y * Math.sin(4 * l0)
            - 1.25 * e * e * Math.sin(2 * m);
  return RAD2DEG * eot * 4;
}

export function computeSolarElevation(lat, lon, date) {
  const jd   = julianDay(date);
  const t    = julianCentury(jd);
  const eot  = equationOfTime(t);
  const decl = sunDeclination(t) * DEG2RAD;
  const latR = lat * DEG2RAD;

  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst    = utcMin + eot + 4 * lon;
  const ha     = (tst / 4 - 180) * DEG2RAD;

  const sinAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  return RAD2DEG * Math.asin(Math.max(-1, Math.min(1, sinAlt)));
}

export function computeSolarAzimuth(lat, lon, date) {
  const jd   = julianDay(date);
  const t    = julianCentury(jd);
  const eot  = equationOfTime(t);
  const decl = sunDeclination(t) * DEG2RAD;
  const latR = lat * DEG2RAD;

  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst    = utcMin + eot + 4 * lon;
  const ha     = (tst / 4 - 180) * DEG2RAD;

  const sinAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  const el     = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz = (Math.sin(decl) - Math.sin(latR) * Math.sin(el)) / (Math.cos(latR) * Math.cos(el));
  let az = RAD2DEG * Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 360 - az;
  return az;
}

// Sunrise, solar noon and sunset for a calendar date AT THE PIN, in the
// pin's own local clock (lib/tz.js) -- no caller-supplied offset any more.
// A 4th argument is still accepted from old callers and ignored: it used
// to be a hard-coded IST 330, which is what put New Zealand's sunrise at
// 00:08.
//
// Noon is found first (the day's highest sun), then sunrise is searched
// in the 12h before it and sunset in the 12h after it. That brackets the
// real events wherever the pin is, instead of assuming sunrise falls
// between local 00:00 and 14:00. -0.833 deg = the sun's upper edge on the
// horizon, with normal atmospheric refraction (the NOAA definition).
export function getSunTimes(lat, lon, dateStr) {
  const HORIZON = -0.833;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const tzDay = tzOffsetFor(lat, lon, dateStr);
  const localMidMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - tzDay * 60000;
  const el = (ms) => computeSolarElevation(lat, lon, new Date(ms));

  let noonMs = localMidMs, best = -Infinity;
  for (let m = 0; m <= 1440; m += 10) {
    const ms = localMidMs + m * 60000;
    const e = el(ms);
    if (e > best) { best = e; noonMs = ms; }
  }
  let lo = noonMs - 10 * 60000, hi = noonMs + 10 * 60000;
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = lo + (hi - lo) * 2 / 3;
    if (el(m1) < el(m2)) lo = m1; else hi = m2;
  }
  noonMs = (lo + hi) / 2;

  // Bisect between a (one side of the horizon) and b (the other side).
  const cross = (a, b) => {
    const aAbove = el(a) > HORIZON;
    for (let i = 0; i < 50; i++) {
      const mid = (a + b) / 2;
      if ((el(mid) > HORIZON) === aAbove) a = mid; else b = mid;
    }
    return (a + b) / 2;
  };

  const noonEl = el(noonMs);
  const midBefore = noonMs - 12 * 3600000, midAfter = noonMs + 12 * 3600000;
  let riseMs, setMs, polar = null;
  if (noonEl <= HORIZON) {
    polar = 'night';            // sun never comes up
    riseMs = setMs = noonMs;
  } else if (el(midBefore) > HORIZON && el(midAfter) > HORIZON) {
    polar = 'day';              // sun never goes down
    riseMs = midBefore; setMs = midAfter;
  } else {
    riseMs = el(midBefore) > HORIZON ? midBefore : cross(midBefore, noonMs);
    setMs  = el(midAfter)  > HORIZON ? midAfter  : cross(noonMs, midAfter);
  }

  const riseDate = new Date(riseMs);
  const setDate  = new Date(setMs);
  const noonDate = new Date(noonMs);

  const fmt = (dt) => {
    const local = new Date(dt.getTime() + tzOffsetAtInstant(lat, lon, dt) * 60000);
    return `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
  };

  return {
    rise: fmt(riseDate), set: fmt(setDate), noon: fmt(noonDate),
    riseDate, setDate, noonDate, tzOffset: tzDay, polar,
  };
}

export function getSolarPos(lat, lon, radiusMeters, date) {
  const az = computeSolarAzimuth(lat, lon, date);
  const el = computeSolarElevation(lat, lon, date);

  const sc     = Math.cos(Math.max(0, el) * DEG2RAD);
  const cosLat = Math.cos(lat * DEG2RAD);

  const sunLat    = lat + (radiusMeters * sc / 111111) * Math.cos(az * DEG2RAD);
  const sunLon    = lon + (radiusMeters * sc / (111111 * cosLat)) * Math.sin(az * DEG2RAD);
  const shadowLat = lat + (radiusMeters * 0.7 / 111111) * Math.cos((az + 180) * DEG2RAD);
  const shadowLon = lon + (radiusMeters * 0.7 / (111111 * cosLat)) * Math.sin((az + 180) * DEG2RAD);

  return { sunLat, sunLon, shadowLat, shadowLon, azimuth: az, elevation: el };
}

// Time labels are in the pin's local clock (lib/tz.js); a 6th argument
// from old callers is ignored.
export function buildPathData(lat, lon, radiusMeters, riseDate, setDate) {
  const tzOffsetMinutes = tzOffsetAtInstant(lat, lon, riseDate);
  const pts = [];
  let curr = new Date(riseDate.getTime() - 30 * 60000);
  const end = new Date(setDate.getTime() + 30 * 60000);
  while (curr <= end) {
    const pos  = getSolarPos(lat, lon, radiusMeters, curr);
    const local = new Date(curr.getTime() + tzOffsetMinutes * 60000);
    const timeStr = `${String(local.getUTCHours()).padStart(2,'0')}:${String(local.getUTCMinutes()).padStart(2,'0')}`;
    pts.push({
      lat: pos.sunLat, lon: pos.sunLon,
      shlat: pos.shadowLat, shlon: pos.shadowLon,
      time: timeStr,
      el: Math.round(pos.elevation * 100) / 100,
      az: Math.round(pos.azimuth * 100) / 100,
      iso: curr.toISOString(),
    });
    curr = new Date(curr.getTime() + 10 * 60000);
  }
  return pts;
}

export function getEdge(lat, lon, azDeg, radiusMeters) {
  const rad = azDeg * DEG2RAD;
  return [
    lat + (radiusMeters / 111111) * Math.cos(rad),
    lon + (radiusMeters / (111111 * Math.cos(lat * DEG2RAD))) * Math.sin(rad),
  ];
}

export function calculateSolarRadiation(elevationDeg) {
  if (elevationDeg <= 0) return 0;
  const elRad = elevationDeg * DEG2RAD;
  const airMass = 1 / (Math.sin(elRad) + 0.001);
  const transmission = Math.pow(0.7, Math.pow(airMass, 0.678));
  return Math.round(1367 * Math.sin(elRad) * transmission * 100) / 100;
}
