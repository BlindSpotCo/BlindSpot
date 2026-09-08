'use client';
// components/TeamSection.js
// Same two real people, same real roles/descriptions/LinkedIn links as
// the old inline team section in app/page.js -- redesigned card shell
// only. Each person's role tag uses the same colour as the engine they
// lead (--av for Neighbourhood Score, --ss for Home Comfort Score) so
// the team section visually ties back to the Two Scores section above it.

const TEAM = [
  {
    initials: 'AG',
    name: 'Arushri Gangji',
    role: 'Co-founder · Home Comfort Score',
    accent: 'ss',
    desc: 'Leads Home Comfort Score, the solar and shadow-analysis engine behind BlindSpot, modelling real sun paths and floor-level shadow hours for a unit, so buyers know exactly how much light a space gets before they sign anything.',
    linkedin: 'https://www.linkedin.com/in/arushri-gangji-056108381/',
  },
  {
    initials: 'GB',
    name: 'Gurshaan Singh Baweja',
    role: 'Co-founder · Neighbourhood Score',
    accent: 'av',
    desc: 'Leads Neighbourhood Score, the neighbourhood-intelligence engine behind BlindSpot, pulling government data on safety, air quality, power and water into one score, so buyers stop relying on a broker\'s word for it.',
    linkedin: 'https://www.linkedin.com/in/gurshaan-singh-baweja',
  },
];

export default function TeamSection() {
  return (
    <section className="section reveal" id="team">
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">04 - The Team</span>
            <h2>Two people who got tired of guessing.</h2>
          </div>
          <p>The two founders behind BlindSpot&apos;s product line, each leading one half of the platform.</p>
        </div>

        <div className="team2-grid">
          {TEAM.map((m) => (
            <div key={m.name} className={`team2-card accent-${m.accent}`}>
              <div className="team2-avatar">{m.initials}</div>
              <div className="team2-body">
                <div className="team2-name">{m.name}</div>
                <div className="team2-role">{m.role}</div>
                <p className="team2-desc">{m.desc}</p>
                <a href={m.linkedin} target="_blank" rel="noopener" className="team2-link">
                  Connect on LinkedIn
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
