'use client';
// components/TeamSection.js
// Same two real people/roles/LinkedIn links as before -- trimmed per
// request to just name + "Co-founder" + link, no heading copy above the
// cards and no bio paragraph under each. Role tag still uses the same
// colour as the engine each person leads (--av / --ss) so the section
// still visually ties back to Two Scores above it, just without stating
// the engine name in words anymore.

const TEAM = [
  {
    initials: 'AG',
    name: 'Arushri Gangji',
    accent: 'ss',
    linkedin: 'https://www.linkedin.com/in/arushri-gangji-056108381/',
  },
  {
    initials: 'GB',
    name: 'Gurshaan Singh Baweja',
    accent: 'av',
    linkedin: 'https://www.linkedin.com/in/gurshaan-singh-baweja',
  },
];

export default function TeamSection() {
  return (
    <section className="section section-dark reveal" id="team">
      <div className="sd-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <span className="eyebrow">04 - The Team</span>
        </div>

        <div className="team2-grid">
          {TEAM.map((m) => (
            <div key={m.name} className={`team2-card accent-${m.accent}`}>
              <div className="team2-avatar">{m.initials}</div>
              <div className="team2-body">
                <div className="team2-name">{m.name}</div>
                <div className="team2-role">Co-founder</div>
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
