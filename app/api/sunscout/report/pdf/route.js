// app/api/sunscout/report/pdf/route.js
// Accepts screenshots + a deterministic monthly summary + AI analysis and
// builds the HTML report. The table renders straight from computed data so
// the buyer always gets real numbers even if the AI narrative is short/empty.
//
// v5 -- re-themed to match BlindSpot's actual site palette (cream/ink/sun/
// wine, from app/globals.css) instead of SunScout's standalone orange/black
// theme, uses the real BlindSpot logo mark instead of a generic sun icon,
// gives the Neighbourhood and Sun & Shadow sections equal visual weight,
// and fixes the section-header numbering (which used to start at "3." or
// "4." once Verdict/Neighbourhood were pulled out ahead of it) by dropping
// numbers from in-report headers entirely -- each section already has its
// own card and icon, so a number added nothing but confusion.
//
// v4 history -- fixes the blank-PDF bug:
// html2pdf.js (v2/v3) renders the ENTIRE report as one giant html2canvas
// canvas, then slices that single image across PDF pages. With 12 large
// screenshots plus long per-image text, that canvas can exceed the
// browser's max canvas size (Chrome caps around 16384px in one dimension,
// or ~268 megapixels total) — past that limit, html2canvas silently
// produces a blank or corrupted image, so the exported PDF comes out blank
// even though everything looks fine on screen.
//
// Fix: render one smaller canvas PER LOGICAL PAGE (`.pdf-page` sections
// below) instead of one canvas for the whole document, each well under the
// size limit, then place each onto its own jsPDF page (slicing further if a
// section is itself taller than one A4 page). Uses html2canvas + jsPDF
// directly instead of the html2pdf.js wrapper, for that per-section control.

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

// This route builds HTML for 12 embedded screenshots plus the full written
// analysis -- give it the same generous headroom as the analyse route so a
// slow-but-fine build doesn't get killed by the platform default timeout.
export const maxDuration = 60;

// -- BlindSpot theme (mirrors the CSS vars in app/globals.css) --------------
const BG        = '#FAF6EE'; // --bg
const CARD      = '#F1E9DA'; // --bg-2
const LINE      = '#E3D9C4'; // solid approximation of --line for canvas-safe rendering
const LINE_SOFT = '#EDE4D2'; // solid approximation of --line-soft
const INK       = '#1C1812'; // --ink / --text
const MUTE      = '#5A5140'; // --text-mute
const DIM       = '#726A54'; // --text-dim
const SUN       = '#C9812E'; // --sun
const WINE      = '#6B2430'; // --slate (BlindSpot's deep wine accent)
const GRADIENT  = `linear-gradient(90deg, ${SUN}, ${WINE})`;
const GOOD = '#2F7D4F', OK = '#B08D2B', POOR = '#B14B4B';
const DISPLAY = "'Space Grotesk', Arial, sans-serif";

let MARK_BASE64 = null;
function getMarkDataUri() {
  if (MARK_BASE64) return MARK_BASE64;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'mark.png'));
    MARK_BASE64 = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    MARK_BASE64 = '';
  }
  return MARK_BASE64;
}

// Escapes text before it goes into the report HTML. Without this, anything
// a person types into the address/nickname fields -- or, less likely but
// still possible, text the AI model generates -- gets inserted into the
// page verbatim. Since the address field is free text and reports can be
// shared via URL, an unescaped '<script>' there would execute in whoever
// opens that shared report.
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Pulls the "@N@ description" lines Gemini emits for the shadow-analysis
 *  section and returns { perImage: {index -> text}, rest: analysis text
 *  with that section stripped }. */
function splitPerImageAnalysis(analysis, shotCount) {
  const perImage = {};
  const lineRegex = /^@(\d+)@\s*(.+)$/gm;
  let m;
  while ((m = lineRegex.exec(analysis))) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < shotCount) perImage[idx] = m[2].trim();
  }

  // Strip the shadow-analysis header line (whatever number Gemini gave it)
  // and every @N@ line so the bottom narrative doesn't repeat what's now
  // shown under each screenshot. If Gemini didn't follow the @N@ format
  // (imperfect compliance), nothing matches above and nothing is stripped
  // here — the full text just falls through to the bottom narrative as a
  // safe fallback.
  const rest = analysis
    .replace(/^\d+\.\s*SHADOW ANALYSIS[^\n]*\n?/im, '')
    .replace(/^@\d+@.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { perImage, rest };
}

// Pulls one named section (matched by title regex, e.g. /home\s*buyer\s*verdict/i)
// out of the numbered-section text Gemini returns, and hands back both that
// section's body and the remaining text with it removed -- so the caller can
// render that section as its own styled block instead of folding it into the
// generic bottom narrative.
function extractSection(text, titleRegex) {
  const headerRegex = /^(\d+)\.\s+(.+)$/gm;
  const matches = [];
  let hm;
  while ((hm = headerRegex.exec(text))) matches.push(hm);
  if (matches.length === 0) return { body: '', rest: text };

  const idx = matches.findIndex(m => titleRegex.test(m[2]));
  if (idx === -1) return { body: '', rest: text };

  const start = matches[idx].index + matches[idx][0].length;
  const end = idx + 1 < matches.length ? matches[idx + 1].index : text.length;
  const body = text.slice(start, end).trim();
  const rest = (text.slice(0, matches[idx].index) + text.slice(end)).replace(/\n{3,}/g, '\n\n').trim();
  return { body, rest };
}

// Pure reordering, not a rewrite: moves the "Home Buyer Verdict" section to
// the front, without touching a single word of what Gemini actually wrote.
// (No longer renumbers -- formatNarrative strips numbers from headers
// entirely now, see below, so reordering doesn't need to keep numbers in
// sync.) If no numbered sections are found (or no verdict section exists),
// the text is returned completely unchanged.
function moveVerdictFirst(text) {
  const headerRegex = /^(\d+)\.\s+(.+)$/gm;
  const matches = [];
  let hm;
  while ((hm = headerRegex.exec(text))) matches.push(hm);
  if (matches.length === 0) return text;

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({ title: matches[i][2].trim(), body: text.slice(start, end) });
  }

  const verdictIdx = sections.findIndex(s => /home\s*buyer\s*verdict/i.test(s.title));
  if (verdictIdx === -1) return text;

  const reordered = [sections[verdictIdx], ...sections.filter((_, i) => i !== verdictIdx)];
  return reordered.map(s => `1. ${s.title}${s.body}`.trimEnd()).join('\n\n').trim();
}

