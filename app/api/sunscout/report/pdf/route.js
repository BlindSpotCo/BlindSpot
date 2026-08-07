// app/api/report/pdf/route.ts
// Accepts screenshots + a deterministic monthly summary + AI analysis and
// builds the HTML report. The table renders straight from computed data so
// the buyer always gets real numbers even if the AI narrative is short/empty.
//
// v4 — fixes the blank-PDF bug:
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
//
// Also: per-image analysis is now larger/more descriptive (see the prompt
// in analyse/route.ts), each screenshot gets a crosshair overlay marking
// the property location, and the closing "Summary" section carries the
// full sections 2-4 narrative rather than a compressed version.

import { NextResponse } from 'next/server';

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

/** Pulls the "@N@ description" lines Gemini emits for section 1 and returns
 *  { perImage: {index -> text}, rest: analysis text with section 1 stripped } */
function splitPerImageAnalysis(analysis, shotCount) {
  const perImage = {};
  const lineRegex = /^@(\d+)@\s*(.+)$/gm;
  let m;
  while ((m = lineRegex.exec(analysis))) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < shotCount) perImage[idx] = m[2].trim();
  }

  // Strip the section-1 header line and every @N@ line so the bottom
  // narrative doesn't repeat what's now shown under each screenshot. If
  // Gemini didn't follow the @N@ format (imperfect compliance), nothing
  // matches above and nothing is stripped here — the full text just falls
  // through to the bottom narrative as a safe fallback.
  const rest = analysis
    .replace(/^1\.\s*SHADOW ANALYSIS[^\n]*\n?/im, '')
    .replace(/^@\d+@.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { perImage, rest };
}

// Pure reordering, not a rewrite: moves the "Home Buyer Verdict" section to
// the front and renumbers the headers to match, without touching a single
// word of what Gemini actually wrote. If no numbered sections are found (or
// no verdict section exists), the text is returned completely unchanged.
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
  return reordered.map((s, i) => `${i + 1}. ${s.title}${s.body}`.trimEnd()).join('\n\n').trim();
}

// Crosshair overlay marking the property location — shown once, on the
// first screenshot only, as a reference for the rest of the set (repeating
// it on every image risked appearing to sit "behind" a building in shots
// where the camera angle/zoom shifts it away from true center).
// Property marker overlay — plain orange dot, same style as the live map
// pin, shown on every screenshot. Deliberately NOT using an SVG + CSS
// transform for centering: that combination is a known html2canvas failure
// point (it can silently drop transform-positioned elements when rasterizing
// for the PDF export, which is why the old crosshair vanished from the
// downloaded file even when it was visible on screen). Plain flexbox
// centering has no transform to lose, so it survives the canvas render.
const PROPERTY_MARKER_HTML = `
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
    <div style="width:10px;height:10px;border-radius:50%;background:#E07B00;border:3px solid #fff;box-shadow:0 0 0 3px rgba(224,123,0,0.5),0 2px 8px rgba(0,0,0,0.5);"></div>
  </div>`;

