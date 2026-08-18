'use client';
// components/property-score/AVDetailedReadout.js
//
// The full per-category AsliVastu detail breakdown, ported field-for-field
// (including AV's own tooltip copy) from aslivastu/web/pages/report/[pin].js
// — every stat AV's master_by_pin.json carries, laid out as one box per
// category (Crime, Air Quality, Power, Connectivity & Infrastructure,
// Water, Roads, Drainage & Sewerage), plus Schools and Methodology. Only
// the colours changed: BlindSpot's paper/ink/var(--slate) tokens instead of
// AV's own dark theme + wine accent.
//
// Shared by AVAreaCard (inline on the property-score page) and
// NeighbourhoodReport (the standalone full-page report) so both places show
// identically detailed data. source()/scoreColor()/waterloggingLabel() are
// also exported for NeighbourhoodReport's dimension-readout + highlights
// sections, so the two files never define the same mapping twice.
//
// Needs a `record` that has BOTH the nqi_scores.json fields AND the
// master_by_pin.json fields merged in (see /api/av-localities and
// lib/neighbourhood-report/getReportData.js — both merge master_by_pin.json
// the same way AV's own /api/report.js does: `{ ...score, ...master }`).

import { FACTOR_LABELS } from '@/lib/property-score/ui';
import { sourceFor } from '@/lib/aslivastu/cityMeta';

// `dark` flips a box to the near-black ink card used for the Sheet
// identity / Composite Index / Dimension readout boxes -- requested
// because the default `var(--paper)` fill read as barely-there-whiter
// than the page's own `var(--bg)`, not as a deliberate surface. Border
// and corner marks switch to white-tinted so they stay visible against
// `var(--ink)` instead of disappearing (the default olive border/marks
// are tuned for contrast on paper, not on ink).
export function BPF({ children, style, className = '', dark = false }) {
  const surface = dark
    ? { background: 'var(--ink)', border: '1px solid rgba(255,253,248,0.16)' }
    : { background: 'var(--paper)', border: '1px solid color-mix(in srgb, var(--slate) 55%, transparent)' };
  return (
    <div className={`bpf-av ${className}`} style={{ position: 'relative', ...surface, ...style }}>
      <span style={bpfMark('tl', dark)}>+</span><span style={bpfMark('tr', dark)}>+</span>
      <span style={bpfMark('bl', dark)}>+</span><span style={bpfMark('br', dark)}>+</span>
      {children}
    </div>
  );
}
function bpfMark(pos, dark = false) {
  const base = { position: 'absolute', color: dark ? 'rgba(255,253,248,0.55)' : 'var(--slate)', fontSize: 13, lineHeight: 1, opacity: .5 };
  const offsets = { tl: { top: -7, left: -5 }, tr: { top: -7, right: -5 }, bl: { bottom: -8, left: -5 }, br: { bottom: -8, right: -5 } };
  return { ...base, ...offsets[pos] };
}