// Property marker overlay -- plain dot in the BlindSpot sun accent, shown on
// every screenshot. Deliberately NOT using an SVG + CSS transform for
// centering: that combination is a known html2canvas failure point (it can
// silently drop transform-positioned elements when rasterizing for the PDF
// export, which is why an earlier crosshair vanished from the downloaded
// file even when visible on screen). Plain flexbox centering has no
// transform to lose, so it survives the canvas render.
const PROPERTY_MARKER_HTML = `
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
    <div style="width:10px;height:10px;border-radius:50%;background:${SUN};border:3px solid #fff;box-shadow:0 0 0 3px rgba(201,129,46,0.5),0 2px 8px rgba(0,0,0,0.5);"></div>
  </div>`;

// Shared narrative formatter -- turns Gemini's plain-text section body
// (numbered sub-headers, "- " bullets, occasional **bold**) into report
// HTML. Used for the verdict block, the neighbourhood block, and the
// remaining floor/facing narrative, so all three read consistently. Numbers
// are stripped from sub-headers on purpose: once Home Buyer Verdict and
// Neighbourhood Full Analysis are pulled out into their own cards above,
// whatever's left starts mid-sequence ("4. FLOOR...", "5. ...FACING...")
// which reads as a numbering bug -- each section already has its own card
// and icon, so the number added nothing but confusion.
function formatNarrative(rawAnalysis, { dropLeadingHeader = false } = {}) {
  // Each section already has its own heading in the document, so the model's
  // own restatement of it ("THE FLAT ITSELF, FLOOR 7 FACING SOUTH-EAST")
  // reads as a duplicate heading two lines under the real one.
  const src = dropLeadingHeader
    ? rawAnalysis.replace(/^\s*(?:\d+\.\s*)?[A-Z][A-Z0-9 ,&'\/-]{6,}\s*$/m, '').trim()
    : rawAnalysis;
  return src
    .replace(/^\d+\.\s*(.+)$/gm, `<h3 style="font-size:16px;font-weight:700;color:${INK};margin:24px 0 10px;font-family:${DISPLAY};">$1</h3>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, `<li style="margin-bottom:8px;color:${MUTE};line-height:1.75;font-size:14.5px;">$1</li>`)
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:0 0 16px;padding-left:20px;">${m}</ul>`)
    .replace(/\n\n/g, `</p><p style="margin:0 0 14px;color:${MUTE};line-height:1.85;font-size:14.5px;font-family:Arial,sans-serif;">`)
    .replace(/^/, `<p style="margin:0 0 14px;color:${MUTE};line-height:1.85;font-size:14.5px;font-family:Arial,sans-serif;">`)
    .replace(/$/, '</p>')
    .replace(/<p[^>]*><\/p>/g, '');
}

export async function POST(req) {
  const {
    lat, lon, address, floor, facing, screenshots, analysis, summary,
    // Per-image descriptions, keyed by the image's index. They used to be
    // smuggled through `analysis` as "@N@ ..." lines and pulled back out
    // with a regex here -- a guess about the model's formatting that, when
    // it was wrong, silently produced a gallery with no descriptions at all.
    captions,
    reportLabel,
    facingAssumptionNote,
    avRecord, combinedScore, unitScore, areaWeight, unitWeight,
    unitSubScores, verdictLabel,
    // aiUnavailable: the model didn't answer this time. Everything below
    // that is computed rather than written still renders; only the prose
    // is missing, and the report says so instead of showing a gap.
    aiUnavailable,
    // galleryOnly: this run was asked for the sun & shadow document alone,
    // so the gallery is the artifact, not an appendix to a report that
    // exists in another tab.
    galleryOnly,
     // optional short label/nickname for the report, e.g. "Skyline Residences · Unit 502"
  } = await req.json();

  // Escape every value that's either directly user-typed (address,
  // reportLabel) or model-generated (analysis, and a couple of summary
  // fields) before any of it touches the HTML template below.
  const safeAddress = escapeHtml(address);
  const safeReportLabel = reportLabel ? escapeHtml(reportLabel) : '';
  const safeFacing = escapeHtml(facing);
  const safeFloor = escapeHtml(floor);
  const safeFacingAssumptionNote = facingAssumptionNote ? escapeHtml(facingAssumptionNote) : undefined;
  // Safety net: the prompt in analyse/route.js tells Gemini never to use
  // emoji, but model instructions aren't guaranteed -- strip any pictograph
  // emoji from the AI's own text server-side so the report can't end up
  // with them even if the model doesn't comply.
  const stripEmoji = (s) => s ? s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}]/gu, '').replace(/[ \t]{2,}/g, ' ') : s;
  const safeAnalysis = stripEmoji(escapeHtml(analysis));
  if (summary?.solarFeasibility?.verdict) summary.solarFeasibility.verdict = escapeHtml(summary.solarFeasibility.verdict);
  if (summary?.buildingHeightNote?.sentence) summary.buildingHeightNote.sentence = escapeHtml(summary.buildingHeightNote.sentence);

  const hasNeighbourhood = Boolean(avRecord);
  const safeAreaName = hasNeighbourhood ? escapeHtml(avRecord.name || avRecord.pin_code) : '';
  const markDataUri = getMarkDataUri();

  const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  const shotCount = screenshots?.length || 0;

  const perImage = {};
  if (captions && typeof captions === 'object') {
    for (const [k, v] of Object.entries(captions)) {
      const i = parseInt(k, 10);
      if (Number.isInteger(i) && i >= 0 && i < shotCount && typeof v === 'string' && v.trim()) {
        perImage[i] = stripEmoji(escapeHtml(v.trim()));
      }
    }
  }
  // Any stray marker lines from an older response shape are stripped rather
  // than left to show up mid-paragraph.
  const rawRest = safeAnalysis.replace(/^@\d+@.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  // Strip markdown header wrapping (## headers, **N. TITLE** bold headers)
  // BEFORE trying to detect section boundaries below -- moveVerdictFirst /
  // extractSection look for plain "N. TITLE" lines, and a header Gemini
  // wrote as "**2. FLOOR 5 SPECIFIC ANALYSIS**" wouldn't match that (it
  // starts with ** not a digit), so the whole section would silently get
  // swallowed into whichever section came before it instead of being
  // recognized as its own boundary.
  const cleanedRest = rawRest
    .replace(/^#{1,4}\s*(.+)$/gm, '$1')
    .replace(/^\*\*(\d+\.\s.+?)\*\*\s*$/gm, '$1')
    .replace(/^\*\s+/gm, '- ');

  // Combined reports (avRecord present) already ask Gemini for Home Buyer
  // Verdict as section 1 and Neighbourhood Full Analysis as section 2 --
  // pull both out to render as their own styled blocks up top. Whatever's
  // left (floor + facing narrative) still goes into the Sun & Shadow box
  // alongside the monthly table & screenshots, same as the unit-only report
  // always did.
  const { body: verdictBody, rest: afterVerdict } = hasNeighbourhood
    ? extractSection(cleanedRest, /home\s*buyer\s*verdict/i)
    : { body: '', rest: moveVerdictFirst(cleanedRest) };
  // The section that only a combined report can write -- the two halves read
  // against each other. Pulled out to sit directly under the verdict, where
  // the question "so is this a good area with a dark flat, or the reverse?"
  // is the one actually being asked.
  // What it is like to live here -- the section that turns figures into a
  // life, and the reason anyone reads past the verdict.
  const { body: livingBody, rest: afterLiving } = extractSection(afterVerdict, /living here|what it.s like/i);
  // Who it suits, and who it doesn't. Rendered as its own block because a
  // buyer's first real question is "is this for someone like me".
  const { body: suitsBody, rest: afterSuits } = extractSection(afterLiving, /who this is for|who it.s for/i);
  const { body: togetherBody, rest: afterTogether } = hasNeighbourhood
    ? extractSection(afterSuits, /read\s*together|area and the flat/i)
    : { body: '', rest: afterSuits };
  const { body: neighbourhoodBody, rest: afterNeighbourhood } = hasNeighbourhood
    ? extractSection(afterTogether, /neighbourhood full analysis/i)
    : { body: '', rest: afterTogether };

  // The model's closing "what to check when you visit" section, lifted out
  // so it reads as a checklist under its own heading instead of trailing off
  // the end of the sun & shadow paragraphs.
  const { body: checkBody, rest: afterCheck } = extractSection(afterNeighbourhood, /what to check|before you visit|before you decide/i);

  const rawAnalysis = afterCheck;

  // The AI verdict ends with one "- Best fit for: ..." line (per the prompt
  // in analyse/route.js) -- pull it out to show as its own "Ideal For" strip
  // next to Pros/Cons, instead of leaving it buried at the end of the
  // Home Buyer Verdict paragraph where it's easy to miss.
  let idealForText = '';
  const verdictBodyMinusIdeal = verdictBody.replace(/^-\s*Best fit for:\s*(.+)$/im, (_, captured) => {
    idealForText = captured.trim();
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();

  const formattedVerdictBody = verdictBodyMinusIdeal ? formatNarrative(verdictBodyMinusIdeal) : '';
  const formattedNeighbourhoodBody = neighbourhoodBody ? formatNarrative(neighbourhoodBody) : '';
  const formattedTogetherBody = togetherBody ? formatNarrative(togetherBody) : '';
  const formattedLivingBody = livingBody ? formatNarrative(livingBody) : '';
  const formattedAnalysis = formatNarrative(rawAnalysis, { dropLeadingHeader: true });

  // ---- Deterministic Consumer Scorecard + Pros/Cons -------------------
  // Everything below is computed straight from real numbers already in
  // hand (AsliVastu factor scores, the solar ground-truth summary, and the
  // Home Comfort sub-scores) -- no AI involved, same principle as the
  // monthly table and factor bars elsewhere in this report.
  const FACTOR_LABELS = { crime:'Crime', infrastructure:'Infrastructure', air:'Air Quality', power:'Power', schools:'Schools', water:'Water', roads:'Roads', sewerage:'Sewerage' };
  const shadeHeatSub = unitSubScores?.find(s => s.key === 'shadeHeat') || null;
  const windSub = unitSubScores?.find(s => s.key === 'wind') || null;

  function gradeColor(score) {
    return score >= 70 ? GOOD : score >= 40 ? OK : POOR;
  }

  // The nine-tile "consumer scorecard" that used to sit here has gone. It
  // restated the same numbers the area and flat sections carry, in derived
  // labels a reader had no way to check ("Indoor Plants: Good"), and it was
  // the single most cluttered thing in the report.

  const pros = [], cons = [];
  if (hasNeighbourhood && avRecord.scores) {
    for (const [key, label] of Object.entries(FACTOR_LABELS)) {
      const v = avRecord.scores[key];
      if (v == null) continue;
      // "Schools is excellent" -- half these labels are plural, so the verb
      // has to come off the label rather than being assumed singular.
      const PLURAL = new Set(['schools', 'roads']);
      const verb = PLURAL.has(key) ? 'are' : 'is';
      if (v >= 80) pros.push(`${label} ${verb} excellent (${v}/100)`);
      else if (v < 50) cons.push(`${label} ${verb} weak (${v}/100)`);
    }
  }
  if (summary?.solarFeasibility) {
    const { bestMonths, avgUsableHours } = summary.solarFeasibility;
    if (avgUsableHours >= 6) pros.push(`Strong sun exposure through ${bestMonths.join('/')}`);
    const zero = summary.monthlySummary.filter(m => m.usableHours === 0);
    if (zero.length) cons.push(`No direct sun ${zero[0].month}${zero.length > 1 ? `–${zero[zero.length-1].month}` : ''} (${zero.length} month${zero.length > 1 ? 's' : ''})`);
  }
  if (shadeHeatSub) {
    if (shadeHeatSub.score >= 70) pros.push('Naturally well-shaded, low summer heat gain');
    else if (shadeHeatSub.score < 40) cons.push('High summer heat-gain risk');
  }
  if (windSub) {
    if (windSub.score >= 70) pros.push('Good natural ventilation potential');
    else if (windSub.score < 40) cons.push('Limited ventilation potential');
  }

  const VERDICT_BADGE = {
    'Prime Pick': { text: 'RECOMMENDED', color: GOOD },
    'Hidden Gem': { text: 'RECOMMENDED WITH CAUTION', color: OK },
    'Location Play': { text: 'RECOMMENDED WITH CAUTION', color: OK },
    'Reconsider': { text: 'NOT RECOMMENDED', color: POOR },
  };
  const badge = verdictLabel ? (VERDICT_BADGE[verdictLabel] || { text: escapeHtml(verdictLabel).toUpperCase(), color: SUN }) : null;

  const seasons = ['Summer', 'Winter', 'Spring', 'Autumn'];
  const shotsWithIndex = screenshots.map((s, i) => ({ ...s, idx: i }));
  const grouped = seasons.map(s => ({
    season: s,
    shots: shotsWithIndex.filter(sc => sc.label.startsWith(s)),
  })).filter(g => g.shots.length > 0);

  // Each season is its own `.pdf-page` -- kept as separate, moderately-sized
  // canvases when exporting (see the script at the bottom).
  //
  // The description is the point of this document, not a caption under a
  // picture, so it is set as body text at reading size and given the room
  // to be read. The time of day belongs on the image; the season belongs to
  // the group; neither needs repeating in the text.
  const screenshotPages = grouped.map((g) => `
    <div class="pdf-page" style="padding:38px 32px 30px;background:#fff;">
      <div style="display:flex;align-items:baseline;gap:12px;padding-bottom:11px;border-bottom:2px solid ${INK};margin-bottom:24px;">
        <h3 style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${INK};letter-spacing:-.01em;">${g.season}</h3>
        <span style="font-size:12.5px;color:${DIM};">${g.shots.map(sc => sc.label.split(' · ')[1] || sc.label).join(' · ')}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:34px;">
        ${g.shots.map((shot) => `
          <div class="shot-card">
            <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px;">
              <span style="font-family:${DISPLAY};font-size:17px;font-weight:800;color:${SUN};">${shot.label.split(' · ')[1] || shot.label}</span>
              <span style="font-size:12px;color:${DIM};">${g.season} · floor ${safeFloor}, facing ${safeFacing}</span>
            </div>
            <div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#0A0C10;position:relative;border:1px solid ${LINE};">
              <img src="${shot.base64}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="The block at ${shot.label}"/>
              ${PROPERTY_MARKER_HTML}
            </div>
            ${perImage[shot.idx]
              ? `<p style="font-size:15px;color:${INK};line-height:1.85;margin-top:13px;max-width:70ch;">${perImage[shot.idx]}</p>`
              : `<p style="font-size:13.5px;color:${DIM};line-height:1.75;margin-top:13px;">No description came back for this frame this time. The image and the sunlight figures for this month are unaffected — generating the report again usually fills it in.</p>`}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // (Overall Sun Verdict / Best / Worst months used to be their own card
  // row here -- now folded into the Consumer Scorecard's "Sunlight" card
  // and the best/worst-months line inside the Sun & Shadow section below,
  // so this doesn't repeat itself as a third place showing the same thing.)


  const monthlyTableSection = summary?.monthlySummary ? `
    <h2 style="font-size:16px;font-weight:800;color:${INK};margin:0 0 14px;font-family:${DISPLAY};">Monthly Sunlight Data</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;margin-bottom:12px;">
      <thead>
        <tr style="background:${CARD};">
          ${['Month','Sunrise','Sunset','Noon Elevation','Usable Sun','Peak Window',`Floor ${safeFloor} Clearance`]
            .map(h => `<th style="text-align:left;padding:9px 10px;border-bottom:2px solid ${LINE};color:${WINE};font-weight:700;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${summary.monthlySummary.map((m, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#FBF8F1'};">
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};font-weight:700;color:${INK};">${m.month}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.sunrise}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.sunset}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.noonElevation}°</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.usableHours}h</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.peakWindow}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${LINE_SOFT};color:${MUTE};">${m.floorClearance}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Honesty line: real OSM data-completeness check, not a canned disclaimer -->
    ${summary.buildingHeightNote ? `
    <div style="display:flex;gap:8px;align-items:flex-start;background:#FBF8F1;border:1px dashed ${LINE};padding:11px 15px;margin-bottom:24px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${DIM}" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><circle cx="12" cy="7.5" r="0.5" fill="${DIM}"/></svg>
      <div style="font-size:11.5px;color:${DIM};line-height:1.6;">${summary.buildingHeightNote.sentence}</div>
    </div>` : ''}
  ` : '';

  // Simple bar chart for the main report -- the full numeric table (above)
  // now lives in the gallery/appendix only, so the main report stays quick
  // to read: one glance at the shape of the year instead of a 12-row table.
  // Pure CSS (flex + divs), no chart library, so it renders identically in
  // the browser and in html2canvas for the PDF export.
  const sunBarChart = summary?.monthlySummary ? (() => {
    const months = summary.monthlySummary;
    const max = Math.max(...months.map(m => m.usableHours), 1);
    const bars = months.map(m => {
      const pct = m.usableHours > 0 ? Math.max(4, Math.round((m.usableHours / max) * 100)) : 2;
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:110px;">
          <div style="font-size:9.5px;color:${DIM};margin-bottom:4px;">${m.usableHours > 0 ? m.usableHours.toFixed(1) + 'h' : ''}</div>
          <div style="width:65%;height:${pct}%;background:${m.usableHours > 0 ? SUN : LINE};min-height:2px;"></div>
        </div>`;
    }).join('');
    const labels = months.map(m => `<div style="flex:1;text-align:center;font-size:9.5px;color:${DIM};">${m.month.slice(0,3)}</div>`).join('');
    return `
      <div style="margin:14px 0 16px;">
        <div style="font-size:11.5px;font-weight:700;color:${INK};margin-bottom:10px;">Usable Sun Hours by Month</div>
        <div style="display:flex;align-items:flex-end;gap:3px;">${bars}</div>
        <div style="display:flex;gap:3px;border-top:1px solid ${LINE};padding-top:6px;margin-top:4px;">${labels}</div>
      </div>`;
  })() : '';

  const PIN_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;"><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`;

  const labelPill = reportLabel ? `
    <div style="display:inline-flex;align-items:center;gap:7px;background:${GRADIENT};color:#fff;font-size:12.5px;font-weight:700;padding:7px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(107,36,48,0.25);">
      ${PIN_SVG} ${safeReportLabel}
    </div>` : '';

  // Said once, plainly, where the writing would have been. The numbers
  // around it were computed here and are not affected.
  const aiNote = `
    <div style="border-left:3px solid ${DIM};background:${CARD};padding:14px 18px;margin-bottom:22px;">
      <div style="font-size:14px;color:${INK};line-height:1.75;">
        The written sections could not be generated this time, so this report has the measurements without the
        narration. Everything computed is still here and unaffected: both scores and how they combine, the
        strengths and concerns, the sunlight figures and the ${shotCount || 12} map images.
        Generating it again usually brings the writing back.
      </div>
    </div>`;

  // How the two halves relate, computed here rather than written, so it is
  // present and consistent with the numbers even when the narrative isn't.
  const togetherRead = (() => {
    if (!hasNeighbourhood || typeof unitScore !== 'number') return null;
    const a = avRecord.nqi_composite;
    const u = unitScore;
    const gap = a - u;
    if (gap >= 15) return {
      headline: 'A stronger area than flat',
      line: `The neighbourhood scores ${a} and this flat ${u} — the area is carrying this one. That gap is the half you can still do something about: a different floor or facing in this same building changes the flat, nothing changes the area.`,
    };
    if (gap <= -15) return {
      headline: 'A better flat than area',
      line: `This flat scores ${u} against a neighbourhood of ${a} — a comfortable home in a weaker locality. The flat is the good news, and it is the half that stays good; the area is the half no unit in this building escapes.`,
    };
    if (a >= 65 && u >= 65) return {
      headline: 'Both halves agree, and both are strong',
      line: `Area ${a}, flat ${u}. Neither is being propped up by the other — this is the uncomplicated case, and the checks below are ordinary diligence rather than doubts.`,
    };
    if (a < 50 && u < 50) return {
      headline: 'Both halves agree, and both are weak',
      line: `Area ${a}, flat ${u}. Neither side rescues the other, so a better floor or facing here would not be enough on its own.`,
    };
    return {
      headline: 'Both halves land in the middle',
      line: `Area ${a}, flat ${u}. Close enough that neither is clearly the problem, which usually means the decision comes down to the specific things in the checklist below.`,
    };
  })();

  // ---- One report, laid out as a document ------------------------------
  //
  // What this replaced: a stack of nine bordered cards -- a combined-score
  // strip, a verdict box, a nine-tile "consumer scorecard", a pros/cons/ideal
  // grid, a neighbourhood card, a sun card, each with its own border, icon
  // and heading weight. Everything looked equally important, which is the
  // same as nothing looking important, and the reader had to work out the
  // order themselves.
  //
  // Now: one column, one type scale, and borders spent only where something
  // genuinely is a separate object. The verdict leads because it is what
  // people read; the numbers behind it follow in the order someone would
  // ask for them.

  const H2 = `font-family:${DISPLAY};font-size:13px;font-weight:800;color:${WINE};text-transform:uppercase;letter-spacing:.11em;margin-bottom:14px;`;
  const RULE = `border-top:1px solid ${LINE};margin:34px 0 26px;`;
  const LEAD = `font-size:15.5px;line-height:1.8;color:${INK};`;

  const scoreWord = (n) => n >= 80 ? 'Excellent' : n >= 60 ? 'Good' : n >= 40 ? 'Fair' : 'Poor';

  // The opening. One number, one word, and the written verdict under it --
  // not a strip of three stat cards competing with a box.
  const topScore = hasNeighbourhood ? combinedScore : unitScore;
  const openingSection = `
    <div style="margin-bottom:30px;">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-family:${DISPLAY};font-size:64px;font-weight:800;line-height:1;color:${INK};">${topScore ?? '-'}</span>
        <span style="font-family:${DISPLAY};font-size:26px;font-weight:800;color:${gradeColor(topScore ?? 0)};">${topScore != null ? scoreWord(topScore) : ''}</span>
        <span style="font-size:12.5px;color:${DIM};">out of 100 &middot; ${hasNeighbourhood ? 'the area and the flat together' : 'this flat'}</span>
      </div>
      ${hasNeighbourhood ? `
      <div style="font-size:12.5px;color:${DIM};margin-bottom:${formattedVerdictBody ? '20px' : '0'};">
        ${escapeHtml(avRecord.name || avRecord.pin_code)} scores ${avRecord.nqi_composite} and weighs ${Math.round((areaWeight ?? 0.5) * 100)}%;
        this flat scores ${unitScore ?? '-'} and weighs ${Math.round((unitWeight ?? 0.5) * 100)}%.
      </div>` : ''}
      ${formattedVerdictBody ? `<div style="${LEAD}">${formattedVerdictBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`).replace(/font-size:14.5px/g, 'font-size:15.5px')}</div>` : ''}
      ${idealForText ? `
      <div style="margin-top:18px;padding:13px 16px;background:${CARD};font-size:14px;color:${INK};line-height:1.7;">
        <span style="font-weight:700;">Best suited to:</span> ${idealForText}
      </div>` : ''}
    </div>`;

  // Set larger than the rest and given its own rule: this is the part a
  // person reads twice, and it was previously buried mid-paragraph in a
  // section about scoring.
  const livingSection = formattedLivingBody ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">What living here is actually like</div>
      <div style="font-size:16.5px;line-height:1.85;color:${INK};">
        ${formattedLivingBody
          .replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`)
          .replace(/font-size:14.5px/g, 'font-size:16.5px')}
      </div>
    </div>` : '';

  // Who it suits. The model returns one "- Type: verdict + reasoning" line
  // per buyer type, plus a closing "- Not for: ...". Split so each reads as
  // a row with its own answer, rather than a wall of bullets.
  const suitRows = (suitsBody || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      const line = l.slice(2).trim();
      const i = line.indexOf(':');
      if (i < 0) return null;
      const who = line.slice(0, i).trim();
      const rest = line.slice(i + 1).trim();
      const m = rest.match(/^(Yes(?:\s*[,-]?\s*(?:but|with|if)[^.]*)?|No|Probably not|Not really|Not for)\b[.,]?\s*/i);
      return {
        who,
        call: m ? m[1].trim() : '',
        why: m ? rest.slice(m[0].length).trim() : rest,
        negative: /^not for\b/i.test(who),
      };
    })
    .filter(Boolean);

  const callColor = (c) => {
    const t = (c || '').toLowerCase();
    if (t.startsWith('yes') && !t.includes('caveat')) return GOOD;
    if (t.startsWith('yes')) return OK;
    return POOR;
  };

  const suitsSection = suitRows.length ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">Who this one is for</div>
      <p style="font-size:13px;color:${DIM};margin-bottom:18px;">The same flat is a good buy for one person and the wrong buy for another. This is our honest read of which is which.</p>
      <div style="display:flex;flex-direction:column;">
        ${suitRows.filter(r => !r.negative).map((r) => `
          <div style="display:flex;gap:16px;padding:14px 0;border-top:1px solid ${LINE_SOFT};align-items:baseline;flex-wrap:wrap;">
            <div style="flex:0 0 190px;min-width:150px;">
              <div style="font-size:15px;font-weight:700;color:${INK};line-height:1.4;">${r.who}</div>
              ${r.call ? `<div style="font-size:12.5px;font-weight:700;color:${callColor(r.call)};margin-top:3px;">${r.call}</div>` : ''}
            </div>
            <div style="flex:1;min-width:240px;font-size:14.5px;color:${MUTE};line-height:1.75;">${r.why}</div>
          </div>`).join('')}
      </div>
      ${suitRows.filter(r => r.negative).map((r) => `
        <div style="margin-top:18px;padding:14px 17px;background:${CARD};border-left:3px solid ${POOR};">
          <div style="font-size:12px;font-weight:700;color:${POOR};text-transform:uppercase;letter-spacing:.09em;margin-bottom:5px;">Not for</div>
          <div style="font-size:14.5px;color:${INK};line-height:1.75;">${r.why || r.who}</div>
        </div>`).join('')}
    </div>` : '';

  // The two halves read against each other -- the one thing a combined
  // report can say that neither half can. Two bars, one headline, the model's
  // reading underneath.
  const bar = (label, value, color) => `
    <div style="flex:1;min-width:170px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;color:${DIM};margin-bottom:5px;">
        <span>${label}</span>
        <span style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:${INK};">${value}</span>
      </div>
      <div style="background:${LINE_SOFT};height:7px;"><div style="width:${Math.max(2, Math.min(100, value))}%;height:100%;background:${color};"></div></div>
    </div>`;

  const togetherSection = togetherRead ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">The area and the flat, together</div>
      <div style="font-family:${DISPLAY};font-size:21px;font-weight:800;color:${INK};margin-bottom:16px;letter-spacing:-.01em;">${togetherRead.headline}</div>
      <div style="display:flex;gap:22px;flex-wrap:wrap;margin-bottom:18px;">
        ${bar(`The area, ${safeAreaName}`, avRecord.nqi_composite, WINE)}
        ${bar(`This flat, floor ${safeFloor} ${safeFacing}`, unitScore, SUN)}
      </div>
      ${formattedTogetherBody
        ? `<div style="${LEAD}">${formattedTogetherBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`).replace(/font-size:14.5px/g, 'font-size:15.5px')}</div>`
        : `<p style="${LEAD}margin:0;">${togetherRead.line}</p>`}
    </div>` : '';

  // The area. Factor bars in one grid, the real counts as a plain line under
  // them, then the narrative. No nested cards.
  const factorRow = hasNeighbourhood ? Object.entries(avRecord.scores || {}).map(([k, v]) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:${DIM};margin-bottom:4px;">
          <span>${escapeHtml(FACTOR_LABELS[k] || k)}</span><span style="font-weight:700;color:${INK};">${v}</span>
        </div>
        <div style="background:${LINE_SOFT};height:6px;"><div style="width:${v}%;height:100%;background:${gradeColor(v)};"></div></div>
      </div>`).join('') : '';

  const areaFacts = hasNeighbourhood ? [
    avRecord.total_cognizable_crimes != null
      ? `${avRecord.total_cognizable_crimes.toLocaleString('en-IN')} recorded crimes a year, safer than ${avRecord.crime_percentile ?? '-'}% of comparable areas`
      : null,
    avRecord.schools_count != null ? `${avRecord.schools_count} schools mapped nearby` : null,
    avRecord.price_context?.rate_sqft
      ? `Guidance value &#8377;${Math.round(avRecord.price_context.rate_sqft[0]).toLocaleString('en-IN')}&ndash;&#8377;${Math.round(avRecord.price_context.rate_sqft[1]).toLocaleString('en-IN')} per sq ft`
      : null,
  ].filter(Boolean) : [];

  const areaSection = hasNeighbourhood ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">The area &middot; ${safeAreaName}, pin ${escapeHtml(avRecord.pin_code)}</div>
      <p style="font-size:13px;color:${DIM};margin-bottom:18px;">Government records. The same for every flat in this pincode &mdash; they don't change with floor or facing.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px 26px;margin-bottom:${areaFacts.length ? '16px' : '20px'};">
        ${factorRow}
      </div>
      ${areaFacts.length ? `<p style="font-size:13px;color:${MUTE};line-height:1.75;margin-bottom:18px;">${areaFacts.join(' &middot; ')}</p>` : ''}
      ${formattedNeighbourhoodBody || ''}
    </div>` : '';

  // The flat. The year in one chart, then the narrative.
  const flatSection = `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">The flat &middot; floor ${safeFloor}, facing ${safeFacing}</div>
      <p style="font-size:13px;color:${DIM};margin-bottom:18px;">
        Worked out from the sun's real path over the buildings on this block${facingAssumptionNote ? ', with the facing assumed rather than confirmed' : ''}.
      </p>
      ${summary?.solarFeasibility ? `
      <p style="font-size:14px;color:${MUTE};line-height:1.75;margin-bottom:4px;">
        <strong style="color:${INK};">${summary.solarFeasibility.avgUsableHours}h of usable sun a day</strong> on average.
        Best in ${summary.solarFeasibility.bestMonths.join(' and ')}; worst in ${summary.solarFeasibility.worstMonths.join(' and ')}.
      </p>` : ''}
      ${sunBarChart}
      ${formattedAnalysis || (aiUnavailable ? aiNote : '')}
      ${summary?.buildingHeightNote ? `<p style="font-size:12.5px;color:${DIM};line-height:1.7;margin-top:14px;">${summary.buildingHeightNote.sentence}</p>` : ''}
    </div>`;

  // Strengths and watch-outs, computed from the real numbers. Two plain
  // lists, not two bordered cards inside a bordered grid.
  const listBlock = (title, items, color) => items.length ? `
    <div style="flex:1;min-width:230px;">
      <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.09em;margin-bottom:10px;">${title}</div>
      <ul style="margin:0;padding-left:17px;">
        ${items.map(t => `<li style="font-size:14px;color:${MUTE};line-height:1.7;margin-bottom:7px;">${t}</li>`).join('')}
      </ul>
    </div>` : '';

  const strengthsSection = (pros.length || cons.length) ? `
    <div style="${RULE}"></div>
    <div style="display:flex;gap:34px;flex-wrap:wrap;margin-bottom:26px;">
      ${listBlock('What is good here', pros.map(p => escapeHtml(String(p).replace(/^\+\s*/, ''))), GOOD)}
      ${listBlock('What to watch', cons.map(c => escapeHtml(String(c).replace(/^[-\u2212]\s*/, ''))), POOR)}
    </div>` : '';

  // Whatever the model wrote as its closing "what to check" section, pulled
  // out so it reads as a checklist rather than the tail of a paragraph.
  const checkSection = checkBody ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">Before you decide</div>
      ${formatNarrative(checkBody)}
    </div>` : '';

  const mainHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${hasNeighbourhood ? 'BlindSpot Combined Report' : 'Home Comfort Report'} - ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:${BG};color:${INK}}
    @media print{
      .no-print{display:none!important}
      body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      img{max-width:100%;}
    }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100;display:flex;gap:10px;align-items:center;">
    <span id="pdf-status" style="font-size:12px;color:${DIM};max-width:260px;text-align:right;"></span>
    <button id="back-to-sunscout-btn" style="background:#fff;color:${WINE};border:1px solid ${WINE};padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;">← Close</button>
    <button id="print-btn" style="background:${CARD};color:${MUTE};border:1px solid ${LINE};padding:10px 16px;font-size:13px;cursor:pointer;">Print</button>
    <button id="download-pdf-btn" style="background:${GRADIENT};color:#fff;border:none;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(107,36,48,0.3);display:inline-flex;align-items:center;gap:7px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>Download PDF</button>
    <button onclick="window.close()" style="background:${CARD};color:${MUTE};border:1px solid ${LINE};padding:10px 18px;font-size:14px;cursor:pointer;">Close</button>
  </div>

  <div id="report-root" style="max-width:900px;margin:0 auto;background:#fff;">

    <!-- Page 1: cover / verdict / neighbourhood / summary / table -->
    <div class="pdf-page" style="padding:48px 32px 40px;">
      <div style="border-bottom:2px solid ${LINE_SOFT};padding-bottom:24px;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;">
          ${markDataUri ? `<img src="${markDataUri}" alt="BlindSpot" style="width:18px;height:20px;object-fit:contain;display:block;"/>` : ''}
          <span style="font-size:12px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;">${hasNeighbourhood ? 'BlindSpot Combined Report' : 'BlindSpot Home Comfort'}</span>
          <span style="font-size:11px;color:${DIM};">${hasNeighbourhood ? 'The area and the flat, in one verdict' : 'One flat, through a year of sun'}</span>
        </div>
        ${labelPill}
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
          <h1 style="font-size:27px;font-weight:800;color:${INK};margin:0;font-family:${DISPLAY};letter-spacing:-.01em;">${safeAddress}</h1>
          ${badge ? `<span style="background:${badge.color};color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;padding:5px 12px;text-transform:uppercase;">${badge.text}</span>` : ''}
        </div>
        <div style="font-size:11px;color:${DIM};display:flex;align-items:center;gap:5px;"><span style="color:${DIM};">${PIN_SVG}</span>${parseFloat(lat).toFixed(5)}°N, ${parseFloat(lon).toFixed(5)}°E · ${date}</div>

        <p style="font-size:14px;line-height:1.8;color:${MUTE};margin-top:16px;max-width:64ch;font-family:Arial,sans-serif;">
          ${hasNeighbourhood
            ? `Two things decide whether you'll be happy here, and a listing tells you neither: what the area around this building is like, and what this particular flat is like to live in. Every figure below is either a government record or a calculation from the sun's real path over the real buildings on this block. Where something is an estimate, it says so.`
            : `A listing tells you the floor and which way the windows face. It doesn't tell you what that means for light through the year. Everything below is calculated from the sun's real path over the real buildings on this block. Where something is an estimate, it says so.`}
        </p>
      </div>

      ${aiUnavailable ? aiNote : ''}
      ${openingSection}
      ${livingSection}
      ${suitsSection}
      ${togetherSection}
      ${areaSection}
      ${flatSection}
      ${strengthsSection}
      ${checkSection}
    </div>

    <!-- Final page: methodology + footer -->
    <div class="pdf-page" style="padding:40px 32px 48px;">
      <div style="border:1px solid ${LINE_SOFT};padding:20px 24px;">
        <div style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">How this report was built</div>
        <ul style="margin:0;padding-left:18px;font-size:11.5px;color:${DIM};line-height:1.7;">
          ${hasNeighbourhood ? `<li>Neighbourhood factor scores, crime, schools, and price context come from Neighbourhood Score, the same for every unit in this pincode, deterministic, not AI-generated.</li>` : ''}
          ${hasNeighbourhood ? `<li>The Combined Score is (${avRecord.nqi_composite} × ${Math.round((areaWeight ?? 0.5) * 100)}%) + (${unitScore ?? '-'} × ${Math.round((unitWeight ?? 0.5) * 100)}%) = ${combinedScore ?? '-'}, a weighted average, not AI-generated.</li>` : ''}
          <li>Sun position and monthly sunlight hours come from a NOAA solar-geometry algorithm, deterministic, not AI-generated.</li>
          <li>Floor clearance uses a generic urban-obstruction estimate, not a measurement of this property's specific neighboring buildings.</li>
          ${summary?.buildingHeightNote ? `<li>${summary.buildingHeightNote.sentence}</li>` : ''}
          ${safeFacingAssumptionNote ? `<li>${safeFacingAssumptionNote}</li>` : ''}
          <li>The written sections use AI to interpret the numbers above. It is given them as fact and told not to estimate its own.</li>
          <li>The ${shotCount || 12} map images this is read from, and the description of each, are in the separate Sun &amp; Shadow report you can generate from the same page.</li>
        </ul>
      </div>

      <div style="border-top:1px solid ${LINE_SOFT};padding-top:18px;margin-top:36px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:7px;">
          ${markDataUri ? `<img src="${markDataUri}" alt="BlindSpot" style="width:12px;height:13px;object-fit:contain;opacity:.5;"/>` : ''}
          <div style="font-size:10px;color:${DIM};">${hasNeighbourhood ? 'BlindSpot Combined Report' : 'Home Comfort Report'} · BlindSpot</div>
        </div>
        <div style="font-size:10px;color:${DIM};">3D Map: OSMBuildings · AI-assisted narrative · Solar geometry: NOAA algorithm</div>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script>
    document.getElementById('print-btn').addEventListener('click', function () { window.print(); });

    document.getElementById('back-to-sunscout-btn').addEventListener('click', function () {
      // Report opens as a blob URL in a new tab -- prefer closing back to
      // whichever tab opened it (the BlindSpot page) when that relationship
      // is available; otherwise just close this tab.
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
        window.close();
      } else {
        window.close();
      }
    });

    document.getElementById('download-pdf-btn').addEventListener('click', async function () {
      var btn = document.getElementById('download-pdf-btn');
      var status = document.getElementById('pdf-status');
      btn.disabled = true;

      try {
        var jsPDFCtor = window.jspdf.jsPDF;
        var pdf = new jsPDFCtor({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        var pageWidth = pdf.internal.pageSize.getWidth();
        var pageHeight = pdf.internal.pageSize.getHeight();
        var pages = document.querySelectorAll('.pdf-page');

        for (var i = 0; i < pages.length; i++) {
          status.textContent = 'Building PDF… page ' + (i + 1) + ' of ' + pages.length;

          // One (moderately sized) canvas per logical page, not one giant
          // canvas for the whole document — this is what avoids the blank-
          // PDF failure that happens past the browser's canvas size limit.
          var canvas = await window.html2canvas(pages[i], {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          });
          var imgData = canvas.toDataURL('image/jpeg', 0.92);
          var imgWidth = pageWidth;
          var imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (i > 0) pdf.addPage();

          // If this page's content is taller than one A4 page, slice it
          // across multiple PDF pages using the standard negative-offset
          // technique, instead of squashing or cropping it.
          var heightLeft = imgHeight;
          var position = 0;
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
        }

        var filename = '${hasNeighbourhood ? 'BlindSpot-Combined-Report' : 'HomeComfort-Report'}-${(address || 'property').toString().replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60)}.pdf';
        pdf.save(filename);
        status.textContent = '';
      } catch (err) {
        console.error(err);
        status.textContent = 'Download failed, try Print instead.';
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  // The sun & shadow document.
  //
  // Its job is one thing: show what the sun does to this block across a
  // year, and say what each picture shows. So the pictures and their
  // descriptions lead, at reading size, and the monthly table follows as
  // the appendix it is -- it used to sit above all twelve images, which put
  // a technical table between the reader and the only reason they opened
  // this.
  const describedCount = Object.keys(perImage).length;
  const galleryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Sun &amp; Shadow - ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:${BG};color:${INK};-webkit-font-smoothing:antialiased}
    img{max-width:100%}
    @media print{
      .no-print{display:none!important}
      body{background:#fff}
      .pdf-page{page-break-inside:avoid}
      .shot-card{page-break-inside:avoid}
    }
  </style>
</head>
<body>
  <div class="no-print" style="position:sticky;top:0;z-index:100;background:${BG};border-bottom:1px solid ${LINE};padding:13px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
    <div style="display:flex;align-items:center;gap:9px;min-width:0;">
      ${markDataUri ? `<img src="${markDataUri}" alt="" style="width:16px;height:18px;object-fit:contain;"/>` : ''}
      <span style="font-size:12px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.1em;">Sun &amp; Shadow</span>
      <span style="font-size:11.5px;color:${DIM};">${safeAddress}</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:${WINE};color:#fff;border:1px solid ${WINE};padding:9px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Save as PDF</button>
      <button onclick="if(window.opener&&!window.opener.closed){window.opener.focus();window.close();}else{window.close();}" style="background:transparent;color:${WINE};border:1px solid ${WINE};padding:9px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Close</button>
    </div>
  </div>

  <div style="max-width:880px;margin:0 auto;padding:0 32px 60px;background:#fff;">

    <div style="padding:44px 0 30px;border-bottom:2px solid ${INK};margin-bottom:34px;">
      <div style="font-size:11.5px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;margin-bottom:11px;">A year of sun over this block</div>
      <h1 style="font-family:${DISPLAY};font-size:29px;font-weight:800;color:${INK};letter-spacing:-.015em;line-height:1.15;margin-bottom:9px;">${safeAddress}</h1>
      <div style="font-size:13px;color:${DIM};margin-bottom:18px;">Floor ${safeFloor}, facing ${safeFacing} &middot; ${parseFloat(lat).toFixed(5)}&deg;N, ${parseFloat(lon).toFixed(5)}&deg;E &middot; ${date}</div>
      <p style="font-size:14.5px;color:${MUTE};line-height:1.8;max-width:64ch;">
        ${shotCount >= 12
          ? `The 3D map at this exact pin, photographed twelve times: three points in each season, at 9am, noon and 3pm. The dark areas are real shadows, cast by the real buildings around this one. The orange dot is the property.`
          : `The 3D map at this exact pin, photographed ${shotCount} times through the year. The dark areas are real shadows, cast by the real buildings around this one. The orange dot is the property. This is fewer than the twelve we aim for &mdash; the rest didn't come back from the map in time, so those points in the year aren't shown. Generating it again usually gets the full set.`}
        ${describedCount ? `` : ` The written descriptions didn't come back this time; the images and the figures below are unaffected.`}
      </p>
      ${summary?.solarFeasibility ? `
      <div style="display:flex;gap:0;flex-wrap:wrap;margin-top:22px;border:1px solid ${LINE};">
        <div style="flex:1;min-width:150px;padding:13px 17px;">
          <div style="font-size:10px;color:${DIM};text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px;">Usable sun</div>
          <div style="font-family:${DISPLAY};font-size:20px;font-weight:800;color:${INK};">${summary.solarFeasibility.avgUsableHours}h<span style="font-size:12px;color:${DIM};font-weight:400;"> a day, average</span></div>
        </div>
        <div style="flex:1;min-width:150px;padding:13px 17px;border-left:1px solid ${LINE};">
          <div style="font-size:10px;color:${DIM};text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px;">Best months</div>
          <div style="font-family:${DISPLAY};font-size:20px;font-weight:800;color:${GOOD};">${summary.solarFeasibility.bestMonths.join(', ')}</div>
        </div>
        <div style="flex:1;min-width:150px;padding:13px 17px;border-left:1px solid ${LINE};">
          <div style="font-size:10px;color:${DIM};text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px;">Worst months</div>
          <div style="font-family:${DISPLAY};font-size:20px;font-weight:800;color:${POOR};">${summary.solarFeasibility.worstMonths.join(', ')}</div>
        </div>
      </div>` : ''}
    </div>

    ${screenshotPages}

    ${monthlyTableSection ? `
    <div style="padding:34px 0 0;border-top:2px solid ${INK};margin-top:14px;">
      <div style="font-size:11.5px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;">The numbers behind the pictures</div>
      <p style="font-size:13px;color:${DIM};line-height:1.7;margin-bottom:18px;max-width:64ch;">Month by month for floor ${safeFloor}. Sunrise and sunset are true for this location; usable hours and floor clearance are calculated from the sun's angle against a general estimate of the buildings around it.</p>
      ${monthlyTableSection}
    </div>` : ''}

    <div style="margin-top:38px;padding-top:17px;border-top:1px solid ${LINE};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:7px;">
        ${markDataUri ? `<img src="${markDataUri}" alt="" style="width:12px;height:13px;object-fit:contain;opacity:.5;"/>` : ''}
        <span style="font-size:10.5px;color:${DIM};">Sun &amp; Shadow &middot; BlindSpot</span>
      </div>
      <span style="font-size:10.5px;color:${DIM};">3D map: OSMBuildings &middot; Solar geometry: NOAA algorithm</span>
    </div>
  </div>
</body>
</html>`;

  return NextResponse.json({ mainHtml, galleryHtml });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  return POST(new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: searchParams.get('lat'),
      lon: searchParams.get('lon'),
      address: searchParams.get('address'),
      floor: searchParams.get('floor') || '5',
      facing: searchParams.get('facing') || 'South',
      screenshots: [],
      analysis: 'No analysis available, use POST endpoint with screenshots.',
      summary: null,
    }),
  }));
}
