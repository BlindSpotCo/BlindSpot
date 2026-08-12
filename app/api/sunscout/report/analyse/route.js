// app/api/sunscout/report/analyse/route.js
// Ported from SunScout's app/api/report/analyse/route.ts. Sends real map
// screenshots to Gemini Vision for shadow analysis, grounded in a
// deterministic solar-geometry summary. Needs BlindSpot's OWN
// GEMINI_API_KEY env var -- this does not call out to sun-scout.com at all.
//
// v2 -- this is now the report for the COMBINED BlindSpot verdict, not a
// SunScout-only report. When the caller (the Property Score / combined-
// score flow) passes `avRecord` (the AsliVastu neighbourhood record) and
// `combinedScore`, the prompt asks for a unified report that opens with one
// Home Buyer Verdict paragraph covering BOTH the neighbourhood and the unit,
// then a full neighbourhood breakdown, then the existing SunScout
// sun/shadow sections. If avRecord is absent (no AsliVastu coverage for
// this pincode), it falls back to the original unit-only report so the
// "Home Comfort Score only" path in UnitVerdict.js still works.

import { NextResponse } from 'next/server';
import { computeSolarSummary } from '@/lib/sunscout/solarReport';
import { checkBuildingHeights } from '@/lib/sunscout/buildingHeights';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const FACTOR_LABELS = {
  crime: 'Crime', infrastructure: 'Infrastructure', air: 'Air Quality',
  power: 'Power', schools: 'Schools', water: 'Water', roads: 'Roads', sewerage: 'Sewerage',
};

// Builds the same kind of "treat as fact" ground-truth block for the
// neighbourhood side that computeSolarSummary already gives us for the sun
// side -- so the model narrates AsliVastu's real numbers instead of
// inventing its own impression of the area.
function buildNeighbourhoodGroundTruth(avRecord) {
  if (!avRecord) return '';
  const factorLines = Object.entries(avRecord.scores || {})
    .map(([k, v]) => `${FACTOR_LABELS[k] || k}: ${v}/100`)
    .join(', ');
  const schoolNames = (avRecord.schools_list || []).slice(0, 6).map(s => s.name).join('; ');
  const pc = avRecord.price_context;
  return `
NEIGHBOURHOOD GROUND TRUTH (from AsliVastu, for ${avRecord.name || avRecord.pin_code} — treat every figure below as fact, do NOT re-derive or override it):
Composite neighbourhood score: ${avRecord.nqi_composite}/100 (Grade ${avRecord.grade})
Factor breakdown: ${factorLines || 'not available'}
Crime: ${avRecord.total_cognizable_crimes ?? 'unknown'} recorded cognizable crimes/yr, safer than ${avRecord.crime_percentile ?? 'unknown'}% of comparable areas, tier "${avRecord.crime_tier ?? 'unknown'}"
Schools: ${avRecord.schools_count ?? (avRecord.schools_list || []).length} mapped nearby${schoolNames ? ` (incl. ${schoolNames})` : ''}
Price context: ${pc?.rate_sqft ? `₹${Math.round(pc.rate_sqft[0]).toLocaleString('en-IN')}–₹${Math.round(pc.rate_sqft[1]).toLocaleString('en-IN')} per sq ft, "${pc.label}" band (government guidance value, not a market quote)` : 'not available'}
Note: the neighbourhood score is the same for every unit in this pincode — it does not change with floor or facing.`;
}