export async function POST(req) {
  const {
    lat, lon, address, floor, facing, screenshots, analysis, summary,
    reportLabel,
    facingAssumptionNote,
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
  const safeAnalysis = escapeHtml(analysis);
  if (summary?.solarFeasibility?.verdict) summary.solarFeasibility.verdict = escapeHtml(summary.solarFeasibility.verdict);
  if (summary?.buildingHeightNote?.sentence) summary.buildingHeightNote.sentence = escapeHtml(summary.buildingHeightNote.sentence);

  const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  const shotCount = screenshots?.length || 0;

  const { perImage, rest: rawRest } = splitPerImageAnalysis(safeAnalysis, shotCount);
  // Strip markdown header wrapping (## headers, **N. TITLE** bold headers)
  // BEFORE trying to detect section boundaries below -- moveVerdictFirst
  // looks for plain "N. TITLE" lines, and a header Gemini wrote as
  // "**2. FLOOR 5 SPECIFIC ANALYSIS**" wouldn't match that (it starts with
  // ** not a digit), so the whole section would silently get swallowed
  // into whichever section came before it instead of being recognized as
  // its own boundary.
  const cleanedRest = rawRest
    .replace(/^#{1,4}\s*(.+)$/gm, '$1')
    .replace(/^\*\*(\d+\.\s.+?)\*\*\s*$/gm, '$1')
    .replace(/^\*\s+/gm, '- ');

  const rest = moveVerdictFirst(cleanedRest);
  const rawAnalysis = rest;

  const formattedAnalysis = rawAnalysis
    .replace(/^(\d+\. .+)$/gm, '<h3 style="font-size:17px;font-weight:700;color:#1a0a00;margin:26px 0 10px;font-family:\'Space Grotesk\',Arial,sans-serif;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin-bottom:8px;color:#444;line-height:1.75;font-size:14.5px;">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:0 0 16px;padding-left:20px;">${m}</ul>`)
    .replace(/\n\n/g, '</p><p style="margin:0 0 14px;color:#444;line-height:1.85;font-size:14.5px;font-family:Arial,sans-serif;">')
    .replace(/^/, '<p style="margin:0 0 14px;color:#444;line-height:1.85;font-size:14.5px;font-family:Arial,sans-serif;">')
    .replace(/$/, '</p>')
    .replace(/<p[^>]*><\/p>/g, '');

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
      <h3 style="font-size:24px;font-weight:800;color:#1a0a00;margin-bottom:18px;font-family:'Space Grotesk',Arial,sans-serif;letter-spacing:-.01em;padding-bottom:10px;border-bottom:2px solid #f0ede8;display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e07b00;"></span>${g.season}
      </h3>
      <div style="display:flex;flex-direction:column;gap:22px;">
        ${g.shots.map((shot) => `
          <div class="shot-card" style="border:1px solid #e8e4de;border-radius:0;overflow:hidden;box-shadow:0 3px 14px rgba(0,0,0,0.05);">
            <div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#0A0C10;position:relative;">
              <img src="${shot.base64}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${shot.label}"/>
              ${PROPERTY_MARKER_HTML}
              <div style="position:absolute;top:12px;left:12px;background:rgba(224,123,0,0.95);color:#fff;font-size:17px;font-weight:800;padding:5px 14px;border-radius:0;letter-spacing:.02em;box-shadow:0 3px 10px rgba(0,0,0,0.25);">${shot.label.split(' · ')[1] || shot.label}</div>
            </div>
            ${perImage[shot.idx] ? `
            <div style="padding:16px 20px;background:#fff;border-top:1px solid #f0ede8;">
              <div style="font-size:14.5px;color:#3a2e26;line-height:1.8;">${perImage[shot.idx]}</div>
            </div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  const verdictSection = summary?.solarFeasibility ? `
    <div style="display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap;">
      <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:1;min-width:140px;">
        <div style="font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Overall Verdict</div>
        <div style="font-size:22px;font-weight:800;color:#e07b00;font-family:'Space Grotesk',Arial,sans-serif;">${summary.solarFeasibility.verdict}</div>
        <div style="font-size:10px;color:#aaa;margin-top:2px;">${summary.solarFeasibility.avgUsableHours}h/day avg</div>
      </div>
      <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:1;min-width:140px;">
        <div style="font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Best Months</div>
        <div style="font-size:13.5px;font-weight:700;color:#1a0a00;">${summary.solarFeasibility.bestMonths.join(', ')}</div>
      </div>
      <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:1;min-width:140px;">
        <div style="font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Worst Months</div>
        <div style="font-size:13.5px;font-weight:700;color:#1a0a00;">${summary.solarFeasibility.worstMonths.join(', ')}</div>
      </div>
    </div>` : '';

  const monthlyTableSection = summary?.monthlySummary ? `
    <h2 style="font-size:17px;font-weight:800;color:#1a0a00;margin:0 0 14px;font-family:'Space Grotesk',Arial,sans-serif;">Monthly Sunlight Data</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;margin-bottom:12px;">
      <thead>
        <tr style="background:#fff8ee;">
          ${['Month','Sunrise','Sunset','Noon Elevation','Usable Sun','Peak Window',`Floor ${safeFloor} Clearance`]
            .map(h => `<th style="text-align:left;padding:9px 10px;border-bottom:2px solid #e8e4de;color:#5A2800;font-weight:700;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${summary.monthlySummary.map((m, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#fbfaf7'};">
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-weight:700;">${m.month}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.sunrise}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.sunset}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.noonElevation}°</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.usableHours}h</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.peakWindow}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;">${m.floorClearance}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Honesty line: real OSM data-completeness check, not a canned disclaimer -->
    ${summary.buildingHeightNote ? `
    <div style="display:flex;gap:8px;align-items:flex-start;background:#fbfaf7;border:1px dashed #d8d2c8;border-radius:0;padding:11px 15px;margin-bottom:24px;">
      <span style="font-size:13px;line-height:1.5;">📐</span>
      <div style="font-size:11.5px;color:#8a7d6e;line-height:1.6;">${summary.buildingHeightNote.sentence}</div>
    </div>` : ''}
  ` : '';

  const labelPill = reportLabel ? `
    <div style="display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,#e07b00,#ff9f40);color:#fff;font-size:12.5px;font-weight:700;padding:7px 16px;border-radius:0;margin-bottom:14px;box-shadow:0 4px 14px rgba(224,123,0,0.3);">
      📍 ${safeReportLabel}
    </div>` : '';

  // Written narrative, moved up near the top of the report per the requested
  // order: verdict, then this summary, then the monthly table, then images.
  const fullAnalysisSection = `
    <div style="background:#fff8ee;border:1.5px solid #e8e4de;border-radius:0;padding:28px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <h2 style="font-size:17px;font-weight:800;color:#1a0a00;font-family:'Space Grotesk',Arial,sans-serif;">Summary · Floor ${safeFloor}, ${safeFacing}-facing</h2>
      </div>
      ${formattedAnalysis}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Home Comfort Report — ${safeAddress}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f5f2ec;color:#1a0a00}
    @media print{
      .no-print{display:none!important}
      body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      img{max-width:100%;}
    }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100;display:flex;gap:10px;align-items:center;">
    <span id="pdf-status" style="font-size:12px;color:#888;max-width:260px;text-align:right;"></span>
    <button id="back-to-sunscout-btn" style="background:#fff;color:#e07b00;border:1px solid #e07b00;border-radius:0;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;">← Close</button>
    <button id="print-btn" style="background:#f0ede8;color:#555;border:none;border-radius:0;padding:10px 16px;font-size:13px;cursor:pointer;">Print</button>
    <button id="download-pdf-btn" style="background:#e07b00;color:#fff;border:none;border-radius:0;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(224,123,0,0.35);">⬇ Download PDF</button>
    <button onclick="window.close()" style="background:#f0ede8;color:#555;border:none;border-radius:0;padding:10px 18px;font-size:14px;cursor:pointer;">Close</button>
  </div>

  <div id="report-root" style="max-width:900px;margin:0 auto;background:#fff;">

    <!-- Page 1: cover / verdict / summary / table -->
    <div class="pdf-page" style="padding:48px 32px 40px;">
      <div style="border-bottom:2px solid #f0ede8;padding-bottom:24px;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e07b00" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.5" y1="4.5" x2="6.2" y2="6.2"/><line x1="17.8" y1="17.8" x2="19.5" y2="19.5"/><line x1="4.5" y1="19.5" x2="6.2" y2="17.8"/><line x1="17.8" y1="6.2" x2="19.5" y2="4.5"/></svg>
          <span style="font-size:12px;font-weight:700;color:#e07b00;text-transform:uppercase;letter-spacing:.12em;">Home Comfort</span>
          <span style="font-size:11px;color:#bbb;">Home Buyer Solar Report · Visual AI Analysis</span>
        </div>
        ${labelPill}
        <h1 style="font-size:28px;font-weight:800;color:#1a0a00;margin-bottom:6px;font-family:'Space Grotesk',Arial,sans-serif;letter-spacing:-.01em;">${safeAddress}</h1>
        <div style="font-size:11px;color:#aaa;">📍 ${parseFloat(lat).toFixed(5)}°N, ${parseFloat(lon).toFixed(5)}°E · ${date}</div>
      </div>

      <div style="display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:1;min-width:120px;">
          <div style="font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Floor</div>
          <div style="font-size:32px;font-weight:800;color:#e07b00;line-height:1;font-family:'Space Grotesk',Arial,sans-serif;">${safeFloor}</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">≈${(parseInt(floor)||0)*3}m height</div>
        </div>
        <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:1;min-width:120px;">
          <div style="font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Facing</div>
          <div style="font-size:32px;font-weight:800;color:#e07b00;line-height:1;font-family:'Space Grotesk',Arial,sans-serif;">${safeFacing}</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">${facingAssumptionNote ? 'window orientation · assumed, unconfirmed' : 'window orientation'}</div>
        </div>
        <div style="background:#fff8ee;border:1px solid #e8e4de;border-radius:0;padding:14px 18px;flex:3;min-width:200px;display:flex;align-items:center;gap:12px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e07b00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 20l6-6 4 4 8-8"/><path d="M15 6h6v6"/></svg>
          <div>
            <div style="font-size:13px;font-weight:700;color:#1a0a00;">Real 3D map with sun and shadow path</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px;">Precise solar geometry from ${shotCount || 12} real map angles</div>
          </div>
        </div>
      </div>

      ${verdictSection}
      ${fullAnalysisSection}
      ${monthlyTableSection}
    </div>

    <!-- One page per season -->
    ${screenshotPages}

    <!-- Final page: methodology + footer -->
    <div class="pdf-page" style="padding:40px 32px 48px;">
      <div style="border:1px solid #f0ede8;border-radius:0;padding:20px 24px;">
        <div style="font-size:11px;font-weight:700;color:#5A2800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">How this report was built</div>
        <ul style="margin:0;padding-left:18px;font-size:11.5px;color:#8a7d6e;line-height:1.7;">
          <li>Sun position and monthly sunlight hours come from a NOAA solar-geometry algorithm — deterministic, not AI-generated.</li>
          <li>Floor clearance uses a generic urban-obstruction estimate, not a measurement of this property's specific neighboring buildings.</li>
          ${summary?.buildingHeightNote ? `<li>${summary.buildingHeightNote.sentence}</li>` : ''}
          ${safeFacingAssumptionNote ? `<li>${safeFacingAssumptionNote}</li>` : ''}
          <li>The narrative sections use AI to describe the screenshots and summarize findings — it is instructed to treat the numbers above as fact, not to estimate its own.</li>
          <li>The orange marker on each screenshot marks the property location as framed by the capture — it is a visual reference, not a separately measured coordinate.</li>
        </ul>
      </div>

      <div style="border-top:1px solid #f0ede8;padding-top:18px;margin-top:36px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="font-size:10px;color:#ccc;">Home Comfort Report · BlindSpot</div>
        <div style="font-size:10px;color:#ccc;">3D Map: OSMBuildings · AI-assisted narrative · Solar geometry: NOAA algorithm</div>
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

        var filename = 'HomeComfort-Report-${(address || 'property').toString().replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60)}.pdf';
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

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
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