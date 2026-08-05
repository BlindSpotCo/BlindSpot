// lib/sunscout/solarReport.js
// Ported from SunScout's lib/solarReport.ts (TS types stripped). Shared
// deterministic solar computation used by both LiveScore and the AI report.

import { getSunTimes, buildPathData, getSolarPos } from './solar';

export const MONTHS = [
  { name: 'January',   date: '2025-01-15' },
  { name: 'February',  date: '2025-02-15' },
  { name: 'March',     date: '2025-03-15' },
  { name: 'April',     date: '2025-04-15' },
  { name: 'May',       date: '2025-05-15' },
  { name: 'June',      date: '2025-06-21' },
  { name: 'July',      date: '2025-07-15' },
  { name: 'August',    date: '2025-08-15' },
  { name: 'September', date: '2025-09-15' },
  { name: 'October',   date: '2025-10-15' },
  { name: 'November',  date: '2025-11-15' },
  { name: 'December',  date: '2025-12-21' },
];

const SEASONAL_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'];
const REPORT_RADIUS_M = 250;

function simDateFor(dateStr, time, tzOffsetMinutes) {
  const [hh, mm] = time.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, 0) - tzOffsetMinutes * 60000);
}

function computeSimPos(lat, lon, dateStr, time, tzOffsetMinutes) {
  return getSolarPos(lat, lon, REPORT_RADIUS_M, simDateFor(dateStr, time, tzOffsetMinutes));
}

function computeDayData(lat, lon, dateStr, tzOffsetMinutes) {
  const sunTimes = getSunTimes(lat, lon, dateStr, tzOffsetMinutes);
  const pathData = buildPathData(lat, lon, REPORT_RADIUS_M, sunTimes.riseDate, sunTimes.setDate, tzOffsetMinutes);
  return { sunTimes, pathData };
}

function shadowLength(elevation, objectHeight = 10) {
  if (elevation <= 0) return 999;
  return Math.round(objectHeight / Math.tan(elevation * Math.PI / 180));
}

export function compassDir(azimuth) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(azimuth / 45) % 8];
}

const FACING_ANGLE = {
  'North': 0, 'North-East': 45, 'East': 90, 'South-East': 135,
  'South': 180, 'South-West': 225, 'West': 270, 'North-West': 315,
};

function clearanceElevationFor(floor) {
  const floorHeight = floor * 3;
  if (floorHeight < 9)  return Math.atan2(9 - floorHeight, 8)   * 180 / Math.PI;
  if (floorHeight < 24) return Math.max(0, Math.atan2(20 - floorHeight, 15) * 180 / Math.PI);
  if (floorHeight < 45) return Math.max(0, Math.atan2(40 - floorHeight, 25) * 180 / Math.PI);
  return 0;
}

function isVisibleToUnit(p, clearanceEl, targetAz) {
  if (p.el <= 0 || p.el < clearanceEl) return false;
  let diff = Math.abs(p.az - targetAz);
  if (diff > 180) diff = 360 - diff;
  return diff <= 90;
}

function usableHoursForUnit(pathData, floor, facing) {
  if (pathData.length < 2) return 0;
  const clearanceEl = clearanceElevationFor(floor);
  const targetAz = FACING_ANGLE[facing] ?? 180;

  let totalMs = 0;
  for (let i = 0; i < pathData.length - 1; i++) {
    const gapMs = new Date(pathData[i + 1].iso).getTime() - new Date(pathData[i].iso).getTime();
    if (isVisibleToUnit(pathData[i], clearanceEl, targetAz)) totalMs += gapMs;
  }
  return Math.round((totalMs / 3600000) * 10) / 10;
}

function peakWindow(pathData) {
  const high = pathData.filter(p => p.el > 35);
  if (!high.length) return 'no overhead sun';
  return `${high[0].time}–${high[high.length-1].time}`;
}

