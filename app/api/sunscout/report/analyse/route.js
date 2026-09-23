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
// BlindSpot Verdict paragraph covering BOTH the neighbourhood and the unit,
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

import { GEMINI_MODELS, GEMINI_MODELS_LITE_FIRST, fetchGemini, deadModels, retryDelayMs, describeFailure } from '@/lib/gemini';

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
NEIGHBOURHOOD GROUND TRUTH (from the Neighbourhood Score, for ${avRecord.name || avRecord.pin_code} - treat every figure below as fact, do NOT re-derive or override it):
Composite neighbourhood score: ${avRecord.nqi_composite}/100 (Grade ${avRecord.grade})
Factor breakdown: ${factorLines || 'not available'}
Crime: ${avRecord.total_cognizable_crimes ?? 'unknown'} recorded cognizable crimes/yr, safer than ${avRecord.crime_percentile ?? 'unknown'}% of comparable areas, tier "${avRecord.crime_tier ?? 'unknown'}"
Schools: ${avRecord.schools_count ?? (avRecord.schools_list || []).length} mapped nearby${schoolNames ? ` (incl. ${schoolNames})` : ''}
Price context: ${pc?.rate_sqft ? `₹${Math.round(pc.rate_sqft[0]).toLocaleString('en-IN')}–₹${Math.round(pc.rate_sqft[1]).toLocaleString('en-IN')} per sq ft, "${pc.label}" band (government guidance value, not a market quote)` : 'not available'}
Note: the neighbourhood score is the same for every unit in this pincode - it does not change with floor or facing.`;
}

// A budget, not just a retry count. The platform kills this function at its
// own ceiling and the caller then sees a 502 with nothing in it -- no
// summary, no table, no reason. Every attempt below is bounded, and the loop
// stops trying once there isn't time left for another one, so this route
// always returns its own answer rather than being cut off mid-flight.
function geminiCaller({ budgetMs = 48_000, maxOutputTokens = 6144, generationConfig = null, models = GEMINI_MODELS, attemptMs = 40_000 } = {}) {
  const startedAt = Date.now();
  const left = () => budgetMs - (Date.now() - startedAt);
  // The last thing that went wrong, so a failed run can say what it was
  // ("429 gemini-3.8-flash: quota ...") instead of just "busy".
  // Keyed by model, so the reason lists every model's failure rather than
  // only whichever one happened last.
  const errs = {};
  const state = {
    get lastError() { return Object.values(errs).join('; '); },
    set lastError(v) { const m = String(v).match(/gemini-[\w.-]+/); errs[m ? m[0] : '_'] = v; },
  };

  const call = async (msgContents) => {
    for (const model of models) {
      if (deadModels.has(model)) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = left();
        if (remaining < 6_000) {
          console.warn('Gemini: out of time budget, giving up before', model);
          if (!Object.keys(errs).length) state.lastError = 'timed out';
          return null;
        }
        let res;
        try {
          res = await fetchGemini(model, { contents: msgContents, generationConfig: { maxOutputTokens, temperature: 0.2, ...(generationConfig || {}) }, signal: AbortSignal.timeout(Math.min(remaining, attemptMs)) });
        } catch (networkErr) {
          const why = networkErr?.name === 'TimeoutError' ? 'timed out' : (networkErr?.message || String(networkErr));
          state.lastError = `${model}: ${why}`;
          console.error(`Gemini network error (${model}, attempt ${attempt + 1}):`, why);
          if (attempt === 0 && left() > 12_000 && networkErr?.name !== 'TimeoutError') { await new Promise(r => setTimeout(r, 800)); continue; }
          break; // next model
        }
        if (res.ok) {
          const json = await res.json();
          // A candidate can come back with a finishReason and no content at
          // all. Reading that silently as an empty string is how a whole
          // feature disappeared with nothing in the logs to say why.
          const cand = json?.candidates?.[0];
          if (cand && !cand?.content?.parts?.[0]?.text) {
            state.lastError = `${model}: no text (finishReason=${cand.finishReason})`;
            console.warn(
              `[gemini] ${model} returned no text. finishReason=${cand.finishReason}`,
              'usage=', JSON.stringify(json?.usageMetadata || {}),
            );
          }
          return json;
        }
        const errText = await res.text();
        state.lastError = describeFailure(model, res.status, errText);
        console.error(`Gemini request failed (${model}, attempt ${attempt + 1}):`, res.status, errText.slice(0, 500));
        // Not found / no access: this model is out for this key. Don't ask
        // it again from this instance.
        if (res.status === 404 || res.status === 403) { deadModels.add(model); break; }
        // A rate limit says how long to wait. Wait that long if there's
        // time; otherwise try the next model, which has its own quota.
        if (res.status === 429) {
          const wait = retryDelayMs(errText) ?? 2_000;
          if (attempt === 0 && wait <= 20_000 && left() > wait + 10_000) { await new Promise(r => setTimeout(r, wait)); continue; }
          break;
        }
        if (attempt === 0 && res.status >= 500 && left() > 12_000) { await new Promise(r => setTimeout(r, 800)); continue; }
        break;
      }
    }
    return null;
  };

  return { call, left, state };
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
async function describeImages({ screenshots, groundTruthText, floorN, facing, budgetMs = 90_000 }) {
  // Six per batch, not twelve: one request for all of them overruns the
  // output ceiling partway down the list and every image after the cut gets
  // nothing. Two batches of six sit well inside it.
  const BATCH = 6;
  const batches = [];
  for (let i = 0; i < screenshots.length; i += BATCH) {
    batches.push({ offset: i, shots: screenshots.slice(i, i + BATCH) });
  }

  // Ask for JSON, not for a line format.
  //
  // This used to request "@N@ <description>" lines and parse them with a
  // regex. Every part of that was a guess about how the model would format
  // its answer -- a leading bullet, a bold marker, a blank line between
  // entries, a header sentence before the first one, or the description
  // wrapped onto its own line, and the regex matched nothing and the gallery
  // came back with no descriptions at all. Which is what happened.
  //
  // A response schema removes the guess: the model must return an array of
  // objects, and the array's own order carries the image numbering, so
  // nothing depends on the model counting correctly either.
  const SCHEMA = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        image: { type: 'INTEGER', description: 'the 1-based position of this image in the list given' },
        description: { type: 'STRING', description: '2 to 4 complete sentences of plain English' },
      },
      required: ['image', 'description'],
    },
  };

  const promptFor = (shots) => `You are a solar analyst describing map screenshots for a home buyer in India.