export async function POST(req) {
  const { screenshots, lat, lon, address, floor, facing, tzOffset, avRecord, combinedScore, unitScore, areaWeight, unitWeight, personaId } = await req.json();
  const persona = personaId ? (await import('@/lib/personas')).getPersona(personaId) : null;

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

  const neighbourhoodGroundTruth = buildNeighbourhoodGroundTruth(avRecord);
  const hasNeighbourhood = Boolean(avRecord);

  const combinedGroundTruth = hasNeighbourhood ? `
COMBINED BLINDSPOT SCORE: ${combinedScore ?? 'not computed'}/100 — built from the neighbourhood score (${avRecord.nqi_composite}/100, weighted ${Math.round((areaWeight ?? 0.5) * 100)}%) and this unit's Home Comfort Score (${unitScore ?? 'not computed'}/100, weighted ${Math.round((unitWeight ?? 0.5) * 100)}%). Treat both of these figures as fact, do not recompute them.` : '';

  const imageSectionNumber = hasNeighbourhood ? 3 : 1;
  const floorSectionNumber = hasNeighbourhood ? 4 : 2;
  const facingSectionNumber = hasNeighbourhood ? 5 : 3;

  const verdictInstruction = hasNeighbourhood
    ? `1. HOME BUYER VERDICT
This is the single most important section — many buyers will read only this. Write it as a short paragraph (NOT bullets, NOT a list of numbers).
The FIRST paragraph specifically must be written in simple, everyday words — the way you'd explain it out loud to a friend who has no real-estate or technical background. No jargon, no acronyms, no dense stat-dumping. In 3-5 short sentences, tell them plainly: what kind of area this is to live in, what this specific flat is like for sunlight and comfort, and what your overall take is — good pick, okay with caveats, or better to look elsewhere. You may name the combined score and Home Comfort Score once, briefly, but the paragraph should read naturally even to someone who ignores the numbers entirely.
After that opening paragraph, add 2-4 more sentences going one level deeper: any real trade-offs (e.g. strong area but a shaded unit, or a bright unit in a weaker area), and a concrete recommendation — buy/consider/reconsider, and what floor or facing would improve things if relevant.
Close this section with one short line starting exactly "- Best fit for: " naming the 1-2 buyer types (from: families with young kids, young professionals/singles, remote workers, retirees, investors, renters) this specific property suits best given everything above — one clause of reasoning per type, not a restated summary.

2. NEIGHBOURHOOD FULL ANALYSIS
Do NOT simply restate the ground-truth numbers one by one — that data is already shown in a table alongside this section, so repeating it here adds nothing. Instead, ANALYSE it: which 1-2 factors are this area's clear strength, which 1-2 are its clear weakness, and what does that combination actually mean for someone living here day to day. Weave in the specific numbers naturally as evidence for your points, not as a checklist. Cover infrastructure/roads, schools, crime/safety, water/power, air quality where available, and what the price context implies — but organised around the 2-3 things that matter most here, not a uniform tour through every field. This section is about the AREA ONLY — do not discuss sunlight, shadows, or the specific unit here; that comes later.
Then make it personal and sell the area to different kinds of buyers, each grounded in the real numbers above (never invent a number that isn't in the ground truth). End the section with exactly 3 bullet lines, each starting with "- " and a buyer type, addressing a DIFFERENT type in each line from this set: families with school-age kids, young professionals/singles, and investors/renters. Each line should read like real advice, not a label — e.g. "- Families: the schools score of X and low crime tier make this a strong pick if school runs and safety matter most to you." / "- Young professionals: with Y for infrastructure/connectivity, this suits someone who prioritises commute and convenience over quiet." / "- Investors: price band is Z per sqft against a composite score of W, which reads as [undervalued for the fundamentals / priced in line with the area's strengths / a premium for the location] — say which, honestly, based on the actual numbers." Do not force a positive spin for a buyer type the area genuinely doesn't suit — say so plainly if that's the honest read.`
    : `1. SHADOW ANALYSIS BY SEASON & TIME`;

  const prompt = `You are a solar and neighbourhood intelligence analyst helping a home buyer in India, writing a single combined report for BlindSpot.

Property: ${safeAddressInput} (${latN.toFixed(4)}°N, ${lonN.toFixed(4)}°E)
Unit: Floor ${floorN} (≈${floorN * 3}m height), ${safeFacingInput}-facing
${groundTruthText}
${neighbourhoodGroundTruth}
${combinedGroundTruth}

You also have ${screenshots.length} screenshots of the actual 3D map at this location. The orange circle/dot marks the exact property location; darker areas are rendered shadows from OpenStreetMap building data. Use these images ONLY for narrative color and visual confirmation (e.g. "as the images show, a taller block sits to the southeast") — do NOT estimate hours of sun, shadow duration, or building heights from the images; use the ground-truth numbers above for all figures. If a screenshot looks blank, black, or unreadable, say so explicitly rather than guessing what it would show.

Write personally, not clinically — like a knowledgeable friend giving honest advice, not a data report reciting fields. Address the reader as "you" where it reads naturally. Be thorough and specific, not brief. This report is a defensible artifact a buyer will rely on — do not compress away detail to save space, and do not pad it with generic real-estate filler that could apply to any property.
${persona ? `\nWHO'S READING THIS: ${persona.reportFocus}\n` : ''}

FORMATTING RULES (follow exactly, every time, regardless of location):
- Never use emoji, anywhere, in any section, under any circumstances — not as bullet markers, not as decoration, not inline in a sentence. Plain text only.
- Start each section heading on its own line as "N. TITLE" (plain text, no ** bold markers, no # markdown), using the exact section numbers given below.
- Use plain "- " for bullet points, not "*".
- Do not use markdown bold (**) anywhere except to emphasize a single key figure inline.
- Always include every numbered section below, in order, even if a section is short for this location.
- For the "SHADOW ANALYSIS BY SEASON & TIME" section ONLY, do not write prose paragraphs or bullets. Instead output exactly one line per screenshot, in this exact machine-readable form and nothing else on the line: @N@ <description>, where N is the image number from the "Image order" list below (1 to ${screenshots.length}). Output the lines in image order, one per image, no blank lines between them, no sub-headers.

Provide, in this exact order:

${verdictInstruction}

${imageSectionNumber}. SHADOW ANALYSIS BY SEASON & TIME
For each screenshot (one @N@ line per image, per the formatting rule above), write a detailed 4-6 sentence description: what specifically is casting the shadow near the property marker (a taller building, a row of low-rise structures, nothing nearby), which direction the shadow falls, roughly how much of the visible area around the marker is shaded vs sunlit at this exact time, and how that connects to the ground-truth numbers for this season. Be concrete and descriptive, not generic — this is the reader's main evidence per image, so do not shortchange it. This section is shown to the reader separately, in a dedicated image gallery linked from the main report, not inline — write it as a standalone reference, not as something the reader has already seen above.

${floorSectionNumber}. FLOOR ${floorN} SPECIFIC ANALYSIS
Using the ground-truth floor clearance data, give a full, detailed explanation: when does direct sunlight first reach this unit in summer vs winter, how many hours per day in the best and worst months, how that changes month to month, and what this practically means for someone living on this floor (natural light for daily use, need for artificial lighting, heat gain, etc). Do not compress this into a couple of sentences — explain the reasoning, not just the conclusion.

${facingSectionNumber}. ${safeFacingInput.toUpperCase()}-FACING WINDOW ASSESSMENT
Explain in full when the sun shines directly into a ${safeFacingInput}-facing window here across the year, why (walk through the azimuth/elevation reasoning in plain language), and whether this is a good or bad facing for this specific location and floor — with the reasoning spelled out, not just a verdict.${hasNeighbourhood ? '' : `

4. HOME BUYER VERDICT
A full, honest verdict, several sentences to a short paragraph: is the sunlight situation good, acceptable, or poor, and why specifically. What floor would you recommend as a minimum, and why. Any specific concerns visible in the shadow patterns across the screenshots. Do not just restate the overall feasibility label — explain what it means for someone actually living there.`}`;

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

    return NextResponse.json({ analysis, summary: reportSummary, avRecord: avRecord || null, combinedScore: combinedScore ?? null });
  } catch (err) {
    console.error('Gemini Vision error:', err);
    return NextResponse.json(
      { analysis: 'Could not reach Gemini Vision. Please try again in a moment.', summary: reportSummary },
      { status: 502 }
    );
  }
}
