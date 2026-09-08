'use client';
// components/sunscout/LiveScoreCard.js
// Ported from SunScout's components/LiveScoreCard.tsx (TS types stripped,
// logic unchanged).

import { getActionItems } from '@/lib/property-score/actionItems';
import { scoreColor } from '@/components/property-score/AVDetailedReadout';

const ORG = '#E07B00';
const INK = '#1A0A00';
const SUB = '#8A8A8A';
const LINE = 'rgba(26,10,0,0.12)';
const MONO = "'Geist Mono', monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";
const DISPLAY = "'Space Grotesk', sans-serif";

const GRADE_COLOR = {
  Excellent: '#16a34a',
  Good: '#65a30d',
  Fair: ORG,
  Poor: '#dc2626',
};


export default function LiveScoreCard({ result }) {
  const actionItems = getActionItems({ unitSubScores: result.subScores });

  return (
    <div style={{ fontFamily: SANS }}>
      <div className="ls-score-box" style={{
        border: `1px solid ${LINE}`,
        borderLeft: `4px solid ${GRADE_COLOR[result.grade]}`,
        padding: '22px 20px',
        marginBottom: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: SUB, letterSpacing: '.14em', marginBottom: 6 }}>
            HOME COMFORT SCORE - COMPOSITE
          </div>
          <div className="ls-score-number" style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, color: INK, lineHeight: 1 }}>
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
          return (
            <div key={sub.key} className="ls-subscore-item" style={{
              border: `1px solid ${LINE}`,
              borderTop: i === 0 ? `1px solid ${LINE}` : 'none',
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: INK, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                  {sub.label}
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: scoreColor(sub.score) }}>
                  {sub.score}
                </div>
              </div>

              <div style={{ background: '#EFEBE3', height: 4, marginBottom: 10 }}>
                <div style={{ width: `${sub.score}%`, height: '100%', background: scoreColor(sub.score) }} />
              </div>

              <div style={{ fontSize: 12.5, color: '#4A4A4A', lineHeight: 1.55 }}>
                {sub.summary}
              </div>
            </div>
          );
        })}
      </div>

      {actionItems.length > 0 && (
        <div style={{ border: `1px solid ${LINE}`, borderTop: 'none', padding: '16px 18px', background: '#FBF8F2' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: ORG, letterSpacing: '.12em', marginBottom: 10 }}>
            WHAT TO CHECK ON YOUR VISIT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actionItems.map(item => (
              <div key={item.key} style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>
                <strong>{item.label} ({item.score}):</strong> {item.action}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
