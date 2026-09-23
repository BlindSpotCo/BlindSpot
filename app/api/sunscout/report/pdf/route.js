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
// or ~268 megapixels total) - past that limit, html2canvas silently
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
const BG        = '#F8FAFC'; // --bg
const CARD      = '#F1F5F9'; // --bg-2
const LINE      = '#E2E8F0'; // --line (already a solid value post palette-swap)
const LINE_SOFT = '#EDF1F5'; // solid approximation of --line-soft for canvas-safe rendering
const INK       = '#0F172A'; // --ink / --text
const MUTE      = '#64748B'; // --text-mute
const DIM       = '#94A3B8'; // --text-dim
const SUN       = '#AF5F30'; // --ss (back to its original warm value, see app/globals.css)
const WINE      = '#3D4116'; // --brand (back to its original warm olive, see app/globals.css)
const GRADIENT  = `linear-gradient(90deg, ${SUN}, ${WINE})`;
const GOOD = '#10B981', OK = '#F59E0B', POOR = '#EF4444';
const DISPLAY = "'Geist', Arial, sans-serif";

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
  // here - the full text just falls through to the bottom narrative as a
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

// Pure reordering, not a rewrite: moves the "BlindSpot Verdict" section to
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

  const verdictIdx = sections.findIndex(s => /blindspot\s*(verdict|summary)/i.test(s.title));
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
// are stripped from sub-headers on purpose: once BlindSpot Verdict and
// Neighbourhood Full Analysis are pulled out into their own cards above,
// whatever's left starts mid-sequence ("4. FLOOR...", "5. ...FACING...")
// which reads as a numbering bug -- each section already has its own card
// and icon, so the number added nothing but confusion.
// "- Label: sentence" -> label in bold, so a list of insights scans.
function boldLabels(text) {
  return String(text || '').replace(/^[-•] ([^:\n*]{2,48}):\s+/gm, '- **$1:** ');
}

