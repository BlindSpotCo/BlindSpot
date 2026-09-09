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

// Vercel's default serverless timeout (10s on Hobby, and even the 60s Pro
// default) is too short for this route: 12 screenshots + up to 3 Gemini
// continuation calls can legitimately take 60-120s. Without this, a slow
// but otherwise-successful generation gets killed mid-flight and the
// person sees a generic "something went wrong" with no way to tell that
// from an actual API failure -- this was the most likely cause of the
// repeated report-generation failures reported in review.
export const maxDuration = 120;

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
NEIGHBOURHOOD GROUND TRUTH (from Neighbourhood Score, for ${avRecord.name || avRecord.pin_code} — treat every figure below as fact, do NOT re-derive or override it):
Composite neighbourhood score: ${avRecord.nqi_composite}/100 (Grade ${avRecord.grade})
Factor breakdown: ${factorLines || 'not available'}
Crime: ${avRecord.total_cognizable_crimes ?? 'unknown'} recorded cognizable crimes/yr, safer than ${avRecord.crime_percentile ?? 'unknown'}% of comparable areas, tier "${avRecord.crime_tier ?? 'unknown'}"
Schools: ${avRecord.schools_count ?? (avRecord.schools_list || []).length} mapped nearby${schoolNames ? ` (incl. ${schoolNames})` : ''}
Price context: ${pc?.rate_sqft ? `₹${Math.round(pc.rate_sqft[0]).toLocaleString('en-IN')}–₹${Math.round(pc.rate_sqft[1]).toLocaleString('en-IN')} per sq ft, "${pc.label}" band (government guidance value, not a market quote)` : 'not available'}
Note: the neighbourhood score is the same for every unit in this pincode — it does not change with floor or facing.`;
}

// A budget, not just a retry count. The platform kills this function at its
// own ceiling and the caller then sees a 502 with nothing in it -- no
// summary, no table, no reason. Every attempt below is bounded, and the loop
// stops trying once there isn't time left for another one, so this route
// always returns its own answer rather than being cut off mid-flight.
function geminiCaller({ budgetMs = 48_000, maxOutputTokens = 6144 } = {}) {
  const startedAt = Date.now();
  const left = () => budgetMs - (Date.now() - startedAt);

  const call = async (msgContents) => {
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = left();
        if (remaining < 6_000) {
          console.warn('Gemini Vision: out of time budget, giving up before', model);
          return null;
        }
        let res;
        try {
          res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: msgContents,
              generationConfig: { maxOutputTokens, temperature: 0.2 },
            }),
            signal: AbortSignal.timeout(Math.min(remaining, 40_000)),
          });
        } catch (networkErr) {
          console.error(`Gemini Vision network error (${model}, attempt ${attempt + 1}):`, networkErr?.message || networkErr);
          if (attempt === 0 && left() > 12_000) { await new Promise(r => setTimeout(r, 800)); continue; }
          break; // exhausted retries for this model, fall through to the next one
        }
        if (res.ok) return res.json();
        const errText = await res.text();
        console.error(`Gemini Vision request failed (${model}, attempt ${attempt + 1}):`, res.status, errText.slice(0, 500));
        // 429 is a rate limit, and on a free-tier key it is usually a
        // per-minute one that clears in a second or two. Abandoning the
        // model on the first one meant a burst of requests came back empty
        // rather than a little slower.
        if (attempt === 0 && res.status === 429 && left() > 10_000) { await new Promise(r => setTimeout(r, 2_000)); continue; }
        if (res.status === 429) break;
        if (attempt === 0 && res.status >= 500 && left() > 12_000) { await new Promise(r => setTimeout(r, 800)); continue; }
        break;
      }
    }
    return null;
  };

  return { call, left };
}

// Per-image descriptions for the sun & shadow gallery.
//
// Twelve images in one request is the wrong shape for this, and it is what
// produced captions that stopped mid-sentence on image 2 and were simply
// absent from image 3 onwards: the model hit its output ceiling partway down
// the list and every image after the cut got nothing. A bigger ceiling only
// moves where the cliff is.
//
// So: small batches, run at once. Four images per call sits well inside any
// output limit, the batches go in parallel so it costs one call's latency
// rather than three, and a batch that fails takes four captions with it
// instead of the whole set.
//
// This is also its own job now, separate from the report narrative. The full
// report used to ask for these twelve descriptions as one section among six,
// which is how a long shadow section could eat the token budget the rest of
// the report needed -- and why the same truncation showed up there too.
async function describeImages({ screenshots, groundTruthText, floorN, facing, budgetMs = 38_000 }) {
  // Six per batch, not four: two requests instead of three, which matters
  // more than batch size does. Six descriptions of 2-4 sentences is around
  // 600 output tokens, comfortably inside the 2048 ceiling below.
  const BATCH = 6;
  const batches = [];
  for (let i = 0; i < screenshots.length; i += BATCH) {
    batches.push({ offset: i, shots: screenshots.slice(i, i + BATCH) });
  }

  // Every batch numbers its own images from 1. Telling batch two that its
  // images are "5 to 8" and trusting the answer to come back that way is a
  // bet on the model's arithmetic, and when it loses, batch two's lines are
  // numbered 1-4, overwrite batch one, and eight images end up with no
  // description at all. The offset is applied here instead, in code.
  const promptFor = (shots) => `You are a solar analyst describing map screenshots for a home buyer in India.

