// app/not-found.js
//
// Reached by notFound() -- most often /neighbourhood-report/<pin> for a pin
// BlindSpot has no data for. "404" tells a home buyer nothing; say which
// thing is missing and where to go instead.

export const metadata = { title: 'Not found — BlindSpot' };

export default function NotFound() {
  return (
    <div className="bs-404">
      <h1>We don&apos;t have that one.</h1>
      <p>
        Either the page has moved, or it&apos;s an address outside our coverage. BlindSpot has
        neighbourhood records for Delhi NCR, Bangalore, Chandigarh, Hyderabad and Mumbai.
      </p>
      <p className="bs-404-actions">
        <a href="/">Search another address</a>
      </p>
      <style>{`
        .bs-404 { max-width: 44rem; margin: 0 auto; padding: 96px 24px; text-align: center; color: var(--text, #1c1812); }
        .bs-404 h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 12px; text-wrap: balance; }
        .bs-404 p { margin: 0 auto; max-width: 52ch; font-size: 17px; line-height: 1.6; color: var(--text-mute, #5a5140); }
        .bs-404-actions { margin-top: 26px; }
        .bs-404-actions a { display: inline-block; font-weight: 700; min-height: 50px; padding: 14px 28px; border-radius: 4px; background: var(--ss, #af5f30); color: #fffdf8; text-decoration: none; }
        .bs-404-actions a:hover { background: #95502a; }
      `}</style>
    </div>
  );
}