function formatNarrative(rawAnalysis, { dropLeadingHeader = false } = {}) {
  // Each section already has its own heading in the document, so the model's
  // own restatement of it ("THE FLAT ITSELF, FLOOR 7 FACING SOUTH-EAST")
  // reads as a duplicate heading two lines under the real one.
  const src = dropLeadingHeader
    ? rawAnalysis.replace(/^\s*(?:\d+\.\s*)?[A-Z][A-Z0-9 ,&'\/-]{6,}\s*$/m, '').trim()
    : rawAnalysis;
  return src
    .replace(/^\d+\.\s*(.+)$/gm, `<h3 style="font-size:15px;font-weight:700;color:${INK};margin:18px 0 8px;font-family:${DISPLAY};">$1</h3>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, `<li style="margin-bottom:6px;color:${MUTE};line-height:1.65;font-size:14px;">$1</li>`)
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:0 0 12px;padding-left:18px;">${m}</ul>`)
    .replace(/\n\n/g, `</p><p style="margin:0 0 10px;color:${MUTE};line-height:1.7;font-size:14px;font-family:${DISPLAY};">`)
    .replace(/^/, `<p style="margin:0 0 10px;color:${MUTE};line-height:1.7;font-size:14px;font-family:${DISPLAY};">`)
    .replace(/$/, '</p>')
    .replace(/<p[^>]*><\/p>/g, '');
}

export async function POST(req) {
  // Any failure comes back with its message, so the browser console says
  // what broke instead of a bare 500.
  try {
    return await buildReport(req);
  } catch (err) {
    console.error('[report/pdf] failed:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

async function buildReport(req) {
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

  // Print chrome. The report opens from a blob: URL, so the browser's own
  // print header/footer stamped that URL and a timestamp on every page.
  // @page margin:0 leaves the browser no room to draw them; our own header
  // and footer take their place. The table wrapper is what makes it work
  // across pages: thead/tfoot spacers repeat on every printed page and
  // reserve the room the fixed header/footer sit in, so content never runs
  // under them. On screen the table is display:block and invisible.
  const printChrome = (docLabel) => ({
    css: `
    .print-only{display:none}
    .pframe,.pframe>thead,.pframe>tbody,.pframe>tfoot,.pframe>*>tr,.pframe>*>tr>td{display:block}
    @page{size:A4;margin:0}
    @media print{
      html,body{background:#fff!important}
      .print-only{display:block}
      .pframe{display:table;width:100%;border-collapse:collapse}
      .pframe>thead{display:table-header-group}
      .pframe>tbody{display:table-row-group}
      .pframe>tfoot{display:table-footer-group}
      .pframe>*>tr{display:table-row}
      .pframe>*>tr>td{display:table-cell;padding:0;vertical-align:top}
      .pspace-head{height:19mm}
      .pspace-foot{height:15mm}
      .print-head,.print-foot{position:fixed;left:0;right:0;padding:0 13mm;background:#fff;z-index:50;font-family:${DISPLAY}}
      .print-head{top:0}
      .print-foot{bottom:0}
      .print-bar{display:flex;justify-content:space-between;align-items:center;gap:16px}
      .print-head .print-bar{height:15mm;border-bottom:1.5px solid ${INK}}
      .print-foot .print-bar{height:12mm;border-top:1px solid ${LINE}}
      .print-brand{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:${INK};letter-spacing:-.005em;white-space:nowrap}
      .print-kind{font-size:9px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;margin-left:4px}
      .print-addr{font-size:9.5px;color:${DIM};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
      .print-small{font-size:8.5px;color:${DIM};white-space:nowrap}
      body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    }`,
    open: `
  <div class="print-only print-head"><div class="print-bar">
    <div class="print-brand">${markDataUri ? `<img src="${markDataUri}" alt="" style="width:12px;height:14px;object-fit:contain;"/>` : ''}BlindSpot<span class="print-kind">${docLabel}</span></div>
    <div class="print-addr">${safeAddress}</div>
  </div></div>
  <div class="print-only print-foot"><div class="print-bar">
    <span class="print-small">blindspotco.net</span>
    <span class="print-small">Prepared ${date} &middot; Floor ${safeFloor}, facing ${safeFacing}</span>
  </div></div>
  <table class="pframe" role="presentation">
    <thead><tr><td><div class="print-only pspace-head"></div></td></tr></thead>
    <tfoot><tr><td><div class="print-only pspace-foot"></div></td></tr></tfoot>
    <tbody><tr><td>`,
    close: `</td></tr></tbody>
  </table>`,
  });
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
    ? extractSection(cleanedRest, /blindspot\s*(verdict|summary)/i)
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
    ? extractSection(afterTogether, /neighbourhood (?:full|score) analysis/i)
    : { body: '', rest: afterTogether };

  // The model's closing "what to check when you visit" section, lifted out
  // so it reads as a checklist under its own heading instead of trailing off
  // the end of the sun & shadow paragraphs.
  const { body: checkBody, rest: afterCheck } = extractSection(afterNeighbourhood, /what to verify|what to check|before you visit|before you decide/i);

  // The persona overlay's closing six-line section (lib/personas.js). It
  // used to fall through into the flat narrative and render as a stray
  // sub-heading inside it; now it gets its own block.
  const { body: personaBody, rest: afterPersona } = extractSection(afterCheck, /your week in this flat|family life here|rental and resale|pitch sheet/i);
  const personaTitle = (afterCheck.match(/^\d+\.\s+(YOUR WEEK IN THIS FLAT|FAMILY LIFE HERE|RENTAL AND RESALE POSITION|PITCH SHEET)\s*$/im) || [])[1] || '';

  const rawAnalysis = afterPersona;

  // The AI verdict ends with one "- Best fit for: ..." line (per the prompt
  // in analyse/route.js) -- pull it out to show as its own "Ideal For" strip
  // next to Pros/Cons, instead of leaving it buried at the end of the
  // BlindSpot Verdict paragraph where it's easy to miss.
  let idealForText = '';
  const verdictBodyMinusIdeal = verdictBody.replace(/^-\s*Best fit for:\s*(.+)$/im, (_, captured) => {
    idealForText = captured.trim();
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();

  const formattedVerdictBody = verdictBodyMinusIdeal ? formatNarrative(verdictBodyMinusIdeal) : '';
  const formattedNeighbourhoodBody = neighbourhoodBody ? formatNarrative(neighbourhoodBody) : '';
  const formattedTogetherBody = togetherBody ? formatNarrative(togetherBody) : '';
  const formattedLivingBody = livingBody ? formatNarrative(boldLabels(livingBody)) : '';
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

  // "December and January and November" (plain .join(' and')) reads worse
  // the more months there are. A real list: comma-separated, "and" only
  // before the last item, still just "X and Y" for exactly two.
  function joinList(items) {
    if (!items || !items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
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
      else if (v < 50) cons.push(`${label} score ${verb} low (${v}/100)`);
    }
  }
  if (summary?.solarFeasibility) {
    const { bestMonths, avgUsableHours } = summary.solarFeasibility;
    if (avgUsableHours >= 6) pros.push(`Strong sun exposure in ${joinList(bestMonths)}`);
    const zero = summary.monthlySummary.filter(m => m.usableHours === 0);
    if (zero.length) cons.push(`No direct sun ${zero[0].month}${zero.length > 1 ? `–${zero[zero.length-1].month}` : ''} (${zero.length} month${zero.length > 1 ? 's' : ''})`);
  }
  if (shadeHeatSub) {
    if (shadeHeatSub.score >= 70) pros.push('Naturally well-shaded, low summer heat gain');
    else if (shadeHeatSub.score < 40) cons.push('High summer heat risk');
  }
  if (windSub) {
    if (windSub.score >= 70) pros.push('Good natural ventilation potential');
    else if (windSub.score < 40) cons.push('Limited ventilation potential');
  }

  // Plain-spoken labels, not all-caps report jargon -- "Proceed with
  // Caution" reads like something a person would actually say about a
  // place, the way the old shouted "RECOMMENDED WITH CAUTION" pill didn't.
  const VERDICT_BADGE = {
    'Prime Pick': { text: 'Recommended', color: GOOD },
    'Hidden Gem': { text: 'Worth a closer look', color: OK },
    'Location Play': { text: 'Worth a closer look', color: OK },
    'Reconsider': { text: 'Check in person', color: OK },
  };
  const badge = verdictLabel ? (VERDICT_BADGE[verdictLabel] || { text: escapeHtml(verdictLabel).toUpperCase(), color: SUN }) : null;

  const seasons = ['Summer', 'Winter', 'Spring', 'Autumn'];
  const shotsWithIndex = (Array.isArray(screenshots) ? screenshots : []).map((s, i) => ({ ...s, idx: i }));
  const grouped = seasons.map(s => ({
    season: s,
    shots: shotsWithIndex.filter(sc => sc.label.startsWith(s)),
  })).filter(g => g.shots.length > 0);

  // Each season is its own `.pdf-page` -- kept as separate, moderately-sized
  // canvases when exporting (see the script at the bottom).
  //
  // The description is the point of this document, not a caption under a
  // picture, so it is set as reading-weight body text next to its own
  // image rather than a small caption underneath it. The time of day
  // belongs on the image; the season belongs to the group; the floor and
  // facing are already stated once at the top of the document -- none of
  // the three need repeating under every single frame.
  //
  // Laid out as a real tiled grid (.shot-grid below), not one full-width
  // card stacked under the next: a season is 3 frames (9am/noon/3pm), and
  // stacking those full-width turned a document about photographs into a
  // very long scroll of mostly whitespace. .shot-grid is a plain
  // auto-fill/minmax grid rather than a hand-set column count, so it goes
  // wide on desktop, narrows gracefully on a tablet-width window, and the
  // sub-560px override below drops it to one column on a phone -- a photo
  // and its description read better full-width there than squeezed into a
  // grid cell.
  const screenshotPages = grouped.map((g) => `
    <div class="pdf-page" style="padding:38px 32px 30px;background:#fff;">
      <div style="display:flex;align-items:baseline;gap:12px;padding-bottom:11px;border-bottom:2px solid ${INK};margin-bottom:24px;">
        <h3 style="font-family:${DISPLAY};font-size:24px;font-weight:800;color:${INK};letter-spacing:-.01em;">${g.season}</h3>
        <span style="font-size:12.5px;color:${DIM};">${g.shots.map(sc => sc.label.split(' · ')[1] || sc.label).join(' · ')}</span>
      </div>
      <div class="shot-grid">
        ${g.shots.map((shot) => `
          <div class="shot-card">
            <span style="display:block;font-family:${DISPLAY};font-size:16px;font-weight:800;color:${SUN};margin-bottom:9px;">${shot.label.split(' · ')[1] || shot.label}</span>
            <div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#0A0C10;position:relative;border:1px solid ${LINE};">
              <img src="${shot.base64}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="The block at ${shot.label}"/>
              ${PROPERTY_MARKER_HTML}
            </div>
            ${/* No caption -> just the frame. The picture stands on its own;
                  an apology under it reads as a broken document. */''}
            ${perImage[shot.idx]
              ? `<p style="font-size:13.5px;color:${INK};line-height:1.65;margin-top:12px;">${perImage[shot.idx]}</p>`
              : ''}
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
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;font-family:${DISPLAY};margin-bottom:12px;min-width:600px;">
      <thead>
        <tr style="background:${CARD};">
          ${['Month','Sunrise','Sunset','Noon Elevation','Usable Sun','Peak Window',`Floor ${safeFloor} Clearance`]
            .map((h, i) => `<th style="text-align:${i === 3 || i === 4 ? 'right' : 'left'};padding:12px 16px;border-bottom:2px solid #E5E7EB;color:${WINE};font-weight:700;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${summary.monthlySummary.map((m, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#FBF8F1'};">
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-weight:700;color:${INK};">${m.month}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};">${m.sunrise}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};">${m.sunset}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};text-align:right;">${m.noonElevation}°</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};text-align:right;">${m.usableHours}h</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};">${m.peakWindow}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;color:${MUTE};">${m.floorClearance}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>

    <!-- Honesty line: real OSM data-completeness check, not a canned disclaimer -->
    ${summary.buildingHeightNote ? `
    <div style="display:flex;gap:8px;align-items:flex-start;background:#FBF8F1;border:1px dashed ${LINE};padding:11px 15px;margin-bottom:24px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${DIM}" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><circle cx="12" cy="7.5" r="0.5" fill="${DIM}"/></svg>
      <div style="font-size:11.5px;color:${DIM};line-height:1.6;">${summary.buildingHeightNote.sentence}</div>
    </div>` : ''}
  ` : '';

  // Line chart, not bars, for the main report -- the full numeric table
  // (above) now lives in the gallery/appendix only, so the main report
  // stays quick to read: one glance at the shape of the year instead of a
  // 12-row table.
  //
  // Was a bar chart scaled 0-to-max, which made every month read as
  // "basically full" -- usable-sun-hours varies by design over a narrow
  // band (a good vs. a bad month here is ~5.0h vs ~5.7h, ~12%), and a bar's
  // length only means anything measured from a shared zero baseline, so
  // that real 12% swing rendered as bars all sitting at 88-100% height --
  // visually flat even though the underlying number was moving. Switching
  // to months-as-a-trend was the actual fix: this is a single-series
  // value changing across a continuous axis (a month sequence), which is
  // a line/area's job, not a bar's -- and unlike a bar, a line's vertical
  // position isn't read as "proportion of a zero baseline," so scoping the
  // y-domain tightly around the real min/max (instead of forcing it down
  // to 0) is honest here, not misleading, and is what actually makes the
  // May-July peak and Dec-Jan dip visible. (A log scale, which was asked
  // about, doesn't fix this at all -- these values span one order of
  // magnitude, not several, so a log axis would barely move the bars; the
  // problem was never the scale's shape, it was the 0-baseline the bar
  // form forces.)
  //
  // Inline SVG rather than CSS bars -- html2canvas 1.4.1 (loaded below for
  // the PDF export) rasterizes plain SVG shapes (line/path/circle/text)
  // fine, so this renders identically in the browser and in the export.
  const sunBarChart = summary?.monthlySummary ? (() => {
    const months = summary.monthlySummary;
    const hours = months.map(m => m.usableHours);
    const dataMin = Math.min(...hours), dataMax = Math.max(...hours);
    // Padding the domain (rather than running it exactly min-to-max) keeps
    // the line off the very top/bottom edge and keeps a flat month from
    // ever reading as "zero" -- a fixed 0.4h floor on the pad so a
    // near-flat year (small dataMax-dataMin) doesn't re-introduce the same
    // "everything looks the same" problem this chart is fixing.
    const pad = Math.max((dataMax - dataMin) * 0.25, 0.4);
    const yMin = Math.max(0, dataMin - pad), yMax = dataMax + pad;
    const W = 720, H = 130, L = 4, R = 4, T = 22, B = 20;
    const plotW = W - L - R, plotH = H - T - B;
    const x = (i) => L + (months.length === 1 ? plotW / 2 : (i / (months.length - 1)) * plotW);
    const y = (v) => T + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const pts = months.map((m, i) => [x(i), y(m.usableHours)]);
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(T + plotH).toFixed(1)} L${pts[0][0].toFixed(1)},${(T + plotH).toFixed(1)} Z`;
    // Direct-labeling every point (not just peak/trough) is deliberate here,
    // not the usual "selective labels" default -- this chart doubles as the
    // only place in the main report these 12 numbers appear (the full table
    // moved to the appendix), so the labels ARE the data, not decoration.
    const valueLabels = pts.map((p, i) => `<text x="${p[0].toFixed(1)}" y="${(p[1] - 8).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${DIM}">${months[i].usableHours.toFixed(1)}h</text>`).join('');
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${SUN}"/>`).join('');
    const monthLabels = months.map((m, i) => `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="${DIM}">${m.month.slice(0,3)}</text>`).join('');
    return `
      <div style="margin:10px 0 12px;">
        <div style="font-size:11.5px;font-weight:700;color:${INK};margin-bottom:6px;">Usable sun hours by month</div>
        <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;overflow:visible;">
          <line x1="${L}" y1="${T + plotH}" x2="${W - R}" y2="${T + plotH}" stroke="${LINE}" stroke-width="1"/>
          <path d="${areaPath}" fill="${SUN}" fill-opacity="0.1" stroke="none"/>
          <path d="${linePath}" fill="none" stroke="${SUN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots}
          ${valueLabels}
          ${monthLabels}
        </svg>
      </div>`;
  })() : '';

  const PIN_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;"><path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`;

  const labelPill = reportLabel ? `
    <div style="display:inline-flex;align-items:center;gap:7px;background:${GRADIENT};color:#fff;font-size:12.5px;font-weight:700;padding:7px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(107,36,48,0.25);">
      ${PIN_SVG} ${safeReportLabel}
    </div>` : '';

  // No "the written analysis is missing" note: when the model doesn't
  // answer, its sections are simply absent and the computed ones stand alone.

  // How the two halves relate, computed here rather than written, so it is
  // present and consistent with the numbers even when the narrative isn't.
  const togetherRead = (() => {
    if (!hasNeighbourhood || typeof unitScore !== 'number') return null;
    const a = avRecord.nqi_composite;
    const u = unitScore;
    const gap = a - u;
    if (gap >= 15) return {
      headline: 'A stronger area than flat',
      line: 'The area is carrying this one. The gap is the half you can still change: a different floor or facing in this building changes the flat; nothing changes the area.',
    };
    if (gap <= -15) return {
      headline: 'A better flat than area',
      line: 'A comfortable home, in a locality that needs a closer look. The area is the half no unit in this building escapes.',
    };
    if (a >= 65 && u >= 65) return {
      headline: 'Both halves agree, and both are strong',
      line: 'Neither half is propping up the other. The checks below are ordinary diligence, not doubts.',
    };
    if (a < 50 && u < 50) return {
      headline: 'Both halves agree, and both need a close look',
      line: 'Neither half rescues the other, so a better floor or facing here would not be enough on its own.',
    };
    return {
      headline: 'Both halves land in the middle',
      line: 'Neither half is clearly the problem, so the decision rests on the checks below.',
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

  const H2 = `font-family:${DISPLAY};font-size:13px;font-weight:800;color:${WINE};text-transform:uppercase;letter-spacing:.11em;margin-bottom:10px;`;
  const RULE = `border-top:1px solid ${LINE};margin:22px 0 18px;`;
  const LEAD = `font-size:14.5px;line-height:1.7;color:${INK};`;

  const scoreWord = (n) => n >= 80 ? 'Excellent' : n >= 60 ? 'Good' : n >= 40 ? 'Fair' : 'Poor';

  // The opening. One number, one word, and the written verdict under it --
  // not a strip of three stat cards competing with a box.
  const topScore = hasNeighbourhood ? combinedScore : unitScore;
  const openingSection = `
    <div style="margin-bottom:30px;">
      <div style="${H2}margin-bottom:10px;">BlindSpot Summary</div>
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-family:${DISPLAY};font-size:64px;font-weight:800;line-height:1;color:${INK};">${topScore ?? '-'}</span>
        <span style="font-family:${DISPLAY};font-size:26px;font-weight:800;color:${gradeColor(topScore ?? 0)};">${topScore != null ? scoreWord(topScore) : ''}</span>
        <span style="font-size:12.5px;color:${DIM};">out of 100 &middot; ${hasNeighbourhood ? 'the area and the flat together' : 'this flat'}</span>
      </div>
      ${hasNeighbourhood ? `
      <div style="font-size:12px;color:${DIM};margin-bottom:${formattedVerdictBody ? '14px' : '0'};">
        Neighbourhood Score ${avRecord.nqi_composite} (${Math.round((areaWeight ?? 0.5) * 100)}%) &middot;
        Home Comfort Score ${unitScore ?? '-'} (${Math.round((unitWeight ?? 0.5) * 100)}%)
      </div>` : `
      <div style="font-size:12px;color:${DIM};margin-bottom:${formattedVerdictBody ? '14px' : '0'};">Home Comfort Score for this flat. No neighbourhood records for this pincode.</div>`}
      ${formattedVerdictBody ? `<div style="${LEAD}">${formattedVerdictBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`).replace(/font-size:14px/g, 'font-size:14.5px')}</div>` : ''}
      ${idealForText ? `
      <div style="margin-top:12px;padding:9px 13px;background:${CARD};font-size:13px;color:${INK};line-height:1.6;">
        <span style="font-weight:700;">Best suited to:</span> ${idealForText}
      </div>` : ''}
    </div>`;

  // Set larger than the rest and given its own rule: this is the part a
  // person reads twice, and it was previously buried mid-paragraph in a
  // section about scoring.
  const livingSection = formattedLivingBody ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:16px;">
      <div style="${H2}">What living here is like</div>
      ${formattedLivingBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`)}
    </div>` : '';

  // Who it suits. The model returns one "- Type: verdict + reasoning" line
  // per buyer type, plus a closing "- Main Deal-Breaker: ...". Split so each reads as
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
      const m = rest.match(/^(Yes(?:\s*[,-]?\s*(?:but|with|if)[^.]*)?|No|Probably not|Not really)\b[.,]?\s*/i);
      return {
        who,
        call: m ? m[1].trim() : '',
        why: m ? rest.slice(m[0].length).trim() : rest,
        negative: /^main deal-?breaker\b/i.test(who),
      };
    })
    .filter(Boolean);

  // "Great for" / "Okay for" / "Not ideal for" / "Not recommended for" --
  // a plain-spoken lead word instead of a bare "Yes" / "Probably not"
  // pill, so each card reads as a sentence a person would actually say.
  const callWord = (c) => {
    const t = (c || '').toLowerCase();
    if (t.startsWith('yes') && !t.includes('caveat')) return 'Great for';
    if (t.startsWith('yes')) return 'Okay for';
    if (t.startsWith('probably not') || t.startsWith('not really')) return 'Not ideal for';
    return 'Not recommended for';
  };
  // Declared here, above their first use: the "Who this is for" cards
  // below read them while this function runs, and when they sat further
  // down every report whose written analysis had that section crashed with
  // "Cannot access ... before initialization" (only visible once the AI
  // text started coming back).
  const GOOD_TINT = { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' };
  const HEADS_UP_TINT = { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' };
  const NOT_REC_TINT = { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C' };
  const callTint = (c) => {
    const t = (c || '').toLowerCase();
    if (t.startsWith('yes') && !t.includes('caveat')) return GOOD_TINT;
    if (t.startsWith('yes')) return HEADS_UP_TINT;
    return NOT_REC_TINT;
  };
  // The model's own sentence ends in a period; dropped inside "(...)"
  // that reads as "(Excellent access to schools.)" -- strip it so the
  // parenthetical reads as a clause, not a sentence trapped in brackets.
  const dropTrailingPeriod = (t) => (t || '').replace(/\.\s*$/, '');

  const suitsSection = suitRows.length ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:16px;">
      <div style="${H2}">Who this is for</div>
      <div style="display:flex;flex-direction:column;gap:9px;">
        ${suitRows.filter(r => !r.negative).map((r) => {
          const tint = callTint(r.call);
          return `
          <div style="background:${tint.bg};border:1px solid ${tint.border};border-radius:10px;padding:11px 15px;font-size:13.5px;line-height:1.55;color:${INK};">
            <span style="font-weight:700;color:${tint.text};">${callWord(r.call)}</span> ${r.who}${r.why ? ` <span style="color:${MUTE};">(${dropTrailingPeriod(r.why)})</span>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${suitRows.filter(r => r.negative).map((r) => `
        <div style="margin-top:18px;padding:14px 17px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;">
          <div style="font-size:12px;font-weight:700;color:${POOR};text-transform:uppercase;letter-spacing:.09em;margin-bottom:5px;">${r.who}</div>
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
    <div style="margin-bottom:16px;">
      <div style="${H2}">The area and the flat, together</div>
      <div style="font-family:${DISPLAY};font-size:18px;font-weight:800;color:${INK};margin-bottom:10px;letter-spacing:-.01em;">${togetherRead.headline}</div>
      <div style="display:flex;gap:22px;flex-wrap:wrap;margin-bottom:10px;">
        ${bar(`Neighbourhood Score &middot; ${safeAreaName}`, avRecord.nqi_composite, WINE)}
        ${bar(`Home Comfort Score &middot; floor ${safeFloor} ${safeFacing}`, unitScore, SUN)}
      </div>
      ${formattedTogetherBody
        ? `<div style="${LEAD}">${formattedTogetherBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`).replace(/font-size:14px/g, 'font-size:14.5px')}</div>`
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
    <div style="margin-bottom:16px;">
      <div style="${H2}">Neighbourhood Score &middot; ${safeAreaName}, pin ${escapeHtml(avRecord.pin_code)}</div>
      <p style="font-size:12px;color:${DIM};margin-bottom:12px;">Government records; the same for every flat in this pincode.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 24px;margin-bottom:12px;">
        ${factorRow}
      </div>
      ${areaFacts.length ? `<p style="font-size:12.5px;color:${MUTE};line-height:1.6;margin-bottom:12px;">${areaFacts.join(' &middot; ')}</p>` : ''}
      ${formattedNeighbourhoodBody || ''}
    </div>` : '';

  // The flat. The year in one chart, then the narrative.
  const flatSection = `
    <div style="${RULE}"></div>
    <div style="margin-bottom:16px;">
      <div style="${H2}">Flat Comfort${typeof unitScore === 'number' ? `: ${scoreWord(unitScore)} (${unitScore}/100)` : ''} &middot; Floor ${safeFloor}, Facing ${safeFacing}</div>
      <p style="font-size:12px;color:${DIM};margin-bottom:10px;">
        From the sun's real path over the buildings on this block${facingAssumptionNote ? '; facing assumed, not confirmed' : ''}.
      </p>
      ${summary?.solarFeasibility ? `
      <p style="font-size:13.5px;color:${MUTE};line-height:1.6;margin-bottom:2px;">
        <strong style="color:${INK};">${summary.solarFeasibility.avgUsableHours}h of usable sun a day</strong> on average.
        Best in ${joinList(summary.solarFeasibility.bestMonths)}. Worst in ${joinList(summary.solarFeasibility.worstMonths)}.
      </p>` : ''}
      ${sunBarChart}
      ${formattedAnalysis || ''}
    </div>`;

  const personaSection = personaBody ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:16px;">
      <div style="${H2}">${escapeHtml(personaTitle ? personaTitle.charAt(0) + personaTitle.slice(1).toLowerCase() : 'For you')}</div>
      ${formatNarrative(boldLabels(personaBody))}
    </div>` : '';

  // Strengths and watch-outs, computed from the real numbers. Two plain
  // lists, not two bordered cards inside a bordered grid.
  // Two bordered status cards side by side, not two plain lists -- a
  // subtle tint and border (green for what's good, amber for what needs
  // a heads-up) so the two read apart at a glance, not just by heading.
  const listBlock = (title, items, tint) => items.length ? `
    <div style="flex:1;min-width:230px;background:${tint.bg};border:1px solid ${tint.border};border-radius:12px;padding:16px 18px;">
      <div style="font-size:11.5px;font-weight:700;color:${tint.text};text-transform:uppercase;letter-spacing:.09em;margin-bottom:8px;">${title}</div>
      <ul style="margin:0;padding-left:17px;">
        ${items.map(t => `<li style="font-size:13.5px;color:${INK};line-height:1.55;margin-bottom:4px;">${t}</li>`).join('')}
      </ul>
    </div>` : '';


  const strengthsSection = (pros.length || cons.length) ? `
    <div style="${RULE}"></div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
      ${listBlock('The Good', pros.map(p => escapeHtml(String(p).replace(/^\+\s*/, ''))), GOOD_TINT)}
      ${listBlock('The Heads-Up', cons.map(c => escapeHtml(String(c).replace(/^[-\u2212]\s*/, ''))), HEADS_UP_TINT)}
    </div>` : '';

  // Whatever the model wrote as its closing "what to check" section, pulled
  // out so it reads as a checklist rather than the tail of a paragraph.
  const checkSection = checkBody ? `
    <div style="${RULE}"></div>
    <div style="margin-bottom:26px;">
      <div style="${H2}">Your On-Site Inspection Checklist</div>
      <p style="font-size:12.5px;color:${DIM};margin-bottom:10px;">Take this with you when you visit the flat with your broker.</p>
      ${formatNarrative(checkBody)}
    </div>` : '';

  // The first section on a fresh page doesn't need a divider above it.
  const stripLeadRule = (html) => (html || '').replace(`<div style="${RULE}"></div>`, '');

  const mainChrome = printChrome(hasNeighbourhood ? 'Property report' : 'Home comfort report');
  const mainHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${hasNeighbourhood ? 'BlindSpot Report' : 'Home Comfort Report'} - ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${DISPLAY};background:${BG};color:${INK}}
    @media print{
      .no-print{display:none!important}
      body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      img{max-width:100%;}
    }
    ${mainChrome.css}
  </style>
</head>
<body>${mainChrome.open}
  <div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100;display:flex;gap:10px;align-items:center;">
    <span id="pdf-status" style="font-size:12px;color:${DIM};max-width:260px;text-align:right;"></span>
    <!-- Was two buttons here: this one and a plain onclick="window.close()"
         "Close" beside Download PDF. That second one was never anything
         but a worse copy of this one -- back-to-sunscout-btn ALSO closes
         the tab (see its listener below), it just tries window.opener.focus()
         first when this report opened from the BlindSpot tab, which is the
         common case and strictly better than closing blind. Two buttons
         both labeled "close" that do almost the same thing read as a
         mistake, not a choice, so the redundant one is gone. -->
    <button id="back-to-sunscout-btn" style="background:#fff;color:${WINE};border:1px solid ${WINE};padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;">← Close</button>
    <button id="print-btn" style="background:${CARD};color:${MUTE};border:1px solid ${LINE};padding:10px 16px;font-size:13px;cursor:pointer;">Print</button>
    <button id="download-pdf-btn" style="background:${GRADIENT};color:#fff;border:none;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(61,65,22,0.3);display:inline-flex;align-items:center;gap:7px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>Download PDF</button>
  </div>

  <div id="report-root" style="max-width:900px;margin:0 auto;background:#fff;">

    <!-- Page 1: cover / verdict / neighbourhood / summary / table -->
    <div class="pdf-page" style="padding:36px 32px 28px;">
      <div style="border-bottom:2px solid ${LINE_SOFT};padding-bottom:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">
          ${markDataUri ? `<img src="${markDataUri}" alt="BlindSpot" style="width:18px;height:20px;object-fit:contain;display:block;"/>` : ''}
          <span style="font-size:12px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;">${hasNeighbourhood ? 'BlindSpot Report' : 'BlindSpot Home Comfort'}</span>
        </div>
        ${labelPill}
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
          <h1 style="font-size:24px;font-weight:800;color:${INK};margin:0;font-family:${DISPLAY};letter-spacing:-.01em;">${safeAddress}</h1>
          ${badge ? `<span style="background:${badge.color};color:#fff;font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:20px;">${badge.text}</span>` : ''}
        </div>
        <div style="font-size:11px;color:${DIM};display:flex;align-items:center;gap:5px;"><span style="color:${DIM};">${PIN_SVG}</span>${parseFloat(lat).toFixed(5)}°N, ${parseFloat(lon).toFixed(5)}°E · ${date}</div>

        <p style="font-size:12.5px;line-height:1.6;color:${MUTE};margin-top:10px;max-width:72ch;font-family:${DISPLAY};">
          ${hasNeighbourhood
            ? `Every figure is a government record or a calculation from the sun's real path over this block. Estimates are marked as such.`
            : `Every figure is calculated from the sun's real path over this block. Estimates are marked as such.`}
        </p>
      </div>

      ${openingSection}
      ${strengthsSection}
      ${livingSection}
      ${suitsSection}
    </div>

    <!-- One logical page per group. The exporter slices anything taller
         than A4 at a fixed height, which used to cut lines in half; giving
         each group its own .pdf-page puts the breaks between sections. -->
    ${(togetherSection || areaSection) ? `
    <div class="pdf-page" style="padding:14px 32px 20px;">
      ${stripLeadRule(togetherSection)}
      ${togetherSection ? areaSection : stripLeadRule(areaSection)}
    </div>` : ''}

    <div class="pdf-page" style="padding:14px 32px 20px;">
      ${stripLeadRule(flatSection)}
      ${personaSection}
    </div>


    <!-- Final page: what to verify, methodology, footer -->
    <div class="pdf-page" style="padding:14px 32px 32px;">
      ${stripLeadRule(checkSection)}
      <details style="border:1px solid ${LINE_SOFT};padding:14px 20px;margin-top:${checkSection ? '18px' : '0'};border-radius:8px;">
        <summary style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.08em;cursor:pointer;">View Data Methodology and Sources</summary>
        <p style="font-size:11.5px;color:${MUTE};line-height:1.6;margin:10px 0;">Calculated using exact sun angles for this floor, official police records, and public municipal data.</p>
        <ul style="margin:0;padding-left:18px;font-size:11px;color:${DIM};line-height:1.6;">
          ${hasNeighbourhood ? `<li>The Neighbourhood Score, its factor scores, crime, schools and price context come from public records. They are the same for every unit in this pincode and are not AI-generated.</li>` : ''}
          ${hasNeighbourhood ? `<li>BlindSpot overall score = Neighbourhood Score ${avRecord.nqi_composite} × ${Math.round((areaWeight ?? 0.5) * 100)}% + Home Comfort Score ${unitScore ?? '-'} × ${Math.round((unitWeight ?? 0.5) * 100)}% = ${combinedScore ?? '-'}. A weighted average, not AI-generated.</li>` : ''}
          <li>Sun position and monthly sunlight hours are calculated using exact sun angles for this floor. Deterministic, not AI-generated.</li>
          <li>Floor clearance uses a generic urban-obstruction estimate, not a measurement of this property's specific neighboring buildings.</li>
          ${summary?.buildingHeightNote ? `<li>${summary.buildingHeightNote.sentence}</li>` : ''}
          ${safeFacingAssumptionNote ? `<li>${safeFacingAssumptionNote}</li>` : ''}
          <li>The written sections use AI to interpret the numbers above. It is given them as fact and told not to estimate its own.</li>
          <li>The ${shotCount || 12} map images this is read from, and the description of each, are in the separate Sun &amp; Shadow document.</li>
        </ul>
      </details>

      <div style="border-top:1px solid ${LINE_SOFT};padding-top:12px;margin-top:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:7px;">
          ${markDataUri ? `<img src="${markDataUri}" alt="BlindSpot" style="width:12px;height:13px;object-fit:contain;opacity:.5;"/>` : ''}
          <div style="font-size:10px;color:${DIM};">${hasNeighbourhood ? 'BlindSpot Report' : 'Home Comfort Report'} · BlindSpot</div>
        </div>
        <div style="font-size:10px;color:${DIM};">3D Map: OSMBuildings · AI-assisted narrative · Solar geometry: NOAA algorithm</div>
      </div>
    </div>
  </div>
  ${mainChrome.close}

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
          // canvas for the whole document - this is what avoids the blank-
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
  const galleryChrome = printChrome('Sun &amp; Shadow');
  const galleryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Sun &amp; Shadow - ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${DISPLAY};background:${BG};color:${INK};-webkit-font-smoothing:antialiased}
    img{max-width:100%}
    /* The tiled gallery grid. auto-fill/minmax instead of a fixed column
       count: a season has at most 3 frames, so this sits at 3-across on a
       normal desktop window, drops to 2 on a narrower one, and the
       sub-560px rule below takes it to a single column on a phone rather
       than letting minmax alone decide (220px still fits 2-up around
       440-560px, which read as cramped for a photo plus a paragraph). */
    .shot-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
      gap:30px 22px;
    }
    .shot-card{ min-width:0 }
    @media (max-width:560px){
      .gallery-wrap{ padding-left:18px!important; padding-right:18px!important; }
      .shot-grid{ grid-template-columns:1fr; gap:32px; }
    }
    @media print{
      .no-print{display:none!important}
      body{background:#fff}
      .pdf-page{page-break-inside:avoid}
      .shot-card{page-break-inside:avoid}
    }
    ${galleryChrome.css}
  </style>
</head>
<body>${galleryChrome.open}
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

  <div class="gallery-wrap" style="max-width:880px;margin:0 auto;padding:0 32px 60px;background:#fff;">

    ${/* No border-bottom here -- the section right after this one
          (screenshotPages, or the monthly table when there are no photos)
          already draws its own border-top in the same 2px ink, so this used
          to double up: two black rules stacked with the 34px margin sitting
          between them as a visible gap, instead of the one divider it reads
          as everywhere else on this page. */''}
    <div style="padding:44px 0 30px;margin-bottom:34px;">
      <div style="font-size:11.5px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;margin-bottom:11px;">A year of sun over this block</div>
      <h1 style="font-family:${DISPLAY};font-size:29px;font-weight:800;color:${INK};letter-spacing:-.015em;line-height:1.15;margin-bottom:9px;">${safeAddress}</h1>
      <div style="font-size:13px;color:${DIM};margin-bottom:18px;">Floor ${safeFloor}, facing ${safeFacing} &middot; ${parseFloat(lat).toFixed(5)}&deg;N, ${parseFloat(lon).toFixed(5)}&deg;E &middot; ${date}</div>
      <p style="font-size:14.5px;color:${MUTE};line-height:1.8;max-width:64ch;">
        ${shotCount >= 12
          ? `The 3D map at this exact pin, photographed twelve times: three points in each season, at 9am, noon and 3pm. The dark areas are real shadows, cast by the real buildings around this one. The orange dot is the property.`
          : `The 3D map at this exact pin, photographed ${shotCount} times through the year. The dark areas are real shadows, cast by the real buildings around this one. The orange dot is the property.`}
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

    ${/* The pictures come first and the numbers follow them. A reader
          opening this wants to see the light on the building; a twelve-row
          table of usable-hours figures in front of that is the appendix
          arriving before the thing it is an appendix to. */''}
    ${screenshotPages ? `
    <div style="border-top:2px solid ${INK};padding-top:30px;margin-bottom:26px;">
      <div style="font-size:11.5px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;">What that looks like on the ground</div>
    </div>` : ''}

    ${screenshotPages}

    ${monthlyTableSection ? `
    <div style="border-top:2px solid ${INK};padding-top:30px;margin-top:38px;margin-bottom:36px;">
      <div style="font-size:11.5px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;">Sunlight, month by month</div>
      <p style="font-size:13px;color:${DIM};line-height:1.7;margin-bottom:16px;max-width:64ch;">
        Floor ${safeFloor}, facing ${safeFacing}. Sunrise and sunset are true for this location; usable hours and
        floor clearance are calculated from the sun's angle against a general estimate of the buildings around it.
      </p>
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
${galleryChrome.close}
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