${groundTruthText}

These are screenshots of a 3D map of one location. The orange circle marks the exact property; darker areas are shadows cast by real OpenStreetMap building data. The unit in question is on floor ${floorN}, facing ${facing}.

You are given ${shots.length} images, in this order:
${shots.map((sh, i) => `${i + 1}. ${sh.label}`).join('\n')}

Return one entry per image, ${shots.length} in total, in that same order. For each, "image" is its position in the list above and "description" is 2 to 4 complete sentences of plain, everyday English covering: what is casting the shadow near the marker (a taller building, a row of low-rise structures, nothing nearby), which way the shadow falls, roughly how much of the area around the marker is in shade versus sun at that moment, and what that means for this floor and facing at that time of year.

Be concrete about what you can actually see. Never end mid-sentence. If an image looks blank, black or unreadable, say so in its description rather than guessing. Never use emoji.`;

  const partsFor = (shots) => shots.map((sh) => {
    const match = sh.base64.match(/^data:(image\/\w+);base64,(.+)$/);
    return { inlineData: { mimeType: match ? match[1] : 'image/jpeg', data: match ? match[2] : sh.base64 } };
  });

  // One deadline for the whole pass. The gap-filling below can issue up to
  // a dozen small requests, and without a ceiling a persistent rate limit
  // would have it retrying long after the rest of the report was ready.
  const startedAt = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - startedAt);

  // A budget per batch, not one clock shared by all of them: a slow first
  // batch used to leave the second with too little time to even ask.
  const perBatchMs = Math.max(15_000, Math.floor(budgetMs / Math.max(1, batches.length)));

  let lastCaptionError = '';
  const runBatch = async ({ offset, shots, ms }) => {
    const out = new Map(); // global image index (0-based) -> description
    try {
      // thinkingBudget: 0 is the whole fix for the missing descriptions.
      //
      // Gemini 2.5 Flash reasons before it answers, by default, with a
      // dynamic budget -- and those thinking tokens are deducted from
      // maxOutputTokens. At 2048 the model could spend the entire allowance
      // thinking and return a candidate carrying a finishReason and no
      // content at all, which this code read as "no captions". The
      // narrative call never hit it because 6144 leaves room to think AND
      // write; the caption call did. It is also what truncated the
      // descriptions mid-sentence back when all twelve went in one request.
      //
      // Describing what is in a picture needs no reasoning chain, so the
      // budget goes to zero and every token is spent on the answer.
      const { call, state } = geminiCaller({
        budgetMs: ms || perBatchMs,
        models: GEMINI_MODELS_LITE_FIRST,
        // The 3.x models take longer over six images than the 2.5 ones did;
        // 25s cut them off mid-answer ('timed out').
        attemptMs: 45_000,
        maxOutputTokens: 4096,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const d = await call([{ role: 'user', parts: [{ text: promptFor(shots) }, ...partsFor(shots)] }]);
      if (state.lastError) lastCaptionError = state.lastError;
      const cand = d?.candidates?.[0];
      const raw = cand?.content?.parts?.[0]?.text || '';
      if (!raw) {
        console.warn(`[report/analyse] caption batch at ${offset} came back empty (finishReason=${cand?.finishReason || 'none'}).`);
        return out;
      }

      let rows;
      try {
        rows = JSON.parse(raw);
      } catch {
        console.warn(`[report/analyse] caption batch at ${offset} was not valid JSON; first 200 chars: ${raw.slice(0, 200)}`);
        return out;
      }
      if (!Array.isArray(rows)) return out;

      rows.forEach((row, i) => {
        const text = typeof row?.description === 'string' ? row.description.trim() : '';
        if (!text) return;
        // Trust the array's order over the model's own numbering, and fall
        // back to it only when the number is plainly sane. Getting this
        // wrong is how six descriptions landed on the wrong six images.
        const n = Number.isInteger(row.image) && row.image >= 1 && row.image <= shots.length
          ? row.image - 1
          : i;
        if (n < shots.length) out.set(offset + n, text);
      });
    } catch (err) {
      console.error(`[report/analyse] caption batch at ${offset} failed:`, err?.message || err);
    }
    return out;
  };

  // One at a time. Firing every batch at once tripled the request rate at
  // the same instant, and on a free-tier key that reads as a rate limit and
  // comes back as nothing.
  const described = new Map();
  for (const b of batches) {
    const got = await runBatch(b);
    got.forEach((v, k) => described.set(k, v));
  }

  // Whatever is still missing, ask for again -- and ask for exactly the
  // images that are missing, nothing else.
  //
  // A batch is all-or-nothing: one rate limit, one truncated JSON body, one
  // safety filter, and six images come back with nothing while the other six
  // are fine. That is precisely what shipped -- six descriptions, twelve
  // images -- and no amount of tuning the batch size fixes a failure mode
  // that takes the whole batch with it.
  //
  // So: don't tune it, close it. Retry the gaps in smaller groups, then one
  // image at a time. A single-image request is the smallest thing this API
  // will ever be asked for, and by the time we are down to that we are only
  // paying for the frames that actually failed.
  const missingAfter = () => screenshots
    .map((_, i) => i)
    .filter((i) => !described.has(i));

  let gaps = missingAfter();
  // Two passes: threes, then ones. Each pass only sees what the previous
  // one failed to get.
  for (const size of [3, 1]) {
    if (gaps.length === 0 || timeLeft() < 8_000) break;
    console.warn(`[report/analyse] ${gaps.length} image(s) still undescribed; retrying in groups of ${size}.`);
    for (let i = 0; i < gaps.length; i += size) {
      if (timeLeft() < 8_000) break;
      const idxs = gaps.slice(i, i + size);
      // A short breath between requests. The failures this is recovering
      // from are most often a per-minute limit, and hammering it is how the
      // retry becomes part of the problem.
      await new Promise((r) => setTimeout(r, 700));
      const got = await runBatch({
        offset: 0,
        shots: idxs.map((n) => screenshots[n]),
        // A small group needs far less room than a full batch, and a tight
        // ceiling here keeps the whole pass inside its deadline.
        ms: Math.min(30_000, Math.max(8_000, timeLeft() - 2_000)),
      });
      got.forEach((v, k) => {
        const real = idxs[k];
        if (real != null) described.set(real, v);
      });
    }
    gaps = missingAfter();
  }

  const n = described.size;
  if (n < screenshots.length) {
    console.error(`[report/analyse] gave up with ${n}/${screenshots.length} images described; missing indices: ${gaps.join(', ')}`);
  }
  console.log(`[report/analyse] captions: ${n}/${screenshots.length} images described.`);
  return {
    captions: Object.fromEntries(described),
    count: n,
    error: n < screenshots.length ? (lastCaptionError || 'unknown') : '',
  };
}

export async function POST(req) {
  const { screenshots, lat, lon, address, floor, facing, tzOffset, avRecord, combinedScore, unitScore, areaWeight, unitWeight, personaId, customNote, purpose, horizon, priorities, actionItems, skipAi, captionsOnly } = await req.json();
  const persona = personaId ? (await import('@/lib/personas')).getPersona(personaId) : null;

  // purpose/horizon/priorities (and personaId above) come from the verdict
  // page's optional goal / timeline / priorities questions -- see
  // lib/reportQuestions.js for how one "goal" maps onto persona + purpose.
  // Fixed option sets from the UI, not free text, but looked up through a
  // known map anyway rather than trusted as raw strings straight into the
  // prompt -- an unrecognised key is silently dropped instead of printed.
  const PURPOSE_TEXT = {
    buying_to_live: "buying this to live in it themselves",
    buying_to_rent: "buying this to rent it out",
    renting_deciding: "currently renting nearby and deciding whether to buy",
    researching: "just researching and comparing options, nothing decided yet",
  };
  const HORIZON_TEXT = {
    under_3: "under 3 years",
    '3_7': "3 to 7 years",
    '10_plus': "10+ years",
    unsure: "not sure yet",
  };
  const PRIORITY_TEXT = {
    safety: "safety & crime", schools: "schools", sunlight: "sunlight & daylight",
    privacy: "noise & privacy", air: "air quality", connectivity: "connectivity/commute",
    resale: "resale value", price: "price vs. fundamentals",
  };
  const purposeText = PURPOSE_TEXT[purpose] || null;
  const horizonText = HORIZON_TEXT[horizon] || null;
  const safePriorities = Array.isArray(priorities) ? priorities.filter((p) => PRIORITY_TEXT[p]).slice(0, 3) : [];
  const personalizeAnswers = [
    purposeText ? `Why they're looking: ${purposeText}.` : null,
    horizonText ? `How long they plan to stay or hold it: ${horizonText}.` : null,
    safePriorities.length ? `What they said matters most to them, in their own order: ${safePriorities.map((p) => PRIORITY_TEXT[p]).join(', ')}.` : null,
  ].filter(Boolean).join(' ');
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
    ? actionItems.filter(i => i && typeof i.label === 'string' && typeof i.action === 'string').slice(0, 10).map(i => ({
        ...i,
        // What the buyer actually typed after visiting, e.g. "checked at
        // 6pm, hallway is fine but the corner bedroom gets loud". Same cap
        // + sanitizing as customNote above -- free text from the reader,
        // stripped of prompt syntax so it can't smuggle in formatting or
        // section instructions of its own.
        userFinding: typeof i.userFinding === 'string'
          ? i.userFinding.trim().slice(0, 300).replace(/[`*_#]/g, '')
          : '',
      }))
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
GROUND TRUTH (computed from precise solar geometry - treat every number below as fact, do NOT re-derive or override it from the images):
${solarSummary.monthlySummary.map((m) =>
  `${m.month}: Rise ${m.sunrise}, Set ${m.sunset}, Noon elevation ${m.noonElevation}°, Usable sun ${m.usableHours}h, Peak ${m.peakWindow}, Floor ${floorN} ${safeFacingInput}-facing gets sun ${m.floorClearance}`
).join('\n')}
Overall feasibility: ${solarSummary.solarFeasibility.verdict} (avg ${solarSummary.solarFeasibility.avgUsableHours}h/day usable)
Best months: ${solarSummary.solarFeasibility.bestMonths.join(', ')} · Worst months: ${solarSummary.solarFeasibility.worstMonths.join(', ')}
Note: floor clearance is an estimate based on typical urban obstruction heights, not a measurement of this property's actual neighboring buildings. "Peak Window" reflects sky-wide overhead sun timing, not this specific facing direction.`;
  } catch (err) {
    console.error('Failed to compute ground-truth solar summary:', err);
    groundTruthText = '\n(Ground-truth solar computation unavailable - rely more cautiously on visual inspection and say so explicitly.)';
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
      console.error('[report/analyse] GEMINI_API_KEY is not set - sun & shadow images will have no descriptions.');
      return NextResponse.json({ analysis: '', summary: reportSummary, aiUnavailable: true, aiReason: 'not-configured' });
    }

    const { captions, count, error: captionError } = await describeImages({
      screenshots, groundTruthText, floorN, facing: safeFacingInput,
    });

    if (count === 0) {
      console.warn('[report/analyse] no image descriptions came back; shipping the gallery without them.');
      return NextResponse.json({
        analysis: '', captions: {}, summary: reportSummary,
        aiUnavailable: true, aiReason: `captions-empty${captionError ? ` (${captionError})` : ''}`,
      });
    }

    return NextResponse.json({
      analysis: '', captions, summary: reportSummary,
      captionedCount: count, imageCount: screenshots.length, captionError: captionError || undefined,
    });
  }

  // No key configured is a deployment problem, not a busy model, and it
  // will not fix itself on a retry -- say so once and let the report ship
  // with everything that doesn't depend on it.
  if (!process.env.GEMINI_API_KEY) {
    console.error('[report/analyse] GEMINI_API_KEY is not set - shipping the report without the written analysis.');
    return NextResponse.json({
      analysis: '', summary: reportSummary, avRecord: avRecord || null,
      combinedScore: combinedScore ?? null, aiUnavailable: true, aiReason: 'not-configured',
    });
  }

  const neighbourhoodGroundTruth = buildNeighbourhoodGroundTruth(avRecord);
  const hasNeighbourhood = Boolean(avRecord);

  const combinedGroundTruth = hasNeighbourhood ? `
BLINDSPOT OVERALL SCORE: ${combinedScore ?? 'not computed'}/100 - built from the Neighbourhood Score (${avRecord.nqi_composite}/100, weighted ${Math.round((areaWeight ?? 0.5) * 100)}%) and this unit's Home Comfort Score (${unitScore ?? 'not computed'}/100, weighted ${Math.round((unitWeight ?? 0.5) * 100)}%). Treat both of these figures as fact, do not recompute them.` : '';

  // Section numbers. The order is the order someone actually asks their
  // questions in: is this a good buy, what would living here be like, is it
  // for someone like me, and then the two halves in detail.
  const livingSectionNumber = 2;
  const suitsSectionNumber = 3;
  const neighbourhoodSectionNumber = 4;
  // Flat-only reports used to number this 2, colliding with the living
  // section; the PDF's section extractor then split on the wrong header.
  const flatSectionNumber = hasNeighbourhood ? 5 : 4;

  // Each section OWNS a set of facts. The previous prompt had the verdict,
  // "what living here is like", the neighbourhood analysis and the flat
  // analysis all walking through the same light/heat/area points, so a
  // reader met the same finding three or four times in different words.
  // Now every fact has one home; other sections may only point at it.
  const verdictInstruction = hasNeighbourhood
    ? `1. BLINDSPOT SUMMARY
Write this to the person, not about the property. Use "you". No bullets, no lists of numbers, no headings inside it.

Four to five sentences, in the plainest English you have - the way you'd answer a friend who asked "should I buy this?" over the phone. Cover, in this order: what kind of place this is to live in, what this particular flat is like day to day, the one thing that would most worry you about it, and your actual call - worth pursuing, worth pursuing once one thing checks out, or better to keep looking. Commit to one of those three; a verdict that refuses to land is not a verdict.

Name at most two numbers in the whole paragraph, and only where a number says something a word can't. Never open with a score. Never write "the composite", "the index", "NQI", "the dataset" or "our analysis" - they are buying a home, not reading a spreadsheet.
Close with one line starting exactly "- Best fit for: " naming the one or two buyer types this suits best, each with a clause of reasoning.

${livingSectionNumber}. WHAT LIVING HERE IS ACTUALLY LIKE
Three to four sentences, flowing prose, second person. This section is about the AREA's effect on daily life only - the flat's own sunlight, heat and orientation are covered in full in "THE FLAT ITSELF" below, so do not touch them here even briefly.

Turn the neighbourhood figures into a life: what the school situation means for a morning routine, what the crime tier means for coming home late, what the water or power score means for an ordinary week. Ground every claim in a figure from the ground truth above, but write the consequence, not the figure - "supply runs short enough in summer that most societies here bring in tankers" rather than "water scores 45/100".

Do not repeat the verdict's wording or its reasoning. Do not use bullets.

${suitsSectionNumber}. WHO THIS IS FOR
Be useful and be honest - this section is worthless if every type gets a yes.

Take each of these four in turn, as its own "- " line beginning with the type in plain text followed by a colon: Families with school-age kids; Young professionals and couples; People working from home; Older buyers and retirees.

For each, open with a plain verdict - "Yes", "Yes, with one caveat", "Probably not" or "No" - then exactly one sentence of why, tied to a specific figure from the ground truth. Keep every entry short and distinct - do not repeat the same figure or reasoning across two entries.

Then one final "- " line beginning exactly "Main Deal-Breaker: " naming the single biggest risk or limitation of this property as a whole - the one thing most likely to make a buyer walk away - in one plain sentence. This is about the property itself, not a buyer type, and it must not repeat a point already made above in this section.

${neighbourhoodSectionNumber}. NEIGHBOURHOOD FULL ANALYSIS
Three to five sentences. Do NOT restate the ground-truth numbers one by one - they are already shown as bars beside this section, so repeating them adds nothing. Do not repeat a point already made in the Summary or "What Living Here Is Actually Like" above - go deeper into the area than either of those, don't retell them.

Analyse instead: which one or two factors are this area's real strength, which one or two are its real weakness, and what that combination means for someone living here. Weave the specific numbers in as evidence for a point, never as a checklist. Organise around the two or three things that actually matter here rather than touring every field. Cover the price context honestly - whether the band reads as good value for these fundamentals, priced in line, or a premium for the location, and say which.

This section is about the AREA ONLY - no sunlight, no shadows, no talk of this specific unit.`
    : `1. BLINDSPOT SUMMARY
Write this to the person, not about the property. Use "you", plain English, no bullets.

Four to five sentences: what this flat is like to live in for light and comfort day to day, what changes across the year, the one thing that would most worry you, and your actual call - worth pursuing, worth pursuing once one thing checks out, or keep looking. Commit to one.
Close with one line starting exactly "- Best fit for: " naming the one or two buyer types this suits best.

${livingSectionNumber}. WHAT LIVING HERE IS ACTUALLY LIKE
Two to three sentences, flowing prose, second person. Give the overall feel of living with this flat's light and heat - bright and easy, or something that takes managing - without the month-by-month detail, which belongs entirely to "THE FLAT ITSELF" below. Do not repeat the verdict's wording or its reasoning.

${suitsSectionNumber}. WHO THIS IS FOR
Take each of these four in turn as its own "- " line, type then colon: Families with school-age kids; Young professionals and couples; People working from home; Older buyers and retirees. Open each with "Yes", "Yes, with one caveat", "Probably not" or "No", then exactly one sentence of why tied to a real figure, each entry distinct from the others. Finish with a "- Main Deal-Breaker: " line naming the single biggest risk or limitation of this property, in one plain sentence.`;

  // Persona overlay. Appended AFTER the full section list so it wins on any
  // conflict of emphasis, and resolves to '' when no persona is selected --
  // the no-persona prompt is byte-for-byte what it was before personas
  // existed, deliberately. The overlay never adds, removes or renumbers any
  // of the sections above; it only re-slants them and appends ONE extra
  // trailing section, which the generic `N. TITLE` parser in the PDF route
  // picks up as bottom narrative without any change there.
  const personaSectionNumber = hasNeighbourhood ? 6 : 5;
  const ov = persona?.reportOverlay || null;
  const personaOverlay = ov ? `

READER OVERLAY - this applies on top of everything above and overrides it wherever the two pull in different directions.

WHO THIS IS FOR: ${ov.readerLine}

Re-slant the whole report for this reader. Keep every numbered section above exactly as specified - same titles, same numbers, same order, same formatting rules. What changes is emphasis, what leads each section, and which findings get a full paragraph versus one clause.

GIVE MORE SPACE TO: ${ov.weightUp}
GIVE LESS SPACE TO: ${ov.weightDown}

Never announce the slant to the reader. Do not write "as a family buyer" or "for investors like you" or name this persona anywhere. The fit should be felt, not stated. Every re-slanted claim still has to trace to a figure in the ground truth - re-weighting emphasis is not permission to assert anything the data does not support.

TONE FOR THIS READER: ${ov.toneNote}

Then, after all the sections listed above, add exactly one more section:

${personaSectionNumber}. ${ov.sectionTitle}
${ov.sectionBody}` : '';

  // Appended after everything else (including persona overlay, if any) so
  // it always lands as the actual last section regardless of which of the
  // 4 numbering combinations above are in play this time.
  const checklistSectionNumber = (hasNeighbourhood ? 6 : 5) + (ov ? 1 : 0);
  const checklistSection = safeActionItems.length > 0 ? `

${checklistSectionNumber}. WHAT TO VERIFY BEFORE YOU DECIDE
These are already-written, plain-language action lines for the specific dimensions that scored weak enough to be worth a second look in person. For any item WITHOUT a finding below, reuse its action line close to as-is (light rewording for flow is fine, don't invent new ones or drop any) -- it's still a thing to go check. For any item WITH a finding, the reader has already visited and is telling you what they found: write that up as a confirmed observation in their own words (light cleanup for flow is fine, don't soften, contradict, or second-guess it), NOT as a thing still to check -- don't tell the reader to go verify something they just told you they already verified. Render the whole section as a short "- " bulleted list, one line per item, each starting with the dimension name in bold-equivalent plain text then a colon. One short sentence before the list is enough context; no restating of scores or numbers already covered elsewhere in this report.
${safeActionItems.map(i => i.userFinding
  ? `- ${i.label} (${i.score}): confirmed on a visit -- "${i.userFinding}"`
  : `- ${i.label} (${i.score}): ${i.action}`
).join('\n')}` : '';

  const prompt = `You are a solar and neighbourhood intelligence analyst helping a home buyer in India, writing a single combined report for BlindSpot.

Property: ${safeAddressInput} (${latN.toFixed(4)}°N, ${lonN.toFixed(4)}°E)
Unit: Floor ${floorN} (≈${floorN * 3}m height), ${safeFacingInput}-facing
${groundTruthText}
${neighbourhoodGroundTruth}
${combinedGroundTruth}

You also have ${screenshots.length} screenshots of the actual 3D map at this location. They are described one by one elsewhere, in a separate gallery -- do NOT write per-image descriptions here. The orange circle/dot marks the exact property location; darker areas are rendered shadows from OpenStreetMap building data. Use these images ONLY for narrative color and visual confirmation (e.g. "as the images show, a taller block sits to the southeast") - do NOT estimate hours of sun, shadow duration, or building heights from the images; use the ground-truth numbers above for all figures. If a screenshot looks blank, black, or unreadable, say so explicitly rather than guessing what it would show.

Write personally, not clinically - like a knowledgeable friend giving honest advice, not a data report reciting fields. Address the reader as "you" where it reads naturally. Be concise and specific, not padded - every sentence should carry a new fact or a new implication; if a sentence could be cut without losing information, cut it. This report is a defensible artifact a buyer will rely on, not an exhaustive one - make each point once, well, in the section it belongs to, and never explain the same fact, score or implication a second time in a different section.
Plain language throughout, not just the verdict's opening lines: explain any real-estate or technical term the first time it appears (azimuth, NQI, feasibility band, etc.) in a short clause rather than assuming the reader already knows it, and prefer the everyday word over the technical one wherever both say the same thing.
${persona ? `\nWHO'S READING THIS: ${persona.reportFocus}\n` : ''}
${personalizeAnswers ? `\nTHEIR OWN ANSWERS, ASKED RIGHT BEFORE GENERATING THIS REPORT: ${personalizeAnswers}\nUse these to decide what to lead with and dwell on, even where it cuts against the persona default above - if they flagged a priority that isn't normally emphasised for this reader type, still give it real space, since they told you directly it matters to them, which outweighs an assumed default.\n` : ''}
${safeCustomNote ? `\nTHE BUYER'S OWN REQUEST - they typed this themselves right before generating this report, so treat it as the single strongest signal of what they actually care about, above persona defaults or generic coverage: "${safeCustomNote}"\nDirectly address this in the BlindSpot Summary section - do not just mention it in passing, actually answer it using the ground-truth data above. If the data above genuinely doesn't cover what they asked (e.g. they asked about something this report doesn't measure), say so plainly rather than inventing an answer. Never quote their request back verbatim or write "you mentioned" - just make sure the answer is unmistakably there.\n` : ''}

FORMATTING RULES (follow exactly, every time, regardless of location):
- Never use emoji, anywhere, in any section, under any circumstances - not as bullet markers, not as decoration, not inline in a sentence. Plain text only.
- Start each section heading on its own line as "N. TITLE" (plain text, no ** bold markers, no # markdown), using the exact section numbers given below.
- Use plain "- " for bullet points, not "*".
- Do not use markdown bold (**) anywhere except to emphasize a single key figure inline.
- Always include every numbered section below, in order, even if a section is short for this location.
- Never explain the same fact, score, or finding in more than one section. If it must be referenced again later, one short clause is enough - do not re-derive or restate what it means.

Provide, in this exact order:

${verdictInstruction}

${flatSectionNumber}. THE FLAT ITSELF, FLOOR ${floorN} FACING ${safeFacingInput.toUpperCase()}
This is the only section that goes deep on this flat's sunlight, heat and orientation - nothing above repeats it, so give the full picture here. Height and orientation are one story, not two - write them as one. Cover, in plain everyday English and in this order:
- What a day in this flat is actually like for light. When the sun first reaches it, when it leaves, and how many usable hours that is, using the ground-truth figures.
- How that changes across the year. Name the best and worst months by name and say what the difference feels like to live in, not just the hour count.
- Whether ${safeFacingInput}-facing is a good or bad orientation at this latitude and on this floor, with the reasoning spelled out in ordinary words - no azimuth or elevation figures unless you immediately explain what they mean.
- Heat as well as light. A facing that is generous with winter sun may be punishing in May; say which side of that this flat falls on.
- What practically follows: whether this flat needs lights on during the day, whether the afternoon side will need blinds or heavy curtains, and whether a different floor in this same building would meaningfully change the answer.
Say each of these once, plainly - don't restate one bullet's point while covering the next. Write it as flowing paragraphs, not as the bulleted list above - those bullets are your coverage checklist, not the shape of the section.${personaOverlay}${checklistSection}`;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { analysis: 'Server is missing GEMINI_API_KEY - cannot run AI shadow analysis.' },
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
    // The written report is the long job: 12 images in, several thousand
    // words out. It gets most of the route's 120s (captions run alongside
    // on their own, smaller budget) and up to 70s for a single attempt --
    // the current Flash model can need well over the old 40s ceiling.
    const { call: callGemini, left, state: aiState } = geminiCaller({ budgetMs: 88_000, attemptMs: 70_000 });

    // The twelve image descriptions are their own batched job now, started
    // here so it runs alongside the narrative rather than after it. Asking
    // for them inside the report is what let one long shadow section eat the
    // budget the other five sections needed.
    // Staggered, not simultaneous. Both this and the narrative call go to
    // the same key and the same per-minute quota; starting them in the same
    // instant is how a burst turns into a 429 that neither of them needed.
    const captionsPromise = new Promise((r) => setTimeout(r, 1_500))
      .then(() => describeImages({
        // Runs alongside the written report, inside the route's 120s.
        screenshots, groundTruthText, floorN, facing: safeFacingInput, budgetMs: 80_000,
      }))
      .catch((err) => {
        console.error('[report/analyse] image descriptions failed:', err?.message || err);
        return { captions: {}, count: 0 };
      });

    let data = await callGemini(contents);
    if (!data) {
      // The narrative didn't come back, but the image descriptions may well
      // have -- they are a different, smaller job. Ship what landed.
      const caps = await captionsPromise;
      return NextResponse.json({
        analysis: '', captions: caps.captions || {}, captionedCount: caps.count, captionError: caps.error || undefined,
        summary: reportSummary,
        avRecord: avRecord || null,
        combinedScore: combinedScore ?? null,
        aiUnavailable: true,
        aiReason: `busy${aiState.lastError ? ` (${aiState.lastError})` : ''}`,
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
        analysis: '', captions: capsOnly.captions || {}, captionedCount: capsOnly.count, captionError: capsOnly.error || undefined,
        summary: reportSummary,
        avRecord: avRecord || null,
        combinedScore: combinedScore ?? null,
        aiUnavailable: true,
        aiReason: finishReason ? `stopped: ${finishReason}` : 'empty',
      });
    }

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Analysis still truncated after continuations, shipping partial text with a note.');
      analysis += '\n\n*(Note: this analysis was cut short by a length limit - the data table above remains fully accurate.)*';
    }

    const caps = await captionsPromise;

    return NextResponse.json({
      analysis, captions: caps.captions || {}, summary: reportSummary,
      avRecord: avRecord || null, combinedScore: combinedScore ?? null,
      captionedCount: caps.count, imageCount: screenshots.length, captionError: caps.error || undefined,
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
