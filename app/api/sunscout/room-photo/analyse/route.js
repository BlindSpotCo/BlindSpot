// app/api/sunscout/room-photo/analyse/route.js
//
// Room-photo window analysis: given one photo of a room and which way the
// camera was facing when it was taken, finds the windows in the photo and
// labels each one with REAL sun/heat data for that window's own compass
// direction -- not the whole flat's stated facing (from the floor/facing
// gate), since a room's window can sit on a different wall than the unit's
// official facing.
//
// Gemini's only job here is spotting where the windows are in the frame
// and roughly which fifth of the frame they sit in -- a vision task it's
// actually reasonable at. Every NUMBER attached to a window (sun hours,
// best/worst months, heat) comes from computeSolarSummary, the same
// deterministic solar-geometry code the rest of the app already uses for
// the main report, not from the model guessing. buildingVisible/
// roadVisible ARE the model's own visual read of that window -- nothing in
// this codebase cross-checks them against real map data (that would need
// a geocoded building/road layer keyed to camera bearing, which doesn't
// exist yet) -- so the frontend renders them as an impression, not a
// measured fact.

import { NextResponse } from 'next/server';
import { computeSolarSummary, compassDir } from '@/lib/sunscout/solarReport';

export const maxDuration = 45;

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Where a window sits in the frame -> assumed angular offset from the
// camera's own centre bearing. A real lens' field of view varies by phone,
// so this is a deliberately coarse five-bucket estimate (roughly an 80-90
// degree FOV split into fifths) rather than false precision computed from
// a bounding box's exact pixel centre -- the compass direction this rounds
// to is usually right even when the exact degree isn't.
const BUCKET_OFFSET = { 'far-left': -36, left: -18, center: 0, right: 18, 'far-right': 36 };

const SCHEMA = {
  type: 'object',
  properties: {
    windows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bbox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
          position: { type: 'string', enum: ['far-left', 'left', 'center', 'right', 'far-right'] },
          buildingVisible: { type: 'boolean' },
          roadVisible: { type: 'boolean' },
        },
        required: ['bbox', 'position'],
      },
    },
  },
  required: ['windows'],
};

const PROMPT = `You are looking at one photograph of a room. Find every window visible in the photo (up to 4 -- if there are more, return only the 4 largest/clearest). For each window return:
- "bbox": [x0, y0, x1, y1], normalized 0 to 1 (0,0 is the top-left corner of the image, 1,1 is the bottom-right), drawn tightly around the window's visible frame.
- "position": which fifth of the photo's width the window's centre falls in -- "far-left", "left", "center", "right", or "far-right".
- "buildingVisible": true only if another building or wall is clearly visible through that window, close enough that it would matter for privacy.
- "roadVisible": true only if a street, road, or vehicles are visible through that window.

If there are no windows anywhere in the photo, return an empty array for "windows". Do not invent a window that is not actually visible in the image. Do not describe anything else about the room.`;

function geminiCaller({ budgetMs = 30_000, maxOutputTokens = 2048, generationConfig = null } = {}) {
  const startedAt = Date.now();
  const left = () => budgetMs - (Date.now() - startedAt);
  const call = async (msgContents) => {
    for (const model of GEMINI_MODELS) {
      const remaining = left();
      if (remaining < 6_000) return null;
      let res;
      try {
        res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: msgContents,
            generationConfig: { maxOutputTokens, temperature: 0.15, ...(generationConfig || {}) },
          }),
          signal: AbortSignal.timeout(Math.min(remaining, 30_000)),
        });
      } catch (err) {
        console.error(`[room-photo] Gemini network error (${model}):`, err?.message || err);
        continue;
      }
      if (res.ok) return res.json();
      const errText = await res.text();
      console.error(`[room-photo] Gemini request failed (${model}):`, res.status, errText.slice(0, 300));
    }
    return null;
  };
  return { call };
}

