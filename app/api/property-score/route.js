// app/api/property-score/route.js
// Combines AsliVastu's neighbourhood score (read from BlindSpot's own local
// copy of the data) with the native Home Comfort Score (computed by
// BlindSpot's own /api/sunscout/score, no external call) into one verdict.

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getPersona, recomputeAreaScore, gradeFor } from '@/lib/personas';

const DEFAULT_WEIGHT_AREA = 0.5;
const DEFAULT_WEIGHT_UNIT = 0.5;

function quadrant(areaScore, unitScore) {
  const areaGood = areaScore >= 60;
  const unitGood = unitScore >= 60;
  if (areaGood && unitGood) return { label: 'Prime Pick', detail: 'Strong neighbourhood, strong unit — the combination buyers actually want.' };
  if (!areaGood && unitGood) return { label: 'Hidden Gem', detail: 'The unit itself is genuinely good, but the surrounding area has real weaknesses worth understanding before you commit.' };
  if (areaGood && !unitGood) return { label: 'Location Play', detail: 'Strong area, but this specific unit has real drawbacks (sun, shade, view, privacy, or airflow) — worth comparing other floors/facings in the same building.' };
  return { label: 'Reconsider', detail: 'Both the area and this specific unit score below average — worth a closer look before deciding.' };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const pinCode = searchParams.get('pin_code');
  const lat = parseFloat(searchParams.get('lat'));
  const lon = parseFloat(searchParams.get('lon'));
  const floor = searchParams.get('floor') || '5';
  const facing = searchParams.get('facing') || 'South';
  const tzOffset = searchParams.get('tzOffset') || '330';

  const weightArea = parseFloat(searchParams.get('weightArea')) || DEFAULT_WEIGHT_AREA;
  const weightUnit = parseFloat(searchParams.get('weightUnit')) || DEFAULT_WEIGHT_UNIT;
  const totalWeight = weightArea + weightUnit || 1;
  const persona = getPersona(searchParams.get('persona'));

  if (!pinCode) {
    return NextResponse.json({ error: 'pin_code is required' }, { status: 400 });
  }
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: 'lat/lon are required' }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
    const avRecords = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const avRecord = avRecords.find(r => r.pin_code === pinCode);
    if (!avRecord) {
      return NextResponse.json({ error: `No AsliVastu data for pincode ${pinCode}` }, { status: 404 });
    }

    const { PIN_META } = await import('@/lib/aslivastu/pinMeta');
    const meta = PIN_META[pinCode];

    const scoreUrl = new URL('/api/sunscout/score', req.url);
    scoreUrl.searchParams.set('lat', lat);
    scoreUrl.searchParams.set('lon', lon);
    scoreUrl.searchParams.set('floor', floor);
    scoreUrl.searchParams.set('facing', facing);
    scoreUrl.searchParams.set('tzOffset', tzOffset);
    const ssRes = await fetch(scoreUrl.toString());
    if (!ssRes.ok) {
      return NextResponse.json({ error: `Home Comfort Score computation returned HTTP ${ssRes.status}` }, { status: 502 });
    }
    const ssResult = await ssRes.json();

    const areaScore = persona
      ? (recomputeAreaScore(avRecord.scores, persona.avWeights) ?? avRecord.nqi_composite)
      : avRecord.nqi_composite;
    const areaGrade = persona ? gradeFor(areaScore) : avRecord.grade;
    const unitScore = ssResult.liveScore;

    const weighted = (areaScore * weightArea + unitScore * weightUnit) / totalWeight;
    const combinedScore = Math.round(weighted);
    const verdict = quadrant(areaScore, unitScore);

    return NextResponse.json({
      combinedScore,
      verdict,
      persona: persona ? { id: persona.id, label: persona.label } : null,
      area: {
        source: 'AsliVastu',
        pinCode: avRecord.pin_code,
        name: meta?.name || avRecord.pin_code,
        city: avRecord.city,
        score: areaScore,
        grade: areaGrade,
        weight: Math.round((weightArea / totalWeight) * 100),
        factors: avRecord.scores,
      },
      unit: {
        source: 'Home Comfort Score',
        floor: ssResult.unit.floor,
        facing: ssResult.unit.facing,
        score: unitScore,
        grade: ssResult.grade,
        weight: Math.round((weightUnit / totalWeight) * 100),
        subScores: ssResult.subScores,
      },
      formula: `(${areaScore} × ${Math.round((weightArea/totalWeight)*100)}%) + (${unitScore} × ${Math.round((weightUnit/totalWeight)*100)}%) = ${combinedScore}`,
      dataNotes: [
        'Area score is the same for every unit in this pincode — only the unit score changes with floor/facing.',
        ...(persona ? [`Neighbourhood score re-weighted for ${persona.label} priorities — not AsliVastu's default weighting.`] : []),
        ...(ssResult.dataNotes || []),
      ],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[property-score] Failed to combine scores:', err?.message || err);
    return NextResponse.json({ error: 'Could not compute combined score' }, { status: 502 });
  }
}