function floorClearanceTime(pathData, floor, facing) {
  const floorHeight = floor * 3;

  let clearanceElevation = 0;
  if (floorHeight < 9) {
    clearanceElevation = Math.atan2(9 - floorHeight, 8) * 180 / Math.PI;
  } else if (floorHeight < 24) {
    clearanceElevation = Math.max(0, Math.atan2(20 - floorHeight, 15) * 180 / Math.PI);
  } else if (floorHeight < 45) {
    clearanceElevation = Math.max(0, Math.atan2(40 - floorHeight, 25) * 180 / Math.PI);
  }

  const targetAz = FACING_ANGLE[facing] ?? 180;

  const validPoints = pathData.filter(p => {
    if (p.el <= 0) return false;
    let diff = Math.abs(p.az - targetAz);
    if (diff > 180) diff = 360 - diff;
    return diff <= 90 && p.el >= clearanceElevation;
  });

  if (!validPoints.length) return 'no direct sun this side';
  if (clearanceElevation <= 0) return `from ~${validPoints[0].time} (clear sightline)`;
  return `from ~${validPoints[0].time} (clears ${Math.round(clearanceElevation)}° obstruction — estimated, not measured)`;
}

export async function computeSolarSummary(lat, lon, floor, facing, tzOffset) {
  const monthlyRaw = MONTHS.map(m => {
    const { sunTimes, pathData } = computeDayData(lat, lon, m.date, tzOffset);
    const noonPos = computeSimPos(lat, lon, m.date, '12:00', tzOffset);
    return {
      sunTimes: { rise: sunTimes.rise, set: sunTimes.set, noon: sunTimes.noon },
      pathData,
      simPos: { elevation: noonPos.elevation, azimuth: noonPos.azimuth },
    };
  });

  const seasons = [
    { name: 'Summer Solstice',  date: '2025-06-21' },
    { name: 'Winter Solstice',  date: '2025-12-21' },
    { name: 'Spring Equinox',   date: '2025-03-20' },
    { name: 'Autumn Equinox',   date: '2025-09-23' },
  ];

  const seasonalDetail = seasons.map(s => {
    const slots = SEASONAL_SLOTS.map(t => computeSimPos(lat, lon, s.date, t, tzOffset));
    return { season: s.name, slots: slots.map((d, i) => ({
      time: SEASONAL_SLOTS[i],
      elevation: Math.round(d.elevation || 0),
      azimuth: Math.round(d.azimuth || 0),
      direction: compassDir(d.azimuth || 0),
      inSun: (d.elevation || 0) > 0,
      shadowLength: shadowLength(d.elevation || 0),
    }))};
  });

  const monthlySummary = MONTHS.map((m, i) => {
    const base = monthlyRaw[i];
    const pathData = base.pathData || [];
    return {
      month: m.name,
      sunrise: base.sunTimes?.rise || 'N/A',
      sunset: base.sunTimes?.set || 'N/A',
      noonElevation: Math.round(base.simPos?.elevation || 0),
      noonAzimuth: Math.round(base.simPos?.azimuth || 0),
      usableHours: usableHoursForUnit(pathData, floor, facing),
      peakWindow: peakWindow(pathData),
      floorClearance: floorClearanceTime(pathData, floor, facing),
    };
  });

  const avgUsable = monthlySummary.reduce((s, m) => s + m.usableHours, 0) / 12;
  const feasibility = avgUsable >= 5 ? 'Excellent' : avgUsable >= 3.5 ? 'Good' : avgUsable >= 2 ? 'Marginal' : 'Not Recommended';

  return {
    monthlySummary,
    seasonalDetail,
    solarFeasibility: {
      verdict: feasibility,
      avgUsableHours: Math.round(avgUsable * 10) / 10,
      bestMonths: [...monthlySummary].sort((a,b) => b.usableHours - a.usableHours).slice(0,3).map(m => m.month),
      worstMonths: [...monthlySummary].sort((a,b) => a.usableHours - b.usableHours).slice(0,3).map(m => m.month),
    },
  };
}