export async function POST(req) {
  const { image, cameraBearing, lat, lon, floor, tzOffset } = await req.json();

  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'no-image', windows: [] }, { status: 400 });
  }
  const bearing = Number(cameraBearing);
  const latN = Number(lat), lonN = Number(lon), floorN = Number(floor) || 0;
  if (!Number.isFinite(bearing) || !Number.isFinite(latN) || !Number.isFinite(lonN)) {
    return NextResponse.json({ error: 'missing-fields', windows: [] }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'ai-unavailable', windows: [] }, { status: 200 });
  }

  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  const part = { inlineData: { mimeType: match ? match[1] : 'image/jpeg', data: match ? match[2] : image } };

  const { call } = geminiCaller({
    budgetMs: 30_000,
    maxOutputTokens: 2048,
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
  });

  let detected = [];
  try {
    const d = await call([{ role: 'user', parts: [{ text: PROMPT }, part] }]);
    const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.windows)) detected = parsed.windows;
  } catch (err) {
    console.error('[room-photo] detection failed:', err?.message || err);
    return NextResponse.json({ error: 'detection-failed', windows: [] }, { status: 200 });
  }

  // One computeSolarSummary call per DISTINCT direction, not per window --
  // two windows that round to the same compass point get the same
  // numbers, no reason to recompute them.
  const summaryCache = new Map();
  const summaryFor = async (direction) => {
    if (summaryCache.has(direction)) return summaryCache.get(direction);
    const s = await computeSolarSummary(latN, lonN, floorN, direction, Number.isFinite(Number(tzOffset)) ? Number(tzOffset) : 330);
    summaryCache.set(direction, s);
    return s;
  };

  const HOT_MONTHS = new Set(['April', 'May', 'June']);
  const windows = [];

  for (const w of detected.slice(0, 4)) {
    const bbox = Array.isArray(w?.bbox) && w.bbox.length === 4
      ? w.bbox.map((n) => Math.max(0, Math.min(1, Number(n) || 0)))
      : null;
    if (!bbox) continue;

    const offset = BUCKET_OFFSET[w.position] ?? 0;
    const direction = compassDir((bearing + offset + 360) % 360);
    const summary = await summaryFor(direction);
    const feas = summary?.solarFeasibility;

    const sunLabel = !feas
      ? 'Sun data unavailable'
      : feas.verdict === 'Not Recommended'
        ? 'Little direct sun most of the year'
        : `Gets sun · best ${feas.bestMonths[0]}–${feas.bestMonths[feas.bestMonths.length - 1]}`;

    const heatLabel = !feas
      ? null
      : feas.bestMonths?.some((m) => HOT_MONTHS.has(m))
        ? 'Can run hot, Apr–Jun afternoons'
        : (feas.verdict === 'Excellent' || feas.verdict === 'Good') ? 'Warm, not harsh' : null;

    // The fuller readout (verdict word, real average hours, peak time-of-
    // day for the single best month, worst months) was already sitting in
    // `feas`/`summary.monthlySummary` -- computeSolarSummary always
    // computes all of it, the route just wasn't returning it. Nothing
    // here is a new estimate, it's the same numbers sunLabel/heatLabel
    // above are already built from.
    const bestMonth = feas
      ? [...summary.monthlySummary].sort((a, b) => b.usableHours - a.usableHours)[0]
      : null;

    windows.push({
      bbox,
      direction,
      sunLabel,
      heatLabel,
      buildingVisible: Boolean(w.buildingVisible),
      roadVisible: Boolean(w.roadVisible),
      verdict: feas?.verdict ?? null,
      avgUsableHours: feas?.avgUsableHours ?? null,
      bestMonths: feas?.bestMonths ?? [],
      worstMonths: feas?.worstMonths ?? [],
      peakWindow: bestMonth?.peakWindow ?? null,
    });
  }

  // Cross-ventilation is pure geometry: two-plus windows whose compass
  // directions are meaningfully apart (not the same wall, not adjacent
  // corners of one wall) means air can plausibly move through the room.
  // Nothing here is real wind data, so this only ever claims "possible",
  // never a direction or a strength.
  let crossVentilation = null;
  if (windows.length >= 2) {
    const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirs = [...new Set(windows.map((w) => w.direction))];
    let maxGap = 0;
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const a = ORDER.indexOf(dirs[i]), b = ORDER.indexOf(dirs[j]);
        let gap = Math.abs(a - b);
        if (gap > 4) gap = 8 - gap;
        maxGap = Math.max(maxGap, gap);
      }
    }
    crossVentilation = maxGap >= 2; // >= 90 degrees apart
  }

  return NextResponse.json({ windows, crossVentilation });
}
