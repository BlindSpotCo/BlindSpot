// Shown the instant /profile is opened, while the account and saved reports
// load -- instead of the previous page just sitting there.
export default function Loading() {
  return (
    <main className="pf-skel" aria-busy="true" aria-label="Loading your profile">
      <div className="pf-skel-wrap">
        <div className="pf-skel-top">
          <span className="pf-skel-c" />
          <span className="pf-skel-lines"><span style={{ width: '55%', height: 34 }} /><span style={{ width: '40%' }} /></span>
        </div>
        <span className="pf-skel-l" style={{ width: '70%', marginTop: 30 }} />
        <span className="pf-skel-l" style={{ width: '100%', height: 64, marginTop: 18 }} />
        {[0, 1, 2, 3].map((i) => <span key={i} className="pf-skel-l" style={{ width: '100%', height: 52, marginTop: 14 }} />)}
      </div>
      <style>{`
        .pf-skel{ min-height:100vh; background:var(--bg,#FAF6EE); padding:36px 0 }
        .pf-skel-wrap{ max-width:880px; margin:0 auto; padding:0 clamp(16px,4vw,28px); display:flex; flex-direction:column }
        .pf-skel-top{ display:flex; gap:18px; align-items:center }
        .pf-skel-c{ width:64px; height:64px; border-radius:50%; flex:none }
        .pf-skel-lines{ flex:1; display:flex; flex-direction:column; gap:10px }
        .pf-skel-lines > span, .pf-skel-l{ display:block; height:14px; border-radius:6px }
        .pf-skel-c, .pf-skel-lines > span, .pf-skel-l{
          background:linear-gradient(90deg, rgba(28,24,18,.06), rgba(28,24,18,.11), rgba(28,24,18,.06));
          background-size:200% 100%; animation:pfSk 1.2s ease-in-out infinite;
        }
        @keyframes pfSk{ from{ background-position:200% 0 } to{ background-position:-200% 0 } }
        @media (prefers-reduced-motion:reduce){ .pf-skel-c, .pf-skel-lines > span, .pf-skel-l{ animation:none } }
      `}</style>
    </main>
  );
}
