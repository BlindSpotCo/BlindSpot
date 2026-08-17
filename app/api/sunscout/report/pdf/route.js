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
function formatNarrative(rawAnalysis) {
  return rawAnalysis
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
    reportLabel,
    facingAssumptionNote,
    avRecord, combinedScore, unitScore, areaWeight, unitWeight,
    unitSubScores, verdictLabel,
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

  const { perImage, rest: rawRest } = splitPerImageAnalysis(safeAnalysis, shotCount);
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
  const { body: neighbourhoodBody, rest: afterNeighbourhood } = hasNeighbourhood
    ? extractSection(afterVerdict, /neighbourhood full analysis/i)
    : { body: '', rest: afterVerdict };

  const rawAnalysis = afterNeighbourhood;

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
  const formattedAnalysis = formatNarrative(rawAnalysis);

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

  const scorecardCards = [];
  if (summary?.solarFeasibility) {
    scorecardCards.push({
      label: 'Sunlight', value: summary.solarFeasibility.verdict,
      detail: `${summary.solarFeasibility.avgUsableHours}h/day avg`, color: SUN,
    });
  }
  if (shadeHeatSub) {
    scorecardCards.push({
      label: 'Energy / Cooling',
      value: shadeHeatSub.score >= 70 ? 'Low risk' : shadeHeatSub.score >= 40 ? 'Fair' : 'High risk',
      detail: shadeHeatSub.summary, color: gradeColor(shadeHeatSub.score),
    });
  }
  if (hasNeighbourhood && (avRecord.scores?.schools != null || avRecord.scores?.crime != null)) {
    const schools = avRecord.scores?.schools, crime = avRecord.scores?.crime;
    const avg = ((schools ?? 55) + (crime ?? 55)) / 2;
    scorecardCards.push({
      label: 'Family Friendliness',
      value: avg >= 75 ? 'Strong' : avg >= 55 ? 'Moderate' : 'Limited',
      detail: `Schools ${schools ?? '—'}, crime ${crime ?? '—'}`, color: gradeColor(avg),
    });
  }
  // Elderly Suitability -- derived from floor (lift dependency risk on
  // higher floors), roads score (walkability proxy), and crime score
  // (safety). No medical-facility-proximity data exists in AsliVastu yet,
  // so that gap is named honestly in the detail line rather than implied.
  if (hasNeighbourhood && (avRecord.scores?.roads != null || avRecord.scores?.crime != null)) {
    const roadsScore = avRecord.scores?.roads, crimeScoreForElderly = avRecord.scores?.crime;
    const floorN2 = parseInt(floor) || 0;
    const floorPenalty = floorN2 <= 2 ? 0 : floorN2 <= 6 ? 10 : 20;
    const elderlyBase = ((roadsScore ?? 55) + (crimeScoreForElderly ?? 55)) / 2;
    const elderlyScore = Math.max(0, elderlyBase - floorPenalty);
    scorecardCards.push({
      label: 'Elderly Suitability',
      value: elderlyScore >= 70 ? 'Good' : elderlyScore >= 45 ? 'Fair' : 'Limited',
      detail: `Floor ${floorN2}${roadsScore != null ? `, roads ${roadsScore}` : ''}${crimeScoreForElderly != null ? `, crime ${crimeScoreForElderly}` : ''} — medical proximity not yet mapped`,
      color: gradeColor(elderlyScore),
    });
  }
  // Indoor Plants -- most houseplants want consistent moderate light, not
  // extremes; too little usable sun struggles to sustain them, too much
  // (especially on hot-facing units) risks scorching/drying. Air quality
  // factors in where available since it affects plant health too.
  if (summary?.solarFeasibility) {
    const avgH = summary.solarFeasibility.avgUsableHours;
    const airScoreForPlants = avRecord?.scores?.air;
    let plantsValue, plantsColor;
    if (avgH >= 2 && avgH <= 8) { plantsValue = 'Good'; plantsColor = GOOD; }
    else if (avgH > 8) { plantsValue = 'Fair — may need shading'; plantsColor = OK; }
    else { plantsValue = 'Limited — low light'; plantsColor = OK; }
    if (airScoreForPlants != null && airScoreForPlants < 50 && plantsColor === GOOD) { plantsValue = 'Fair'; plantsColor = OK; }
    const plantsDetailParts = [`${avgH}h/day avg light`];
    if (airScoreForPlants != null) plantsDetailParts.push(`air quality ${airScoreForPlants}`);
    scorecardCards.push({ label: 'Indoor Plants', value: plantsValue, detail: plantsDetailParts.join(' · '), color: plantsColor });
  }
  if (summary?.monthlySummary) {
    const hours = summary.monthlySummary.map(m => m.usableHours);
    const zeroMonths = summary.monthlySummary.filter(m => m.usableHours === 0);
    const max = Math.max(...hours), min = Math.min(...hours);
    if (zeroMonths.length >= 2) {
      scorecardCards.push({
        label: 'Work-From-Home Fit', value: 'Inconsistent',
        detail: `No light ${zeroMonths[0].month.slice(0,3)}–${zeroMonths[zeroMonths.length-1].month.slice(0,3)}`, color: OK,
      });
    } else if (max - min > 6) {
      scorecardCards.push({
        label: 'Work-From-Home Fit', value: 'Seasonal',
        detail: `${min.toFixed(1)}–${max.toFixed(1)}h swing across the year`, color: OK,
      });
    } else {
      scorecardCards.push({
        label: 'Work-From-Home Fit', value: 'Consistent',
        detail: `${min.toFixed(1)}–${max.toFixed(1)}h year-round`, color: GOOD,
      });
    }
  }
  if (hasNeighbourhood && avRecord.price_context?.rate_sqft) {
    scorecardCards.push({
      label: 'Investment Band', value: avRecord.price_context.label || 'Priced',
      detail: `₹${Math.round(avRecord.price_context.rate_sqft[0]).toLocaleString('en-IN')}–₹${Math.round(avRecord.price_context.rate_sqft[1]).toLocaleString('en-IN')}/sqft`,
      color: WINE,
    });
  }
  // Rental Appeal card removed -- nothing in BlindSpot actually computes
  // rental data yet, and a permanent "Needs data" placeholder wasn't wanted
  // in the scorecard.
  if (windSub) {
    scorecardCards.push({
      label: 'Ventilation',
      value: windSub.score >= 70 ? 'Good' : windSub.score >= 40 ? 'Moderate' : 'Limited',
      detail: windSub.summary, color: gradeColor(windSub.score),
    });
  } else {
    scorecardCards.push({ label: 'Ventilation', value: 'Needs data', detail: 'Not yet computed', color: DIM });
  }

  const scorecardSection = `
    <div style="border:1px solid ${LINE};padding:24px 28px;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;">Consumer Scorecard</div>
      <div style="display:flex;flex-wrap:wrap;gap:1px;background:${LINE};">
        ${scorecardCards.map(c => `
          <div style="background:#fff;flex:1;min-width:150px;padding:14px 16px;">
            <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">${escapeHtml(c.label)}</div>
            <div style="font-size:16px;font-weight:800;color:${c.color};font-family:${DISPLAY};margin-bottom:3px;">${escapeHtml(String(c.value))}</div>
            <div style="font-size:10.5px;color:${DIM};line-height:1.5;">${escapeHtml(c.detail)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  // Pros / Cons -- same threshold logic across whatever data is available
  // (works for both the combined report and the unit-only fallback).
  const pros = [], cons = [];
  if (hasNeighbourhood && avRecord.scores) {
    for (const [key, label] of Object.entries(FACTOR_LABELS)) {
      const v = avRecord.scores[key];
      if (v == null) continue;
      if (v >= 80) pros.push(`${label} is excellent (${v}/100)`);
      else if (v < 50) cons.push(`${label} is weak (${v}/100)`);
    }
  }
  if (summary?.solarFeasibility) {
    const { bestMonths, avgUsableHours } = summary.solarFeasibility;
    if (avgUsableHours >= 6) pros.push(`Strong sun exposure through ${bestMonths.join('/')}`);
    const zero = summary.monthlySummary.filter(m => m.usableHours === 0);
    if (zero.length) cons.push(`No direct sun ${zero[0].month}${zero.length > 1 ? `–${zero[zero.length-1].month}` : ''} (${zero.length} month${zero.length > 1 ? 's' : ''})`);
  }
  if (shadeHeatSub) {
    if (shadeHeatSub.score >= 70) pros.push('Naturally well-shaded — low summer heat gain');
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

  const prosConsSection = (pros.length || cons.length || idealForText) ? `
    <div style="border:1px solid ${LINE};padding:24px 28px;margin-bottom:28px;">
      <div style="display:flex;gap:28px;flex-wrap:wrap;${idealForText ? `margin-bottom:18px;` : ''}">
        <div style="flex:1;min-width:220px;">
          <div style="font-size:11px;font-weight:700;color:${GOOD};text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">Pros</div>
          ${pros.map(p => `<div style="display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:${INK};line-height:1.5;"><span style="color:${GOOD};font-weight:800;">+</span>${escapeHtml(p)}</div>`).join('') || `<div style="font-size:12.5px;color:${DIM};">Nothing stands out strongly either way.</div>`}
        </div>
        <div style="flex:1;min-width:220px;">
          <div style="font-size:11px;font-weight:700;color:${POOR};text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">Cons</div>
          ${cons.map(c => `<div style="display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:${INK};line-height:1.5;"><span style="color:${POOR};font-weight:800;">−</span>${escapeHtml(c)}</div>`).join('') || `<div style="font-size:12.5px;color:${DIM};">No major red flags in the data.</div>`}
        </div>
      </div>
      ${idealForText ? `
      <div style="border-top:1px solid ${LINE_SOFT};padding-top:16px;">
        <div style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Ideal For</div>
        <div style="font-size:13.5px;color:${INK};line-height:1.6;">${escapeHtml(idealForText)}</div>
      </div>` : ''}
    </div>` : '';

  const seasons = ['Summer', 'Winter', 'Spring', 'Autumn'];
  const shotsWithIndex = screenshots.map((s, i) => ({ ...s, idx: i }));
  const grouped = seasons.map(s => ({
    season: s,
    shots: shotsWithIndex.filter(sc => sc.label.startsWith(s)),
  })).filter(g => g.shots.length > 0);

  // Each season is its own `.pdf-page` — kept as separate, moderately-sized
  // canvases when exporting (see the script at the bottom).
  const screenshotPages = grouped.map((g) => `
    <div class="pdf-page" style="padding:40px 32px;background:#fff;">
      <h3 style="font-size:22px;font-weight:800;color:${INK};margin-bottom:18px;font-family:${DISPLAY};letter-spacing:-.01em;padding-bottom:10px;border-bottom:2px solid ${LINE_SOFT};display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${SUN};"></span>${g.season}
      </h3>
      <div style="display:flex;flex-direction:column;gap:22px;">
        ${g.shots.map((shot) => `
          <div class="shot-card" style="border:1px solid ${LINE}; overflow:hidden;box-shadow:0 3px 14px rgba(28,24,18,0.06);">
            <div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#0A0C10;position:relative;">
              <img src="${shot.base64}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${shot.label}"/>
              ${PROPERTY_MARKER_HTML}
              <div style="position:absolute;top:12px;left:12px;background:rgba(201,129,46,0.95);color:#fff;font-size:16px;font-weight:800;padding:5px 14px;letter-spacing:.02em;box-shadow:0 3px 10px rgba(0,0,0,0.25);">${shot.label.split(' · ')[1] || shot.label}</div>
            </div>
            ${perImage[shot.idx] ? `
            <div style="padding:16px 20px;background:#fff;border-top:1px solid ${LINE_SOFT};">
              <div style="font-size:14.5px;color:${MUTE};line-height:1.8;">${perImage[shot.idx]}</div>
            </div>` : ''}
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

  // Combined BlindSpot score / area / unit stat row -- only shown when this
  // report was generated from the Property Score flow (avRecord present).
  // Uses the same sun→wine gradient as the site's own buttons/CTAs instead
  // of a flat black card, so it reads as "BlindSpot" rather than generic.
  const combinedScoreSection = hasNeighbourhood ? `
    <div style="display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap;">
      <div style="background:${GRADIENT};padding:16px 20px;flex:1.3;min-width:160px;">
        <div style="font-size:9.5px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">BlindSpot Combined Score</div>
        <div style="font-size:32px;font-weight:800;color:#fff;font-family:${DISPLAY};line-height:1;">${combinedScore ?? '—'}<span style="font-size:14px;color:rgba(255,255,255,0.75);">/100</span></div>
      </div>
      <div style="background:${CARD};border:1px solid ${LINE};padding:16px 20px;flex:1;min-width:140px;">
        <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Neighbourhood — ${safeAreaName}</div>
        <div style="font-size:24px;font-weight:800;color:${WINE};font-family:${DISPLAY};">${avRecord.nqi_composite}<span style="font-size:12px;color:${DIM};">/100</span></div>
        <div style="font-size:10px;color:${DIM};margin-top:2px;">${Math.round((areaWeight ?? 0.5) * 100)}% weight · Grade ${escapeHtml(avRecord.grade ?? '—')}</div>
      </div>
      <div style="background:${CARD};border:1px solid ${LINE};padding:16px 20px;flex:1;min-width:140px;">
        <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Home Comfort — this unit</div>
        <div style="font-size:24px;font-weight:800;color:${SUN};font-family:${DISPLAY};">${unitScore ?? '—'}<span style="font-size:12px;color:${DIM};">/100</span></div>
        <div style="font-size:10px;color:${DIM};margin-top:2px;">${Math.round((unitWeight ?? 0.5) * 100)}% weight · Floor ${safeFloor}, ${safeFacing}</div>
      </div>
    </div>` : '';

  // Home Buyer Verdict -- the report's opening statement, pulled out of the
  // AI text and given its own prominent block so it reads first, on its own,
  // ahead of every other section (per-image detail, floor/facing reasoning,
  // neighbourhood breakdown). Light card, NOT a dark hero block -- this is
  // a paragraph of body text meant to be read comfortably, so it uses the
  // same warm cream card treatment as the rest of the report with a wine
  // accent border, rather than reversed-out white-on-dark.
  const verdictBoxSection = formattedVerdictBody ? `
    <div style="background:${CARD};border:1px solid ${LINE};border-left:5px solid ${WINE};padding:26px 28px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${WINE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h2 style="font-size:12.5px;font-weight:800;color:${WINE};text-transform:uppercase;letter-spacing:.1em;font-family:${DISPLAY};">Home Buyer Verdict</h2>
      </div>
      <div style="font-size:15px;line-height:1.85;color:${INK};">
        ${formattedVerdictBody.replace(new RegExp(`color:${MUTE}`, 'g'), `color:${INK}`)}
      </div>
    </div>` : '';

  // Neighbourhood Full Analysis -- AI narrative grounded in AsliVastu's real
  // factor scores, crime detail, schools, and price context. Styled with
  // the exact same card treatment (border, padding, icon size, heading
  // style) as the Sun & Shadow section below it, so neither side reads as
  // the "main" report with the other as an appendix -- both get equal
  // visual weight, just a different accent colour (wine for neighbourhood,
  // sun for the unit/solar side).
  const neighbourhoodFactorRows = hasNeighbourhood ? Object.entries(avRecord.scores || {}).map(([k, v]) => {
    const label = ({ crime:'Crime', infrastructure:'Infrastructure', air:'Air Quality', power:'Power', schools:'Schools', water:'Water', roads:'Roads', sewerage:'Sewerage' })[k] || k;
    const color = v >= 75 ? GOOD : v >= 50 ? OK : POOR;
    return `
      <div style="flex:1;min-width:110px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:${DIM};margin-bottom:4px;"><span>${escapeHtml(label)}</span><span style="font-weight:700;color:${INK};">${v}</span></div>
        <div style="background:${LINE_SOFT};height:5px;"><div style="width:${v}%;height:100%;background:${color};"></div></div>
      </div>`;
  }).join('') : '';

  const neighbourhoodSection = hasNeighbourhood ? `
    <div style="border:1px solid ${LINE};padding:28px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${WINE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <h2 style="font-size:16px;font-weight:800;color:${INK};font-family:${DISPLAY};">Neighbourhood Analysis — ${safeAreaName}</h2>
      </div>
      <div style="font-size:11px;color:${DIM};margin-bottom:18px;">Area-level — the same for every unit in this pincode. Source: Neighbourhood Score.</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px;">
        ${neighbourhoodFactorRows}
      </div>
      ${avRecord.total_cognizable_crimes != null || avRecord.schools_count != null ? `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px;">
        ${avRecord.total_cognizable_crimes != null ? `
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;">
          <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Crime</div>
          <div style="font-size:13px;color:${INK};">${avRecord.total_cognizable_crimes}/yr · safer than ${avRecord.crime_percentile ?? '—'}% of areas</div>
        </div>` : ''}
        ${avRecord.schools_count != null ? `
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;">
          <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Schools mapped</div>
          <div style="font-size:13px;color:${INK};">${avRecord.schools_count}${(avRecord.schools_list?.length) ? ` — incl. ${escapeHtml(avRecord.schools_list.slice(0,3).map(s=>s.name).join(', '))}` : ''}</div>
        </div>` : ''}
        ${avRecord.price_context?.rate_sqft ? `
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;">
          <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Price context</div>
          <div style="font-size:13px;color:${INK};">₹${Math.round(avRecord.price_context.rate_sqft[0]).toLocaleString('en-IN')}–₹${Math.round(avRecord.price_context.rate_sqft[1]).toLocaleString('en-IN')}/sqft</div>
        </div>` : ''}
      </div>` : ''}
      ${formattedNeighbourhoodBody}
    </div>` : '';

  // Written narrative for the sun/shadow side (floor + facing reasoning).
  // In the unit-only report this doubles as the overall summary; in the
  // combined report the Verdict + Neighbourhood boxes above already cover
  // the overall picture, so this is scoped explicitly to sun & shadow --
  // and matches the neighbourhood card's exact styling for visual parity.
  const fullAnalysisSection = `
    <div style="border:1px solid ${LINE};padding:28px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${SUN}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/></svg>
        <h2 style="font-size:16px;font-weight:800;color:${INK};font-family:${DISPLAY};">${hasNeighbourhood ? 'Sun &amp; Shadow Analysis' : 'Summary'} — Floor ${safeFloor}, ${safeFacing}-facing</h2>
      </div>
      ${summary?.solarFeasibility ? `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px;">
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${GOOD};flex-shrink:0;"></span>
          <div><div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.06em;">Best Months</div><div style="font-size:12.5px;font-weight:700;color:${INK};">${summary.solarFeasibility.bestMonths.join(', ')}</div></div>
        </div>
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${POOR};flex-shrink:0;"></span>
          <div><div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.06em;">Worst Months</div><div style="font-size:12.5px;font-weight:700;color:${INK};">${summary.solarFeasibility.worstMonths.join(', ')}</div></div>
        </div>
        <div style="background:${CARD};border:1px solid ${LINE};padding:12px 16px;flex:1;min-width:130px;display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${SUN};flex-shrink:0;"></span>
          <div><div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.06em;">Daily Average</div><div style="font-size:12.5px;font-weight:700;color:${INK};">${summary.solarFeasibility.avgUsableHours}h usable sun</div></div>
        </div>
      </div>` : ''}
      ${formattedAnalysis}
      ${sunBarChart}
      ${summary?.solarFeasibility ? `<div style="font-size:11px;color:${DIM};">Best months: ${summary.solarFeasibility.bestMonths.join(', ')} · Worst months: ${summary.solarFeasibility.worstMonths.join(', ')}</div>` : ''}
    </div>`;

  const mainHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${hasNeighbourhood ? 'BlindSpot Combined Report' : 'Home Comfort Report'} — ${safeAddress}</title>
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
          <span style="font-size:11px;color:${DIM};">${hasNeighbourhood ? 'Neighbourhood &amp; Home Comfort — One Verdict' : 'Home Buyer Solar Report · Visual AI Analysis'}</span>
        </div>
        ${labelPill}
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
          <h1 style="font-size:27px;font-weight:800;color:${INK};margin:0;font-family:${DISPLAY};letter-spacing:-.01em;">${safeAddress}</h1>
          ${badge ? `<span style="background:${badge.color};color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;padding:5px 12px;text-transform:uppercase;">${badge.text}</span>` : ''}
        </div>
        <div style="font-size:11px;color:${DIM};display:flex;align-items:center;gap:5px;"><span style="color:${DIM};">${PIN_SVG}</span>${parseFloat(lat).toFixed(5)}°N, ${parseFloat(lon).toFixed(5)}°E · ${date}</div>
      </div>

      <div style="display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="background:${CARD};border:1px solid ${LINE};padding:14px 18px;flex:1;min-width:120px;">
          <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Floor</div>
          <div style="font-size:30px;font-weight:800;color:${SUN};line-height:1;font-family:${DISPLAY};">${safeFloor}</div>
          <div style="font-size:10px;color:${DIM};margin-top:2px;">≈${(parseInt(floor)||0)*3}m height</div>
        </div>
        <div style="background:${CARD};border:1px solid ${LINE};padding:14px 18px;flex:1;min-width:120px;">
          <div style="font-size:9.5px;color:${DIM};text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Facing</div>
          <div style="font-size:30px;font-weight:800;color:${SUN};line-height:1;font-family:${DISPLAY};">${safeFacing}</div>
          <div style="font-size:10px;color:${DIM};margin-top:2px;">${facingAssumptionNote ? 'window orientation · assumed, unconfirmed' : 'window orientation'}</div>
        </div>
        <a id="gallery-link-card" href="__GALLERY_URL__" target="_blank" rel="noopener" style="background:${CARD};border:1px solid ${LINE};padding:14px 18px;flex:3;min-width:200px;display:flex;align-items:center;gap:12px;text-decoration:none;cursor:pointer;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${WINE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 20l6-6 4 4 8-8"/><path d="M15 6h6v6"/></svg>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:${INK};">${hasNeighbourhood ? 'See the evidence: neighbourhood data + sun/shadow images' : 'Real 3D map with sun and shadow path'}</div>
            <div style="font-size:11px;color:${DIM};margin-top:2px;">${shotCount || 12} real map angles, each with its own AI analysis — opens in a new tab →</div>
          </div>
        </a>
      </div>

      ${combinedScoreSection}
      ${verdictBoxSection}
      ${scorecardSection}
      ${prosConsSection}
      ${neighbourhoodSection}
      ${fullAnalysisSection}
    </div>

    <!-- Final page: methodology + footer -->
    <div class="pdf-page" style="padding:40px 32px 48px;">
      <div style="border:1px solid ${LINE_SOFT};padding:20px 24px;">
        <div style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">How this report was built</div>
        <ul style="margin:0;padding-left:18px;font-size:11.5px;color:${DIM};line-height:1.7;">
          ${hasNeighbourhood ? `<li>Neighbourhood factor scores, crime, schools, and price context come from Neighbourhood Score — the same for every unit in this pincode, deterministic, not AI-generated.</li>` : ''}
          ${hasNeighbourhood ? `<li>The Combined Score is (${avRecord.nqi_composite} × ${Math.round((areaWeight ?? 0.5) * 100)}%) + (${unitScore ?? '—'} × ${Math.round((unitWeight ?? 0.5) * 100)}%) = ${combinedScore ?? '—'} — a weighted average, not AI-generated.</li>` : ''}
          <li>Sun position and monthly sunlight hours come from a NOAA solar-geometry algorithm — deterministic, not AI-generated.</li>
          <li>Floor clearance uses a generic urban-obstruction estimate, not a measurement of this property's specific neighboring buildings.</li>
          ${summary?.buildingHeightNote ? `<li>${summary.buildingHeightNote.sentence}</li>` : ''}
          ${safeFacingAssumptionNote ? `<li>${safeFacingAssumptionNote}</li>` : ''}
          <li>The narrative sections use AI to interpret the real numbers above and describe the screenshots — it is instructed to treat the figures as fact, not to estimate its own.</li>
          <li>The ${shotCount || 12} sun/shadow map screenshots and their per-image analysis are in a separate gallery, linked near the top of this report (and clickable in the downloaded PDF too) — that link works as long as the browser tab this report was generated in stays open; it won't work if reopened later in a new session, since the gallery isn't hosted on a server yet.</li>
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

          // The rasterized page is one flat image, so nothing on it is
          // clickable by default -- add a real jsPDF link annotation on top
          // of wherever the "See the evidence" gallery card actually landed
          // on this page, pointing at the same URL the on-screen card links
          // to. Only page 1 (i === 0) has the card, and it sits near the
          // top, so it's always on this first (position 0) slice.
          if (i === 0) {
            var galleryLink = document.getElementById('gallery-link-card');
            if (galleryLink && galleryLink.href) {
              var pageRect = pages[i].getBoundingClientRect();
              var linkRect = galleryLink.getBoundingClientRect();
              var scaleFactor = imgWidth / pageRect.width;
              pdf.link(
                (linkRect.left - pageRect.left) * scaleFactor,
                (linkRect.top - pageRect.top) * scaleFactor,
                linkRect.width * scaleFactor,
                linkRect.height * scaleFactor,
                { url: galleryLink.href }
              );
            }
          }

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
        status.textContent = 'Download failed — try Print instead.';
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  // Standalone gallery document -- the 12 real map screenshots + their
  // per-image AI analysis, which used to be embedded straight into the main
  // report and made it very long to scroll through. Now it's its own page,
  // linked from the "See the evidence" card near the top of the main
  // report. Kept deliberately simple (no jsPDF download, no page-splitting
  // machinery) since it's a reference/evidence view, not the artifact
  // someone downloads and shares.
  const galleryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Sun &amp; Shadow Images — ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:${BG};color:${INK}}
    @media print{ .no-print{display:none!important} body{background:#fff;} img{max-width:100%;} }
  </style>
</head>
<body>
  <div class="no-print" style="position:sticky;top:0;z-index:100;background:${BG};border-bottom:1px solid ${LINE};padding:14px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
    <div style="display:flex;align-items:center;gap:9px;">
      ${markDataUri ? `<img src="${markDataUri}" alt="BlindSpot" style="width:16px;height:18px;object-fit:contain;"/>` : ''}
      <span style="font-size:12px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.1em;">Sun &amp; Shadow Evidence</span>
      <span style="font-size:11px;color:${DIM};">${safeAddress} · Floor ${safeFloor}, ${safeFacing}-facing</span>
    </div>
    <button onclick="if(window.opener&&!window.opener.closed){window.opener.focus();window.close();}else{window.close();}" style="background:#fff;color:${WINE};border:1px solid ${WINE};padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">← Back to report</button>
  </div>

  <div style="max-width:900px;margin:0 auto;padding:28px 32px 56px;background:#fff;">
    <p style="font-size:13px;color:${DIM};line-height:1.7;margin-bottom:8px;">
      ${shotCount || 12} real screenshots of the 3D map at this exact pin — 3 per season, at 9am / noon / 3pm — each with its own AI description of what's casting shade and how much of the unit is in sun at that moment.
    </p>
    ${monthlyTableSection ? `
    <div style="padding:24px 0 40px;">
      <div style="font-size:11px;font-weight:700;color:${WINE};text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Appendix — Full Technical Data</div>
      ${monthlyTableSection}
    </div>` : ''}
    ${screenshotPages}
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
      analysis: 'No analysis available — use POST endpoint with screenshots.',
      summary: null,
    }),
  }));
}
