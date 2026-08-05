'use client';
// components/sunscout/LiveScoreCard.js
// Ported from SunScout's components/LiveScoreCard.tsx (TS types stripped,
// logic unchanged).

const ORG = '#E07B00';
const INK = '#1A0A00';
const SUB = '#8A8A8A';
const LINE = 'rgba(26,10,0,0.12)';
const MONO = "'IBM Plex Mono', monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";
const DISPLAY = "'Space Grotesk', sans-serif";

const GRADE_COLOR = {
  Excellent: '#16a34a',
  Good: '#65a30d',
  Fair: ORG,
  Poor: '#dc2626',
};

function scoreColor(score) {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return ORG;
  if (score >= 25) return '#ea580c';
  return '#dc2626';
}

const WEIGHT_KEY_MAP = {
  sun: 'sun', shadeHeat: 'shadeHeat', view: 'view', privacy: 'privacy', wind: 'wind',
};

export default function LiveScoreCard({ result }) {
  const totalWeight = Object.values(result.weights).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{
        border: `1px solid ${LINE}`,
        borderLeft: `4px solid ${GRADE_COLOR[result.grade]}`,
        padding: '22px 20px',
        marginBottom: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: SUB, letterSpacing: '.14em', marginBottom: 6 }}>
            LIVESCORE — COMPOSITE
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, color: INK, lineHeight: 1 }}>
            {result.liveScore}<span style={{ fontSize: 18, color: SUB, fontWeight: 700 }}>/100</span>
          </div>
        </div>
        <div style={{
          border: `1px solid ${GRADE_COLOR[result.grade]}`,
          color: GRADE_COLOR[result.grade],
          fontFamily: MONO, fontSize: 11, fontWeight: 500,
          padding: '6px 14px',
          textTransform: 'uppercase', letterSpacing: '.1em',
        }}>
          {result.grade}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {result.subScores.map((sub, i) => {
          const weightKey = WEIGHT_KEY_MAP[sub.key];
          const weightPct = weightKey ? Math.round((result.weights[weightKey] / totalWeight) * 100) : 0;
          return (
            <div key={sub.key} style={{
              border: `1px solid ${LINE}`,
              borderTop: i === 0 ? `1px solid ${LINE}` : 'none',
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: INK, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                  {sub.label}
                  <span style={{ fontFamily: MONO, fontWeight: 400, fontSize: 11, color: SUB, marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>
                    weight {weightPct}%
                  </span>
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: scoreColor(sub.score) }}>
                  {sub.score}
                </div>
              </div>

              <div style={{ background: '#EFEBE3', height: 4, marginBottom: 10 }}>
                <div style={{ width: `${sub.score}%`, height: '100%', background: scoreColor(sub.score) }} />
              </div>

              <div style={{ fontSize: 12.5, color: '#4A4A4A', lineHeight: 1.55, marginBottom: 8 }}>
                {sub.summary}
              </div>

              <div style={{
                fontFamily: MONO, fontSize: 10.5, color: SUB, lineHeight: 1.6,
                borderTop: `1px dashed ${LINE}`, paddingTop: 7,
              }}>
                <span style={{ color: ORG, fontWeight: 500 }}>BASIS — </span>{sub.basis}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ border: `1px solid ${LINE}`, borderTop: 'none', padding: '16px 18px', background: '#FBF8F2' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: ORG, letterSpacing: '.12em', marginBottom: 10 }}>
          HOW THE COMPOSITE IS CALCULATED
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: INK, lineHeight: 2 }}>
          {result.subScores.map(sub => {
            const weightKey = WEIGHT_KEY_MAP[sub.key];
            const weightPct = weightKey ? Math.round((result.weights[weightKey] / totalWeight) * 100) : 0;
            return (
              <div key={sub.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{sub.label} ({sub.score} × {weightPct}%)</span>
                <span>{(sub.score * (weightPct / 100)).toFixed(1)}</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 6, fontWeight: 700 }}>
            <span>SUM ÷ TOTAL WEIGHT</span>
            <span>{result.liveScore}</span>
          </div>
        </div>
      </div>

      {result.dataNotes.length > 0 && (
        <div style={{ marginTop: 14, border: `1px solid ${LINE}`, padding: '12px 16px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: ORG, letterSpacing: '.12em', marginBottom: 6 }}>
            DATA NOTES
          </div>
          {result.dataNotes.map((note, i) => (
            <div key={i} style={{ fontSize: 11.5, color: SUB, lineHeight: 1.6 }}>— {note}</div>
          ))}
        </div>
      )}
    </div>
  );
}