${groundTruthText}

These are screenshots of a 3D map of one location. The orange circle marks the exact property; darker areas are shadows cast by real OpenStreetMap building data. The unit in question is on floor ${floorN}, facing ${facing}.

You are being given ${shots.length} images. Write ONE line per image and nothing else -- ${shots.length} lines, no more, no fewer. Each line must be exactly this form, no bullet, no heading, no blank line between them:
@N@ <description>
numbered @1@ to @${shots.length}@, in the order the images are listed below.

Each description is 2-4 sentences of plain, everyday English, and must end as a complete sentence -- never stop mid-sentence. Say what is casting the shadow near the marker (a taller building, a row of low-rise structures, nothing nearby), which way the shadow falls, roughly how much of the area around the marker is in shade versus sun at that moment, and what that means for this floor and facing at that time of year. Be concrete about what you can actually see. If an image looks blank, black or unreadable, say so on its line instead of guessing. Never use emoji.

Image order:
${shots.map((sh, i) => `Image ${i + 1}: ${sh.label}`).join('\n')}`;

  // Local 1..N back to this batch's real position in the twelve.
  const renumber = (text, offset, shotCount) => text
    .split('\n')
    .map((line) => {
      const m = line.match(/^@(\d+)@\s*(.+)$/);
      if (!m) return null;
      const local = parseInt(m[1], 10);
      if (!(local >= 1 && local <= shotCount)) return null;
      return `@${offset + local}@ ${m[2].trim()}`;
    })
    .filter(Boolean)
    .join('\n');

  const partsFor = (shots) => shots.map((sh) => {
    const match = sh.base64.match(/^data:(image\/\w+);base64,(.+)$/);
    return { inlineData: { mimeType: match ? match[1] : 'image/jpeg', data: match ? match[2] : sh.base64 } };
  });

  // A budget per batch, not one clock shared by all of them. With a single
  // caller created up front, a slow first batch could eat 33 of the 38
  // seconds and the second would find too little left to even ask -- so six
  // images came back described and six came back blank, with nothing
  // anywhere reporting that as a failure.
  const perBatchMs = Math.max(15_000, Math.floor(budgetMs / Math.max(1, batches.length)));

  const runBatch = async ({ offset, shots }) => {
    try {
      const { call } = geminiCaller({ budgetMs: perBatchMs, maxOutputTokens: 2048 });
      const d = await call([{ role: 'user', parts: [{ text: promptFor(shots) }, ...partsFor(shots)] }]);
      const cand = d?.candidates?.[0];
      let text = cand?.content?.parts?.[0]?.text || '';
      // If a batch was cut off anyway, drop the unfinished last line rather
      // than showing half a sentence under an image.
      if (cand?.finishReason === 'MAX_TOKENS') {
        const lines = text.split('\n');
        lines.pop();
        text = lines.join('\n');
        console.warn(`[report/analyse] caption batch at ${offset} hit MAX_TOKENS; dropped its last line.`);
      }
      const numbered = renumber(text, offset, shots.length);
      if (!numbered) console.warn(`[report/analyse] caption batch at ${offset} came back with no usable lines.`);
      return numbered;
    } catch (err) {
      console.error(`[report/analyse] caption batch at ${offset} failed:`, err?.message || err);
      return '';
    }
  };

  // One at a time. Firing every batch at once tripled the request rate at
  // the same instant, and on a free-tier key that reads as a rate limit and
  // comes back as nothing -- which is worse than the truncation it was
  // meant to fix. Sequential costs a few seconds and asks for one thing at
  // a time, which is what the quota is counting.
  const texts = [];
  for (const b of batches) texts.push(await runBatch(b));

  let text = texts.filter(Boolean).join('\n');
  let count = (text.match(/^@\d+@/gm) || []).length;

  // Last resort: one call for the lot, the shape this used to be. Slower
  // and it can truncate, but a truncated set of descriptions beats none,
  // and this only runs when the batches have already come back empty.
  if (count === 0 && batches.length > 1) {
    console.warn('[report/analyse] all caption batches came back empty; retrying as a single request.');
    const { call: oneCall } = geminiCaller({ budgetMs: 30_000, maxOutputTokens: 4096 });
    try {
      const d = await oneCall([{ role: 'user', parts: [{ text: promptFor(screenshots) }, ...partsFor(screenshots)] }]);
      const whole = renumber(d?.candidates?.[0]?.content?.parts?.[0]?.text || '', 0, screenshots.length);
      if (/^@\d+@/m.test(whole)) {
        text = whole;
        count = (whole.match(/^@\d+@/gm) || []).length;
      }
    } catch (err) {
      console.error('[report/analyse] single-request caption fallback failed:', err?.message || err);
    }
  }

  console.log(`[report/analyse] captions: ${count}/${screenshots.length} images described.`);
  return { text, count };
}

export async function POST(req) {
  const { screenshots, lat, lon, address, floor, facing, tzOffset, avRecord, combinedScore, unitScore, areaWeight, unitWeight, personaId, customNote, actionItems, skipAi, captionsOnly } = await req.json();
  const persona = personaId ? (await import('@/lib/personas')).getPersona(personaId) : null;
  // Free-text ask from the buyer, captured right before they hit Generate
  // (see UnitVerdict's own field -- the report modal itself auto-starts,
  // so this is the only chance to ask). Capped and stripped of the model's
  // own prompt syntax so it can't be used to inject formatting/section
  // instructions of its own.
  const safeCustomNote = typeof customNote === 'string'
    ? customNote.trim().slice(0, 500).replace(/[`*_#]/g, '')
    : '';

  // The same weak-score-> concrete-action pairs already shown in the
  // Verdict screen's own popup (lib/property-score/actionItems.js),
  // passed straight through rather than recomputed here -- one source of
  // truth for which dimensions actually flagged as weak enough to act on.
  const safeActionItems = Array.isArray(actionItems)
    ? actionItems.filter(i => i && typeof i.label === 'string' && typeof i.action === 'string').slice(0, 10)
    : [];

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

  // Hard bypass -- no model at all. Kept for a caller that explicitly wants
  // only the measured half.
  if (skipAi) {
    return NextResponse.json({ analysis: '', summary: reportSummary, aiSkipped: true });
  }

  // The sun & shadow document needs ONE thing from the model: a description
  // under each frame. It was getting that by asking for the entire combined
  // report -- eight sections, thousands of tokens, continuations that
  // resent all twelve images -- and then throwing all but the captions
  // away. That is why it kept failing: the cost and the fragility of the
  // full report, for a twelfth of its output.
  //
  // So ask for exactly the captions. One call, one short answer, a tight
  // budget. And if it still doesn't come back, the frames and the monthly
  // table go out without it rather than the whole document failing.
  if (captionsOnly) {
    if (!process.env.GEMINI_API_KEY) {
      console.error('[report/analyse] GEMINI_API_KEY is not set — sun & shadow images will have no descriptions.');
      return NextResponse.json({ analysis: '', summary: reportSummary, aiUnavailable: true, aiReason: 'not-configured' });
    }

    const { text: capText, count: captioned } = await describeImages({
      screenshots, groundTruthText, floorN, facing: safeFacingInput,
    });

    // One usable @N@ line is the bar. Anything less and the gallery is
    // better off saying nothing than showing a stray sentence under one
    // image and nothing under the other eleven.
    if (captioned === 0) {
      console.warn('[report/analyse] caption pass came back without @N@ lines; shipping the gallery without descriptions.');
      return NextResponse.json({ analysis: '', summary: reportSummary, aiUnavailable: true, aiReason: 'captions-empty' });
    }

    return NextResponse.json({
      analysis: capText, summary: reportSummary, captions: true,
      captionedCount: captioned, imageCount: screenshots.length,
    });
  }

  // No key configured is a deployment problem, not a busy model, and it
  // will not fix itself on a retry -- say so once and let the report ship
  // with everything that doesn't depend on it.
  if (!process.env.GEMINI_API_KEY) {
    console.error('[report/analyse] GEMINI_API_KEY is not set — shipping the report without the written analysis.');
    return NextResponse.json({
      analysis: '', summary: reportSummary, avRecord: avRecord || null,
      combinedScore: combinedScore ?? null, aiUnavailable: true, aiReason: 'not-configured',
    });
  }

  const neighbourhoodGroundTruth = buildNeighbourhoodGroundTruth(avRecord);
  const hasNeighbourhood = Boolean(avRecord);

  const combinedGroundTruth = hasNeighbourhood ? `
COMBINED BLINDSPOT SCORE: ${combinedScore ?? 'not computed'}/100 — built from the neighbourhood score (${avRecord.nqi_composite}/100, weighted ${Math.round((areaWeight ?? 0.5) * 100)}%) and this unit's Home Comfort Score (${unitScore ?? 'not computed'}/100, weighted ${Math.round((unitWeight ?? 0.5) * 100)}%). Treat both of these figures as fact, do not recompute them.` : '';

  // Section 2 is new and it is the point of a *combined* report: the two
  // halves read against each other. Before this, the area and the flat were
  // analysed in separate sections that never mentioned one another, and the
  // only place they met was one clause of the verdict paragraph. A buyer
  // deciding between a good area with a dark flat and a bright flat in a
  // weaker area got no help with exactly that question.
  const togetherSectionNumber = 2;
  const neighbourhoodSectionNumber = 3;
  // Floor and facing were two sections that repeated each other -- both
  // walked through the same monthly numbers, one keyed on height and one on
  // orientation. One section, and the output is shorter as well as clearer.
  const flatSectionNumber = hasNeighbourhood ? 4 : 1;

  const verdictInstruction = hasNeighbourhood
    ? `1. HOME BUYER VERDICT
This is the single most important section — many buyers will read only this. Write it as a short paragraph (NOT bullets, NOT a list of numbers).
The FIRST paragraph specifically must be written in simple, everyday words — the way you'd explain it out loud to a friend who has no real-estate or technical background. No jargon, no acronyms, no dense stat-dumping. In 3-5 short sentences, tell them plainly: what kind of area this is to live in, what this specific flat is like for sunlight and comfort, and what your overall take is — good pick, okay with caveats, or better to look elsewhere. You may name the combined score and Home Comfort Score once, briefly, but the paragraph should read naturally even to someone who ignores the numbers entirely.
After that opening paragraph, add 2-4 more sentences going one level deeper: any real trade-offs (e.g. strong area but a shaded unit, or a bright unit in a weaker area), and a concrete recommendation — buy/consider/reconsider, and what floor or facing would improve things if relevant.
Close this section with one short line starting exactly "- Best fit for: " naming the 1-2 buyer types (from: families with young kids, young professionals/singles, remote workers, retirees, investors, renters) this specific property suits best given everything above — one clause of reasoning per type, not a restated summary.

${togetherSectionNumber}. THE AREA AND THE FLAT, READ TOGETHER
This is the section that only a combined report can write, so do not let it become a summary of the two that follow.
Answer one question: do these two halves point the same way, or do they pull against each other? Name it in the first sentence. There are only three honest answers and you must commit to one — both strong, both weak, or split (a good area with a compromised flat, or a comfortable flat in a weaker area).
Then, in 3-5 sentences of plain everyday English, say what that combination means in practice for someone living here. Be concrete about the trade: an area scoring ${hasNeighbourhood ? avRecord.nqi_composite : 'X'}/100 with a flat at ${unitScore ?? 'Y'}/100 is a different proposition from the reverse, and the reader wants to know which one they are being offered and whether the weaker half is fixable. Say plainly which of the two halves is doing the work in the combined score of ${combinedScore ?? '-'}/100, given the area is weighted ${Math.round((areaWeight ?? 0.5) * 100)}% and the flat ${Math.round((unitWeight ?? 0.5) * 100)}%.
Then say which half is fixable and which is not, because this is the practical difference: a dark flat can often be answered by a higher floor, a different unit in the same tower, or a different facing — the neighbourhood cannot be changed at all. If a specific floor or facing in this same building would fix a weak flat score, say which and roughly what it would gain. If the weakness is the area, say plainly that no unit in this building escapes it.
Finish with one sentence naming the single biggest risk in this pairing and the one thing that would most change your mind about it.
Do not use bullets in this section. Do not repeat the verdict's wording.

${neighbourhoodSectionNumber}. NEIGHBOURHOOD FULL ANALYSIS
Do NOT simply restate the ground-truth numbers one by one — that data is already shown in a table alongside this section, so repeating it here adds nothing. Instead, ANALYSE it: which 1-2 factors are this area's clear strength, which 1-2 are its clear weakness, and what does that combination actually mean for someone living here day to day. Weave in the specific numbers naturally as evidence for your points, not as a checklist. Cover infrastructure/roads, schools, crime/safety, water/power, air quality where available, and what the price context implies — but organised around the 2-3 things that matter most here, not a uniform tour through every field. This section is about the AREA ONLY — do not discuss sunlight, shadows, or the specific unit here; that comes later.
Then make it personal and sell the area to different kinds of buyers, each grounded in the real numbers above (never invent a number that isn't in the ground truth). End the section with exactly 3 bullet lines, each starting with "- " and a buyer type, addressing a DIFFERENT type in each line from this set: families with school-age kids, young professionals/singles, and investors/renters. Each line should read like real advice, not a label — e.g. "- Families: the schools score of X and low crime tier make this a strong pick if school runs and safety matter most to you." / "- Young professionals: with Y for infrastructure/connectivity, this suits someone who prioritises commute and convenience over quiet." / "- Investors: price band is Z per sqft against a composite score of W, which reads as [undervalued for the fundamentals / priced in line with the area's strengths / a premium for the location] — say which, honestly, based on the actual numbers." Do not force a positive spin for a buyer type the area genuinely doesn't suit — say so plainly if that's the honest read.`
    : '';

  // Persona overlay. Appended AFTER the full section list so it wins on any
  // conflict of emphasis, and resolves to '' when no persona is selected --
  // the no-persona prompt is byte-for-byte what it was before personas
  // existed, deliberately. The overlay never adds, removes or renumbers any
  // of the sections above; it only re-slants them and appends ONE extra
  // trailing section, which the generic `N. TITLE` parser in the PDF route
  // picks up as bottom narrative without any change there.
  const personaSectionNumber = hasNeighbourhood ? 5 : 3;
  const ov = persona?.reportOverlay || null;
  const personaOverlay = ov ? `

READER OVERLAY — this applies on top of everything above and overrides it wherever the two pull in different directions.

WHO THIS IS FOR: ${ov.readerLine}

Re-slant the whole report for this reader. Keep every numbered section above exactly as specified — same titles, same numbers, same order, same formatting rules. What changes is emphasis, what leads each section, and which findings get a full paragraph versus one clause.

GIVE MORE SPACE TO: ${ov.weightUp}
GIVE LESS SPACE TO: ${ov.weightDown}

Never announce the slant to the reader. Do not write "as a family buyer" or "for investors like you" or name this persona anywhere. The fit should be felt, not stated. Every re-slanted claim still has to trace to a figure in the ground truth — re-weighting emphasis is not permission to assert anything the data does not support.

TONE FOR THIS READER: ${ov.toneNote}

Then, after all the sections listed above, add exactly one more section:

${personaSectionNumber}. ${ov.sectionTitle}
${ov.sectionBody}` : '';

  // Appended after everything else (including persona overlay, if any) so
  // it always lands as the actual last section regardless of which of the
  // 4 numbering combinations above are in play this time.
  const checklistSectionNumber = (hasNeighbourhood ? 5 : 3) + (ov ? 1 : 0);
  const checklistSection = safeActionItems.length > 0 ? `

${checklistSectionNumber}. WHAT TO CHECK WHEN YOU VISIT
These are already-written, plain-language action lines for the specific dimensions that scored weak enough to be worth a second look in person — reuse them close to as-is (light rewording for flow is fine, don't invent new ones or drop any) as a short "- " bulleted list, one line per item, each starting with the dimension name in bold-equivalent plain text then a colon. One short sentence before the list is enough context; no restating of scores or numbers already covered elsewhere in this report.
${safeActionItems.map(i => `- ${i.label} (${i.score}): ${i.action}`).join('\n')}` : '';

  const prompt = `You are a solar and neighbourhood intelligence analyst helping a home buyer in India, writing a single combined report for BlindSpot.

Property: ${safeAddressInput} (${latN.toFixed(4)}°N, ${lonN.toFixed(4)}°E)
Unit: Floor ${floorN} (≈${floorN * 3}m height), ${safeFacingInput}-facing
${groundTruthText}
${neighbourhoodGroundTruth}
${combinedGroundTruth}

You also have ${screenshots.length} screenshots of the actual 3D map at this location. They are described one by one elsewhere, in a separate gallery -- do NOT write per-image descriptions here. The orange circle/dot marks the exact property location; darker areas are rendered shadows from OpenStreetMap building data. Use these images ONLY for narrative color and visual confirmation (e.g. "as the images show, a taller block sits to the southeast") — do NOT estimate hours of sun, shadow duration, or building heights from the images; use the ground-truth numbers above for all figures. If a screenshot looks blank, black, or unreadable, say so explicitly rather than guessing what it would show.

Write personally, not clinically — like a knowledgeable friend giving honest advice, not a data report reciting fields. Address the reader as "you" where it reads naturally. Be thorough and specific, not brief. This report is a defensible artifact a buyer will rely on — do not compress away detail to save space, and do not pad it with generic real-estate filler that could apply to any property.
Plain language throughout, not just the verdict's opening lines: explain any real-estate or technical term the first time it appears (azimuth, NQI, feasibility band, etc.) in a short clause rather than assuming the reader already knows it, and prefer the everyday word over the technical one wherever both say the same thing.
${persona ? `\nWHO'S READING THIS: ${persona.reportFocus}\n` : ''}
${safeCustomNote ? `\nTHE BUYER'S OWN REQUEST — they typed this themselves right before generating this report, so treat it as the single strongest signal of what they actually care about, above persona defaults or generic coverage: "${safeCustomNote}"\nDirectly address this in the Home Buyer Verdict section — do not just mention it in passing, actually answer it using the ground-truth data above. If the data above genuinely doesn't cover what they asked (e.g. they asked about something this report doesn't measure), say so plainly rather than inventing an answer. Never quote their request back verbatim or write "you mentioned" — just make sure the answer is unmistakably there.\n` : ''}

