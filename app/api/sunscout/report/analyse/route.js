// app/api/sunscout/report/analyse/route.js
// Ported from SunScout's app/api/report/analyse/route.ts. Sends real map
// screenshots to Gemini Vision for shadow analysis, grounded in a
// deterministic solar-geometry summary. Needs BlindSpot's OWN
// GEMINI_API_KEY env var -- this does not call out to sun-scout.com at all.

import { NextResponse } from 'next/server';
import { computeSolarSummary } from '@/lib/sunscout/solarReport';
import { checkBuildingHeights } from '@/lib/sunscout/buildingHeights';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export async function POST(req) {
  const { screenshots, lat, lon, address, floor, facing, tzOffset } = await req.json();

  if (!screenshots || screenshots.length === 0) {
    return NextResponse.json({ analysis: 'No screenshots provided.' }, { status: 400 });
  }

  const ALLOWED_FACINGS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];
  const safeFacingInput = ALLOWED_FACINGS.includes(facing) ? facing : 'South';
  const safeAddressInput = typeof address === 'string' ? address.slice(0, 200) : '';

  const latN = parseFloat(lat), lonN = parseFloat(lon), floorN = parseInt(floor);
  const tz = tzOffset ?? 330;

  let solarSummary = null;
  let groundTruthText = '';
  try {
    solarSummary = await computeSolarSummary(latN, lonN, floorN, safeFacingInput, tz);
    groundTruthText = `
GROUND TRUTH (computed from precise solar geometry — treat every number below as fact, do NOT re-derive or override it from the images):
${solarSummary.monthlySummary.map((m) =>
  `${m.month}: Rise ${m.sunrise}, Set ${m.sunset}, Noon elevation ${m.noonElevation}°, Usable sun ${m.usableHours}h, Peak ${m.peakWindow}, Floor ${floorN} ${safeFacingInput}-facing gets sun ${m.floorClearance}`
).join('\n')}
Overall feasibility: ${solarSummary.solarFeasibility.verdict} (avg ${solarSummary.solarFeasibility.avgUsableHours}h/day usable)
Best months: ${solarSummary.solarFeasibility.bestMonths.join(', ')} · Worst months: ${solarSummary.solarFeasibility.worstMonths.join(', ')}
Note: floor clearance is an estimate based on typical urban obstruction heights, not a measurement of this property's actual neighboring buildings. "Peak Window" reflects sky-wide overhead sun timing, not this specific facing direction.`;
  } catch (err) {
    console.error('Failed to compute ground-truth solar summary:', err);
    groundTruthText = '\n(Ground-truth solar computation unavailable — rely more cautiously on visual inspection and say so explicitly.)';
  }

  const buildingHeightNote = await checkBuildingHeights(latN, lonN).catch(() => null);
  const reportSummary = solarSummary ? { ...solarSummary, buildingHeightNote } : null;

  const prompt = `You are a solar intelligence analyst helping a home buyer in India.

Property: ${safeAddressInput} (${latN.toFixed(4)}°N, ${lonN.toFixed(4)}°E)
Unit: Floor ${floorN} (≈${floorN * 3}m height), ${safeFacingInput}-facing
${groundTruthText}

You also have ${screenshots.length} screenshots of the actual 3D map at this location. The orange circle/dot marks the exact property location; darker areas are rendered shadows from OpenStreetMap building data. Use these images ONLY for narrative color and visual confirmation (e.g. "as the images show, a taller block sits to the southeast") — do NOT estimate hours of sun, shadow duration, or building heights from the images; use the ground-truth numbers above for all figures. If a screenshot looks blank, black, or unreadable, say so explicitly rather than guessing what it would show.

Be thorough and specific, not brief. This report is a defensible artifact a buyer will rely on — do not compress away detail to save space.

FORMATTING RULES (follow exactly, every time, regardless of location):
- Start each section heading on its own line as "1. TITLE" (plain text, no ** bold markers, no # markdown).
- Use plain "- " for bullet points, not "*".
- Do not use markdown bold (**) anywhere except to emphasize a single key figure inline.
- Always include all 4 numbered sections below, in order, even if a section is short for this location.
- For section 1 ONLY, do not write prose paragraphs or bullets. Instead output exactly one line per screenshot, in this exact machine-readable form and nothing else on the line: @N@ <description>, where N is the image number from the "Image order" list below (1 to ${screenshots.length}). Output the lines in image order, one per image, no blank lines between them, no sub-headers.

Provide:

1. SHADOW ANALYSIS BY SEASON & TIME
For each screenshot (one @N@ line per image, per the formatting rule above), write a detailed 4-6 sentence description: what specifically is casting the shadow near the property marker (a taller building, a row of low-rise structures, nothing nearby), which direction the shadow falls, roughly how much of the visible area around the marker is shaded vs sunlit at this exact time, and how that connects to the ground-truth numbers for this season. Be concrete and descriptive, not generic — this is the reader's main evidence per image, so do not shortchange it.

2. FLOOR ${floorN} SPECIFIC ANALYSIS
Using the ground-truth floor clearance data, give a full, detailed explanation: when does direct sunlight first reach this unit in summer vs winter, how many hours per day in the best and worst months, how that changes month to month, and what this practically means for someone living on this floor (natural light for daily use, need for artificial lighting, heat gain, etc). Do not compress this into a couple of sentences — explain the reasoning, not just the conclusion.

3. ${safeFacingInput.toUpperCase()}-FACING WINDOW ASSESSMENT
Explain in full when the sun shines directly into a ${safeFacingInput}-facing window here across the year, why (walk through the azimuth/elevation reasoning in plain language), and whether this is a good or bad facing for this specific location and floor — with the reasoning spelled out, not just a verdict.

4. HOME BUYER VERDICT
A full, honest verdict, several sentences to a short paragraph: is the sunlight situation good, acceptable, or poor, and why specifically. What floor would you recommend as a minimum, and why. Any specific concerns visible in the shadow patterns across the screenshots. Do not just restate the overall feasibility label — explain what it means for someone actually living there.`;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { analysis: 'Server is missing GEMINI_API_KEY — cannot run AI shadow analysis.' },
      { status: 500 }
    );
  }

  try {
    const labelLine = screenshots
      .map((s, i) => `Image ${i + 1}: ${s.label}`)
      .join('\n');

    const imageParts = screenshots.map((s) => {
      const match = s.base64.match(/^data:(image\/\w+);base64,(.+)$/);
      return {
        inlineData: {
          mimeType: match ? match[1] : 'image/jpeg',
          data: match ? match[2] : s.base64,
        },
      };
    });

    const contents = [{ role: 'user', parts: [{ text: `${prompt}\n\nImage order:\n${labelLine}` }, ...imageParts] }];

    const callGemini = async (msgContents) => {
      for (const model of GEMINI_MODELS) {
        const res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: msgContents,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
          }),
        });
        if (res.ok) return res.json();
        const errText = await res.text();
        console.error(`Gemini Vision request failed (${model}):`, res.status, errText);
        if (res.status !== 429) return null;
      }
      return null;
    };

    let data = await callGemini(contents);
    if (!data) {
      return NextResponse.json(
        { analysis: 'AI analysis request failed. Please try again in a moment.', summary: reportSummary },
        { status: 502 }
      );
    }

    let candidate = data?.candidates?.[0];
    let analysis = candidate?.content?.parts?.[0]?.text || '';
    let finishReason = candidate?.finishReason;

    let continuations = 0;
    while (finishReason === 'MAX_TOKENS' && continuations < 3) {
      continuations++;
      console.warn(`Gemini hit MAX_TOKENS, requesting continuation #${continuations}`);
      const followUpContents = [
        ...contents,
        { role: 'model', parts: [{ text: analysis }] },
        { role: 'user', parts: [{ text: 'Continue exactly where you left off, mid-sentence if needed. Do not repeat anything you already wrote, and do not restart the section headers.' }] },
      ];
      const contData = await callGemini(followUpContents);
      if (!contData) break;
      const contCandidate = contData?.candidates?.[0];
      const contText = contCandidate?.content?.parts?.[0]?.text || '';
      if (!contText) break;
      analysis += '\n' + contText;
      finishReason = contCandidate?.finishReason;
      candidate = contCandidate;
    }

    if (!analysis || analysis.trim().length < 100) {
      console.error(
        'Gemini analysis came back empty/short. finishReason:', finishReason,
        'full response:', JSON.stringify(data).slice(0, 2000)
      );
      return NextResponse.json(
        {
          analysis: `AI analysis was incomplete (reason: ${finishReason || 'unknown'}). The data table above is still accurate — try regenerating the report for the full write-up.`,
          summary: reportSummary,
        },
        { status: 200 }
      );
    }

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Analysis still truncated after continuations, shipping partial text with a note.');
      analysis += '\n\n*(Note: this analysis was cut short by a length limit — the data table above remains fully accurate.)*';
    }

    return NextResponse.json({ analysis, summary: reportSummary });
  } catch (err) {
    console.error('Gemini Vision error:', err);
    return NextResponse.json(
      { analysis: 'Could not reach Gemini Vision. Please try again in a moment.', summary: reportSummary },
      { status: 502 }
    );
  }
}
