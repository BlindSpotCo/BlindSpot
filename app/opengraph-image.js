import { ImageResponse } from 'next/og';

export const alt = "BlindSpot — See What Listings Don't Tell You";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#FAF6EE',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#3D4116',
              display: 'flex',
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1812', letterSpacing: '-0.01em' }}>
            BlindSpot
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#1C1812',
              lineHeight: 1.08,
              letterSpacing: '-0.01em',
              maxWidth: 980,
            }}
          >
            See what listings don't tell you.
          </div>
          <div style={{ fontSize: 26, color: '#5A5140', maxWidth: 880, lineHeight: 1.4 }}>
            Neighbourhood Score and Home Comfort Score — data-backed property
            intelligence, before you sign anything.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {[
            ['NEIGHBOURHOOD SCORE', '#3D4116'],
            ['HOME COMFORT SCORE', '#AF5F30'],
          ].map(([label, color]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color,
                border: `1px solid ${color}`,
                borderRadius: 20,
                padding: '8px 18px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