FORMATTING RULES (follow exactly, every time, regardless of location):
- Never use emoji, anywhere, in any section, under any circumstances — not as bullet markers, not as decoration, not inline in a sentence. Plain text only.
- Start each section heading on its own line as "N. TITLE" (plain text, no ** bold markers, no # markdown), using the exact section numbers given below.
- Use plain "- " for bullet points, not "*".
- Do not use markdown bold (**) anywhere except to emphasize a single key figure inline.
- Always include every numbered section below, in order, even if a section is short for this location.

Provide, in this exact order:

${verdictInstruction}

${flatSectionNumber}. THE FLAT ITSELF, FLOOR ${floorN} FACING ${safeFacingInput.toUpperCase()}
Height and orientation are one story, not two — write them as one. Cover, in plain everyday English and in this order:
- What a day in this flat is actually like for light. When the sun first reaches it, when it leaves, and how many usable hours that is, using the ground-truth figures.
- How that changes across the year. Name the best and worst months by name and say what the difference feels like to live in, not just the hour count.
- Whether ${safeFacingInput}-facing is a good or bad orientation at this latitude and on this floor, with the reasoning spelled out in ordinary words — no azimuth or elevation figures unless you immediately explain what they mean.
- Heat as well as light. A facing that is generous with winter sun may be punishing in May; say which side of that this flat falls on.
- What practically follows: whether this flat needs lights on during the day, whether the afternoon side will need blinds or heavy curtains, and whether a different floor in this same building would meaningfully change the answer.
Write it as flowing paragraphs, not as the bulleted list above — those bullets are your coverage checklist, not the shape of the section.${hasNeighbourhood ? '' : `

2. HOME BUYER VERDICT
A full, honest verdict, several sentences to a short paragraph: is the sunlight situation good, acceptable, or poor, and why specifically. What floor would you recommend as a minimum, and why. Any specific concerns visible in the shadow patterns across the screenshots. Do not just restate the overall feasibility label — explain what it means for someone actually living there.
The opening 2-3 sentences of this section must be plain, everyday words — the way you'd say it out loud to a friend with no real-estate or technical background, no jargon or acronyms — before going into any deeper detail.`}${personaOverlay}${checklistSection}`;

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

    // One retry per model on a transient failure (5xx, or a thrown network
    // error) before giving up on that model and falling through to the
    // next one -- a single blip used to kill the whole report right away.
    // 429 (rate limit) still skips straight to the next model with no
    // retry, since retrying the same model won't help there.
    const { call: callGemini, left } = geminiCaller();

    // The twelve image descriptions are their own batched job now, started
    // here so it runs alongside the narrative rather than after it. Asking
    // for them inside the report is what let one long shadow section eat the
    // budget the other five sections needed.
    // Staggered, not simultaneous. Both this and the narrative call go to
    // the same key and the same per-minute quota; starting them in the same
    // instant is how a burst turns into a 429 that neither of them needed.
    const captionsPromise = new Promise((r) => setTimeout(r, 1_500))
      .then(() => describeImages({
        screenshots, groundTruthText, floorN, facing: safeFacingInput, budgetMs: 38_000,
      }))
      .catch((err) => {
        console.error('[report/analyse] image descriptions failed:', err?.message || err);
        return { text: '', count: 0 };
      });

    let data = await callGemini(contents);
    if (!data) {
      // The narrative didn't come back, but the image descriptions may well
      // have -- they are a different, smaller job. Ship what landed.
      const caps = await captionsPromise;
      return NextResponse.json({
        analysis: caps.text || '',
        summary: reportSummary,
        avRecord: avRecord || null,
        combinedScore: combinedScore ?? null,
        aiUnavailable: true,
        aiReason: 'busy',
      });
    }

    let candidate = data?.candidates?.[0];
    let analysis = candidate?.content?.parts?.[0]?.text || '';
    let finishReason = candidate?.finishReason;

    // Continuations carry the TEXT forward, not the images. Each of the
    // twelve frames costs real upload time and real vision tokens, and
    // resending all of them up to three more times turned one call into
    // four full vision requests -- which is how a report that worked once
    // started timing out at the platform's ceiling and coming back a 502.
    // The model has already described the images; it needs its own draft
    // and the instruction to keep going, nothing more.
    const textOnlyPrompt = [{ text: `${prompt}\n\nImage order:\n${labelLine}\n\n(The map images were provided with the first part of this request; continue from your own draft below.)` }];
    let continuations = 0;
    while (finishReason === 'MAX_TOKENS' && continuations < 2 && left() > 15_000) {
      continuations++;
      console.warn(`Gemini hit MAX_TOKENS, requesting continuation #${continuations}`);
      const followUpContents = [
        { role: 'user', parts: textOnlyPrompt },
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
      const capsOnly = await captionsPromise;
      return NextResponse.json({
        analysis: capsOnly.text || '',
        summary: reportSummary,
        avRecord: avRecord || null,
        combinedScore: combinedScore ?? null,
        aiUnavailable: true,
        aiReason: finishReason ? `stopped: ${finishReason}` : 'empty',
      });
    }

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Analysis still truncated after continuations, shipping partial text with a note.');
      analysis += '\n\n*(Note: this analysis was cut short by a length limit — the data table above remains fully accurate.)*';
    }

    const caps = await captionsPromise;
    const withImages = caps.text ? `${analysis}\n\n${caps.text}` : analysis;

    return NextResponse.json({
      analysis: withImages, summary: reportSummary,
      avRecord: avRecord || null, combinedScore: combinedScore ?? null,
      captionedCount: caps.count, imageCount: screenshots.length,
    });
  } catch (err) {
    console.error('Gemini Vision error:', err);
    return NextResponse.json({
      analysis: '',
      summary: reportSummary,
      avRecord: avRecord || null,
      combinedScore: combinedScore ?? null,
      aiUnavailable: true,
      aiReason: 'unreachable',
    });
  }
}
