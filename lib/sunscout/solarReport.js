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
