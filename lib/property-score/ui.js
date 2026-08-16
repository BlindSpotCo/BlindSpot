// lib/property-score/ui.js
// Small shared pieces used across the Property Score tab's components
// (LocalityPicker, AddressPicker, UnitVerdict) so they don't each redefine
// the same badge/bar/formatting helpers.

// Labels matched to AsliVastu's own live report (aslivastu.com/report-v2/…):
// their Dimension Readout calls these "Safety", "Water Supply" and
// "Drainage & Sewerage", not the shorter "Crime"/"Water"/"Sewerage" this
// used to say -- was also an internal inconsistency on BlindSpot's own
// report page already, since AVDetailedReadout's category-card titles
// hardcoded "Water Supply"/"Drainage & Sewerage" independently of this
// constant while everything else read the old short labels off of it.
export const FACTOR_LABELS = {
  crime: 'Safety', infrastructure: 'Infrastructure', air: 'Air Quality',
  power: 'Power', schools: 'Schools', water: 'Water Supply', roads: 'Roads', sewerage: 'Drainage & Sewerage',
};

export const FACING_OPTS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

export function GradeBadge({ grade, color }) {
  return (
    <span style={{
      display: 'inline-block', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
      fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase',
      border: `1px solid ${color}`, color, padding: '4px 10px', borderRadius: 3,
    }}>
      {grade}
    </span>
  );
}

export function FactorBar({ label, score }) {
  const color = score >= 75 ? '#4ADE80' : score >= 50 ? 'var(--slate)' : '#f87171';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 4 }}>
        <span>{label}</span><span className="mono" style={{ color: 'var(--text)' }}>{score}</span>
      </div>
      <div style={{ background: 'var(--line-soft)', height: 4, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

export function nearestLocalities(all, current, n = 3) {
  if (!current?.lat || !current?.lon) return [];
  return all
    .filter(r => r.pin_code !== current.pin_code && r.lat && r.lon)
    .map(r => {
      const dLat = r.lat - current.lat, dLon = r.lon - current.lon;
      return { ...r, _dist: Math.sqrt(dLat * dLat + dLon * dLon) };
    })
    .sort((a, b) => a._dist - b._dist)
    .slice(0, n);
}

export function inr(n) {
  if (n == null) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