export function Info({ text }) {
  if (!text) return null;
  return (
    <span className="nr-info" style={{ position: 'relative', display: 'inline-flex', marginLeft: 5 }}>
      <span style={{ fontSize: 9, width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--slate)', color: 'var(--slate)', borderRadius: '50%', cursor: 'help', lineHeight: 1, opacity: .8, flexShrink: 0 }}>?</span>
      <span className="nr-tip" style={{ position: 'absolute', bottom: 'calc(100% + 9px)', left: '50%', transform: 'translateX(-50%)', width: 230, background: 'var(--paper)', border: '1.5px solid var(--slate)', padding: '10px 12px', fontSize: 12.5, fontWeight: 400, color: 'var(--text)', lineHeight: 1.5, zIndex: 300, boxShadow: '0 10px 34px rgba(28,24,18,0.18)', display: 'none' }}>{text}</span>
      <style jsx>{`.nr-info:hover .nr-tip { display: block !important; }`}</style>
    </span>
  );
}

// One box per category — title + a grid of label/value pairs, each with its
// own hover tooltip. Matches AV's own StatCard exactly (label, value, tip).
function CategoryCard({ title, tip, stats }) {
  return (
    <BPF style={{ padding: '18px 20px' }}>
      <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', margin: '0 0 14px', display: 'flex', alignItems: 'center' }}>{title}<Info text={tip} /></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px 20px' }}>
        {stats.filter(Boolean).map(([label, val, itemTip]) => (
          <div key={label}>
            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{label}<Info text={itemTip} /></div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15.5, fontWeight: 700, marginTop: 3, color: 'var(--text)' }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>
    </BPF>
  );
}

// AQI category → plain-English meaning, verbatim from AV.
export const AQI_PLAIN = {
  'Good': 'Air is clean — safe for everyone.',
  'Satisfactory': 'Air is acceptable — fine for most; sensitive individuals may feel minor irritation.',
  'Moderate': 'Okay for healthy people; asthma/heart/lung patients should limit long outdoor exertion.',
  'Poor': 'Unhealthy — prolonged outdoor activity can cause breathing discomfort.',
  'Very Poor': 'Unhealthy for everyone — avoid outdoor exertion.',
  'Severe': 'Hazardous — a serious health risk; stay indoors.',
};

// Attribution now lives in lib/aslivastu/cityMeta.js, keyed by city.
// This used to be `city === 'Bangalore' ? bengaluru : delhi` -- which
// meant any third city silently rendered "Delhi Police Annual Report",
// "Delhi Jal Board" and "MCD / PWD road surveys" purely because it wasn't
// Bangalore. Nothing threw; the report just cited the wrong government
// department for every dimension. Kept as a thin wrapper so existing
// `source(k, city)` call sites don't all have to change. A bare
// `export {...} from` re-export (instead of a real local function) inside
// a 'use client' file is a fragile pattern across Next's RSC client-
// boundary compiler -- can work in dev and silently break in a production
// build. A normal function avoids that.
export function source(dimension, city) {
  return sourceFor(dimension, city);
}
// Autumn palette, worst → best: brick red, pumpkin orange, forest green,
// mid green, light green. Replaces the earlier 4-tier scale on request —
// same idea (weak scores read as hot colours, strong scores read as green,
// hatch pattern still kicks in below 50), just a warmer 5-step ramp instead
// of the flatter green/lime/amber/red set.
// Bright autumn ramp, stepped every ~10 points, red (weak) → light green
// (strong). Brighter/more saturated than the previous pass, which read as
// muddy rather than "good" at the green end.
// User-supplied autumn photo palette: first red, first orange from that
// swatch set, then olive/deep-olive for the top bands — deepest olive
// reserved for the best scores.
//
// Collapsed from 5 tiers to 4 (dropped the yellow-green middle tier and
// the old 90+ break) after checking the real nqi_scores.json distribution:
// 268 records, min 39, max 87, zero records >=90, exactly one below 40.
// The old boundaries wasted two tiers (red, deep-olive-at-90+) on ranges
// that are essentially empty in real data, while the actual 60-89 cluster
// (the vast majority of areas) got split across yellow-green/olive in a
// way that read as muddy rather than useful. Olive now starts at 60
// (where yellow-green used to start) and deep olive now starts at 75
// (where plain olive used to start) and runs through 100 -- so the
// visually "best" color is achievable by real areas instead of sitting on
// an unreachable 90+ shelf.
export function scoreColor(v) {
  if (v == null) return 'var(--text-dim)';
  if (v >= 75) return '#5C6B00'; // deep olive green — best (was 90+)
  if (v >= 60) return '#B3B232'; // olive (was 75+)
  if (v >= 40) return '#F4AE42'; // orange
  return '#8F0000';              // red — weakest
}
export function waterloggingLabel(v) {
  if (v == null) return '—';
  return v >= 4 ? 'Low risk' : v >= 3 ? 'Moderate risk' : 'High risk';
}
// scoreColor()'s ramp spans deep-dark olive (best) through bright
// yellow-green/orange (mid) to dark red (weakest) -- a single hardcoded
// text colour doesn't stay readable across all of that. Perceptual-luma
// threshold picks ink on the light/bright mid-tiers (olive, yellow-green,
// orange) and white on the two genuinely dark ends (deep olive, red).
export function readableTextColor(hex) {
  if (!hex || hex[0] !== '#') return '#fff';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 140 ? 'var(--ink)' : '#fff';
}
// Moved here from NeighbourhoodReport.js (was a local, unexported function)
// so AVAreaCard's inline card on the property-score page can show the same
// verdict label/colour block the full report uses, instead of drifting out
// of sync with a duplicate copy.
export function verdictFor(nqi) {
  if (nqi >= 80) return { label: 'Strong Buy', why: 'Scores well across the board — few weak spots to worry about.' };
  if (nqi >= 60) return { label: 'Consider', why: 'Decent overall, with some weak dimensions worth inspecting on site before deciding.' };
  if (nqi >= 45) return { label: 'Below Average', why: 'Below the tracked-area average — compare nearby areas before committing.' };
  return { label: 'Avoid', why: 'Multiple dimensions score poorly — strongly recommend comparing alternatives.' };
}
// Moved here from NeighbourhoodReport.js (was a local, unexported function)
// for the same reason as verdictFor -- AVAreaCard's dimension rows need the
// exact same per-dimension explain sentence the full report uses.
export function explain(k, r) {
  const city = r.city || 'Delhi NCR';
  switch (k) {
    case 'crime': return r.crime_percentile != null
      ? `${r.total_cognizable_crimes} crimes reported — safer than ${r.crime_percentile}% of tracked ${city} areas (${(r.crime_tier || '').toLowerCase()} tier).`
      : 'Cognizable crimes reported for the police catchment.';
    case 'infrastructure': return `${r.metro_stations_nearby || 0} operational metro station(s) · ${(r.highway_proximity || '—').toLowerCase()} highway access · ${(r.zone_type || 'mixed').toLowerCase()} zone.`;
    // Names the station a live reading came from -- a "nearest station"
    // can be several km away, so attributing it matters. Falls back to the
    // plain band sentence for stored readings.
    case 'air': return r.aqi_category
      ? `AQI ~${Math.round(r.aqi_avg)}, ${r.aqi_category} — ${AQI_PLAIN[r.aqi_category] || 'CPCB band.'}${r.aqi_is_live && r.aqi_station ? ` Nearest station: ${r.aqi_station}.` : ''}`
      : 'Awaiting an air-quality reading for this area.';
    case 'power': return `${r.reliability || '—'} reliability · ~${r.avg_outage_hours ?? '—'} outage hrs/month via ${r.discom || 'the local DISCOM'}.`;
    case 'schools': return r.schools_count ? `${r.schools_count} CBSE school(s) mapped to this pin.` : 'No CBSE-affiliated school in this exact pin.';
    case 'water': return `${r.supply_hours ?? '—'} hrs daily supply · ${(r.tds_level || '—')} TDS · ${(r.water_coverage ?? r.coverage_pct) ?? '—'}% piped coverage.`;
    case 'roads': return `${r.road_condition || '—'} condition · ~${r.pothole_density ?? '—'} potholes/km · last resurfaced ${r.last_resurfaced || '—'}.`;
    case 'sewerage': { const wl = r.waterlogging_risk; const lvl = wl == null ? '—' : wl >= 4 ? 'low' : wl >= 3 ? 'moderate' : 'high';
      return `${lvl} monsoon waterlogging risk${r.flooding_incidents_annual ? ` — ~${r.flooding_incidents_annual} flooding incidents a year` : ''}.`; }
    default: return '';
  }
}

// Plain-JS date formatting, deliberately NOT toLocaleDateString(): that
// reads the *runtime's* default locale/ICU data, which can differ between
// the Node server (SSR) and the browser (CSR) even with an explicit locale
// argument if the server's Node build only ships small-icu — exactly what
// caused the earlier hydration mismatch (28/7/2026 vs 28/07/2026). These
// always produce the same string everywhere, so use them instead of
// toLocaleDateString/toLocaleString anywhere in the report.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
export function formatDateLong(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Indian-numbering (lakh/crore) grouping, written out by hand instead of
// toLocaleString('en-IN') for the same reason as the date formatters above.
export function inr(n) {
  if (n == null) return '—';
  const num = Math.round(n);
  const s = Math.abs(num).toString();
  let out;
  if (s.length <= 3) {
    out = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    out = `${rest},${last3}`;
  }
  return '₹' + (num < 0 ? '-' : '') + out;
}

export default function AVDetailedReadout({ record }) {
  const s = record.scores || {};

  return (
    <div className="av-detail-readout">
      <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', marginBottom: 14 }}>
        Detailed Readings
      </p>
      <div style={{ display: 'grid', gap: 20, marginBottom: 28 }}>

        <CategoryCard title="Safety" tip={source('crime', record.city)} stats={[
          ['Total crimes', record.total_cognizable_crimes, "Total cognizable crimes reported annually for this pin's police-station catchment, which can span a wider area than any one colony."],
          ['Safety score', s.crime != null ? `${s.crime}/100` : '—', 'Inverse-normalized against total crimes: 250 or fewer scores 100, 650 or more scores 0, linear in between.'],
          ['Safer than', record.crime_percentile != null ? `${record.crime_percentile}%` : '—', "Percentile rank of this pin's crime count against other tracked areas in the same city (cities ranked separately)."],
          ['Crime tier', record.crime_tier, 'Very Low / Low / Moderate / High / Very High, based on the percentile rank.'],
          ['Source year', '2022–23', 'Reporting year of the source crime data.'],
        ]} />

        <CategoryCard title="Air Quality" tip={source('air', record.city)} stats={[
          ['AQI', record.aqi_avg != null ? Math.round(record.aqi_avg) : '—', 'Air Quality Index, CPCB/KSPCB daily average.'],
          ['Category', record.aqi_category, record.aqi_category ? (AQI_PLAIN[record.aqi_category] || '') : 'Good / Satisfactory / Moderate / Poor / Very Poor / Severe, per CPCB bands.'],
          ['Score', s.air != null ? `${s.air}/100` : '—', 'Normalized against the CPCB AQI band for this reading.'],
        ]} />

        <CategoryCard title="Power Supply" tip={source('power', record.city)} stats={[
          ['Discom', record.discom, 'The electricity distribution company serving this area.'],
          ['Reliability', record.reliability, 'Qualitative reliability rating derived from outage frequency and consumer complaint data.'],
          ['Avg cut hrs', record.avg_outage_hours != null ? `${record.avg_outage_hours} /mo` : '—', 'Average monthly power-outage hours from DISCOM reports — not live-metered.'],
          ['Score', s.power != null ? `${s.power}/100` : '—', 'Weighted blend of outage frequency (60%) and average outage duration (40%).'],
        ]} />

        <CategoryCard title="Connectivity & Infrastructure" tip={source('infrastructure', record.city)} stats={[
          ['Zone', record.zone_type, 'Land-use zone type — residential, mixed, commercial or industrial.'],
          ['Metro nearby', record.metro_stations_nearby, 'Number of operational metro stations near this pin.'],
          ['Metro planned', record.metro_planned_stations, 'Approved but not-yet-open metro stations nearby.'],
          ['Highway', record.highway_proximity, 'Proximity to major highways / arterial roads.'],
          ['Smart city', record.smart_city_project ? 'Yes' : 'No', 'Whether the area falls under the Smart Cities Mission.'],
          ['Infra score', (record.infra_score_raw ?? s.infrastructure) != null ? `${record.infra_score_raw ?? s.infrastructure}/100` : '—', 'Composite of metro access, highway proximity, zone type and smart-city status.'],
        ]} />

        <CategoryCard title="Water Supply" tip={source('water', record.city)} stats={[
          ['Daily supply', record.supply_hours != null ? `${record.supply_hours} hrs` : '—', 'Average hours of piped water supply available per day.'],
          ['Quality', record.tds_level ? `${record.tds_level} TDS` : '—', 'TDS = Total Dissolved Solids. Low = ideal drinking water; High = hard water needing filtration.'],
          ['Coverage', (record.water_coverage ?? record.coverage_pct) != null ? `${record.water_coverage ?? record.coverage_pct}%` : '—', '% of households with a piped municipal water connection. Below 80% means heavy tanker/borewell reliance.'],
          ['Complaints', record.complaints_per_1000 != null ? `${record.complaints_per_1000}/1k` : '—', 'Water-supply complaints per 1,000 households annually. Lower is better.'],
          ['Quality score', (record.water_quality ?? record.quality_score) != null ? `${record.water_quality ?? record.quality_score}/5` : '—', 'Composite 1–5 water-quality rating from TDS, complaints and supply hours.'],
        ]} />

        <CategoryCard title="Roads" tip={source('roads', record.city)} stats={[
          ['Condition', record.road_condition, 'Overall road-surface condition rating (Excellent → Very Poor).'],
          ['Potholes/km', record.pothole_density, 'Estimated potholes per km. Below 2 = good; above 5 = poor; above 10 = dangerous.'],
          ['Connectivity', record.connectivity, 'How well the area connects to arterial roads and highways.'],
          ['Authority', record.authority, 'Government body responsible for road maintenance here.'],
          ['Last resurfaced', record.last_resurfaced, 'Year the main roads were last resurfaced (every 5–7 years is typical).'],
          ['Quality score', (record.road_quality ?? record.quality_score) != null ? `${record.road_quality ?? record.quality_score}/5` : '—', 'Composite 1–5 road-quality rating from condition and pothole density.'],
        ]} />

        <CategoryCard title="Drainage & Sewerage" tip={source('sewerage', record.city)} stats={[
          ['Sewer coverage', (record.sewerage_coverage ?? record.coverage_pct) != null ? `${record.sewerage_coverage ?? record.coverage_pct}%` : '—', '% of households connected to the underground sewerage network.'],
          ['Treatment', record.treatment, 'Whether sewage reaches a treatment plant — Adequate / Partial / Inadequate.'],
          ['Waterlogging', waterloggingLabel(record.waterlogging_risk), 'Monsoon waterlogging risk from drainage capacity, elevation and flooding history.'],
          ['Open drains', record.open_drains == null ? '—' : (record.open_drains ? 'Yes' : 'No'), 'Whether the area has uncovered drains — a health and flooding hazard.'],
          ['Flood incidents', record.flooding_incidents_annual != null ? `${record.flooding_incidents_annual}/yr` : '—', 'Significant waterlogging/flooding incidents recorded per year.'],
        ]} />

      </div>

      {/* ── Schools ── */}
      {record.schools_list?.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', marginBottom: 14 }}>
            Schools · {record.schools_count} mapped
          </p>
          <BPF style={{ padding: 0, overflow: 'hidden' }}>
            {record.schools_list.map((sc, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '11px 18px', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                <span style={{ color: 'var(--text)' }}>{sc.name}</span>
                <span style={{ color: 'var(--slate)', fontSize: 12, flexShrink: 0, fontWeight: 700, letterSpacing: '.03em' }}>{sc.board || 'CBSE'}</span>
              </div>
            ))}
          </BPF>
        </div>
      )}

      {/* ── Methodology ── */}
      <div>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: 'var(--slate)', marginBottom: 14 }}>
          Methodology · Data Sources
        </p>
        <BPF style={{ padding: 0, overflow: 'hidden' }}>
          {Object.entries(record.weights_applied || {}).map(([k, w], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, padding: '10px 18px', borderTop: i ? '1px dashed var(--line-soft)' : 'none', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: 'var(--text)', fontWeight: 600, minWidth: 150 }}>{FACTOR_LABELS[k] || k}</span>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, color: 'var(--slate)', width: 44 }}>{Math.round(w * 100)}%</span>
              <span style={{ color: 'var(--text-dim)', flex: 1, minWidth: 200 }}>{source(k, record.city)}</span>
              {/* The air row used to be hardcoded to "LIVE" regardless of
                  where its number actually came from -- while aqi_avg was
                  a static field in master_by_pin.json that nothing ever
                  refreshed, so the badge was claiming something the
                  product didn't do. Air is genuinely live now (see
                  /api/aqi), but only when a reading actually resolves:
                  without a configured token, or if the upstream is down,
                  the stored snapshot is used and this correctly reads
                  STORED rather than asserting freshness it doesn't have. */}
              {(() => {
                const live = k === 'air' && record.aqi_is_live;
                const label = k !== 'air' ? 'EST' : live ? 'LIVE' : 'STORED';
                const accent = live ? '#3D6B2E' : 'var(--text-dim)';
                return (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: accent, border: `1px solid ${live ? '#3D6B2E' : 'var(--line)'}`, borderRadius: 2, padding: '2px 6px' }}>{label}</span>
                );
              })()}
            </div>
          ))}
        </BPF>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          Scored {formatDate(record.scored_at) || '—'}. Area-level — the same for every unit in this pincode.
        </div>
      </div>
    </div>
  );
}
