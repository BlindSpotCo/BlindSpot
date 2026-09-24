'use client';
// components/profile/ProfileView.js
//
// The profile page itself. Server-fetched: the account and every saved
// report (light columns only). Read from this browser: the homes looked
// at (lib/profile/history.js) and the site-visit checklists, which have
// always lived per device.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trash2, X, ArrowUpRight } from 'lucide-react';
import HomeMark from './HomeMark';
import { createClient } from '@/lib/supabase/client';
import { readHistory, removeVisit, clearHistory, readChecklists } from '@/lib/profile/history';
import './profile.css';

const TABS = [
  { key: 'saved', label: 'Saved reports' },
  { key: 'recent', label: 'Recently viewed' },
  { key: 'notes', label: 'Site-visit notes' },
  { key: 'account', label: 'Account' },
];

// What each saved row is, in words a buyer uses.
function typeOf(r) {
  if (r.source === 'ai-report') {
    return r.kind === 'sun-shadow'
      ? { key: 'sun', label: 'Sun & shadow' }
      : { key: 'full', label: 'Full report' };
  }
  if (r.source === 'neighbourhood' || r.source === 'aslivastu') return { key: 'area', label: 'Area report' };
  if (r.source === 'furnishing') return { key: 'furnish', label: 'Furnishing plan' };
  return { key: 'full', label: 'Home comfort' };
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full reports' },
  { key: 'sun', label: 'Sun & shadow' },
  { key: 'area', label: 'Area' },
  { key: 'furnish', label: 'Furnishing' },
];

const CHECK_LABELS = {
  crime: 'Safety', schools: 'Schools', air: 'Air quality', water: 'Water supply', power: 'Power',
  roads: 'Roads', infrastructure: 'Infrastructure', sewerage: 'Drainage', sun: 'Sunlight',
  shadeHeat: 'Summer heat', view: 'View', privacy: 'Privacy', wind: 'Ventilation', dampness: 'Dampness', noise: 'Noise',
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const scoreOf = (r) => num(r.combined) ?? num(r.unit) ?? num(r.nqi);

function ago(ts) {
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
const shortAddr = (a) => String(a || '').replace(/,\s*India\s*$/i, '').split(',').map((x) => x.trim()).filter(Boolean);

function reportHref(v) {
  const q = new URLSearchParams({ lat: String(v.lat), lon: String(v.lon) });
  if (v.pinCode) q.set('pin_code', v.pinCode);
  if (v.address) q.set('address', v.address);
  if (v.floor) q.set('floor', String(v.floor));
  if (v.facing) q.set('facing', v.facing);
  if (v.pin) q.set('pin', '1');
  return `/report?${q.toString()}`;
}

// Some older saves were titled with bare coordinates ("17.3347").
const COORDS = /^\s*-?\d{1,3}\.\d+(\s*,\s*-?\d{1,3}\.\d+)?\s*$/;
function titleFor(r) {
  const parts = shortAddr(r.address || r.title);
  const first = parts[0] || r.title || '';
  if (!first || COORDS.test(first)) return { main: 'A pinned spot', coords: true };
  // Typed all in lower case ("prestige park grove") -- show it titled.
  const main = first === first.toLowerCase() ? first.replace(/\b\w/g, (c) => c.toUpperCase()) : first;
  return { main, coords: false };
}
const dayMonth = (ts) => {
  const d = new Date(ts);
  return Number.isFinite(d.getTime())
    ? { d: d.toLocaleDateString('en-IN', { day: '2-digit' }), m: d.toLocaleDateString('en-IN', { month: 'short' }) }
    : { d: '', m: '' };
};

export default function ProfileView({ profile, initialReports, folders, fetchFailed }) {
  const router = useRouter();
  const [tab, setTab] = useState('saved');
  const [reports, setReports] = useState(initialReports || []);
  const [history, setHistory] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [confirmDel, setConfirmDel] = useState(null);
  const [delError, setDelError] = useState('');
  const [name, setName] = useState(profile.name || '');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name || '');
  const [nameState, setNameState] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  // Device-only data, read after mount (localStorage isn't there on the
  // server), and the tab from the URL hash so /profile#recent deep-links.
  useEffect(() => {
    const t = setTimeout(() => {
      setHistory(readHistory());
      setChecklists(readChecklists());
      const h = window.location.hash.replace('#', '');
      if (TABS.some((x) => x.key === h)) setTab(h);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const pickTab = (k) => {
    setTab(k);
    try { window.history.replaceState(null, '', `#${k}`); } catch {}
  };

  /* ---------- derived ---------- */
  const folderName = useMemo(() => Object.fromEntries((folders || []).map((f) => [f.id, f.name])), [folders]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reports.filter((r) => filter === 'all' || typeOf(r).key === filter);
    if (q) {
      list = list.filter((r) => [r.title, r.address, r.areaName, r.city, folderName[r.folder_id], typeOf(r).label]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    if (sort === 'score') list = [...list].sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
    return list;
  }, [reports, filter, query, sort, folderName]);

  const groups = useMemo(() => {
    const byId = new Map();
    const unfiled = [];
    visible.forEach((r) => {
      if (r.folder_id && folderName[r.folder_id]) {
        if (!byId.has(r.folder_id)) byId.set(r.folder_id, []);
        byId.get(r.folder_id).push(r);
      } else unfiled.push(r);
    });
    const out = [...byId.entries()].map(([id, list]) => ({ id, name: folderName[id], list }));
    out.sort((a, b) => a.name.localeCompare(b.name));
    if (unfiled.length) out.push({ id: 'unfiled', name: out.length ? 'Not in a folder' : null, list: unfiled });
    return out;
  }, [visible, folderName]);

  const counts = useMemo(() => {
    const c = { all: reports.length };
    reports.forEach((r) => { const k = typeOf(r).key; c[k] = (c[k] || 0) + 1; });
    return c;
  }, [reports]);

  const ticksTotal = checklists.reduce((n, c) => n + c.ticked.length, 0);

  // The best-scoring home they've looked at or saved -- a small
  // "so far" highlight, from whichever source has a score.
  const best = useMemo(() => {
    const cands = [
      ...history.filter((h) => num(h.score) != null).map((h) => ({ score: num(h.score), address: h.address, href: reportHref(h), when: h.ts, floor: h.floor, facing: h.facing })),
      // Overall scores only -- a flat-only or area-only number isn't comparable.
      ...reports.filter((r) => num(r.combined) != null && r.lat && r.lon).map((r) => ({
        score: num(r.combined), address: r.address || r.title, when: r.created_at, floor: r.floor, facing: r.facing,
        href: reportHref({ lat: r.lat, lon: r.lon, address: r.address, floor: r.floor, facing: r.facing, pinCode: r.pin, pin: true }),
      })),
    ];
    return cands.sort((a, b) => b.score - a.score)[0] || null;
  }, [history, reports]);

  const addrFor = (lat, lon) => {
    const hit = history.find((h) => Math.abs(h.lat - lat) < 1e-4 && Math.abs(h.lon - lon) < 1e-4);
    return hit || null;
  };

  /* ---------- actions ---------- */
  const deleteReport = async (id) => {
    setDelError('');
    const prev = reports;
    setReports((list) => list.filter((r) => r.id !== id));
    setConfirmDel(null);
    try {
      // Straight to the database (RLS: own rows only); the API route is the
      // fallback when the browser client isn't configured.
      const supabase = createClient();
      if (typeof supabase.from === 'function') {
        const { error } = await supabase.from('reports').delete().eq('id', id);
        if (error) throw error;
      } else {
        const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
      }
    } catch {
      setReports(prev);
      setDelError('Couldn’t delete that report just now. Try again in a moment.');
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (next === name) { setEditingName(false); return; }
    setNameState('saving');
    const { error } = await createClient().auth.updateUser({ data: { full_name: next } });
    if (error) { setNameState('error'); return; }
    setName(next);
    setNameState('saved');
    setEditingName(false);
    router.refresh();
    setTimeout(() => setNameState(''), 2000);
  };

  const signOut = async () => {
    setSigningOut(true);
    try { await createClient().auth.signOut(); } catch {}
    window.location.href = '/';
  };

  const forgetVisit = (h) => { removeVisit(h.lat, h.lon); setHistory(readHistory()); };
  const forgetAll = () => { clearHistory(); setHistory([]); };

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;
  const providerLabel = profile.provider === 'google' ? 'Google' : 'Email';
  const displayName = name || (profile.email || '').split('@')[0];

  /* ---------- render ---------- */
  const firstName = displayName.split(' ')[0];
  return (
    <main className="pf">
      <div className="pf-wrap">
        {/* ---------------- who ---------------- */}
        <header className="pf-top">
          <HomeMark seed={profile.id || profile.email} size={64} className="pf-mark" title="Your BlindSpot mark" />
          <div className="pf-top-text">
            {editingName ? (
              <form className="pf-name-edit" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
                <button type="submit" className="pf-tlink" disabled={nameState === 'saving'}>{nameState === 'saving' ? 'Saving…' : 'Save'}</button>
                <button type="button" className="pf-tlink is-quiet" onClick={() => { setEditingName(false); setNameDraft(name); setNameState(''); }}>Cancel</button>
              </form>
            ) : (
              <h1 className="pf-title">{firstName}&rsquo;s <em>shortlist.</em></h1>
            )}
            {nameState === 'error' && <p className="pf-err">Couldn&rsquo;t save your name. Try again.</p>}
            <p className="pf-meta">
              <span>{profile.email}</span>
              {memberSince && <span>since {memberSince}</span>}
              {!editingName && <button type="button" className="pf-tlink" onClick={() => { setNameDraft(name); setEditingName(true); }}>Edit name</button>}
              <button type="button" className="pf-tlink" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </p>
          </div>
          <Link href="/#find" className="pf-new">Check a new home <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </header>

        {/* ---------------- the numbers, as a sentence ---------------- */}
        <p className="pf-line">
          <strong>{reports.length}</strong> {reports.length === 1 ? 'report' : 'reports'} saved
          {(folders || []).length > 0 && <> in <strong>{folders.length}</strong> {folders.length === 1 ? 'folder' : 'folders'}</>}
          {history.length > 0 && <>, <strong>{history.length}</strong> {history.length === 1 ? 'home' : 'homes'} checked on this device</>}
          {ticksTotal > 0 && <>, <strong>{ticksTotal}</strong> site-visit {ticksTotal === 1 ? 'check' : 'checks'} ticked</>}.
        </p>

        {best && (
          <Link href={best.href} className="pf-best">
            <span className="pf-best-score">{best.score}</span>
            <span className="pf-best-text">
              <span className="pf-best-k">Top of your list</span>
              <strong>{shortAddr(best.address)[0] || 'A home you checked'}</strong>
              <span>{[best.floor && `floor ${best.floor}`, best.facing && `${best.facing.toLowerCase()}-facing`].filter(Boolean).join(', ') || ago(best.when)}</span>
            </span>
            <span className="pf-best-go">Open <ArrowUpRight size={15} aria-hidden="true" /></span>
          </Link>
        )}

        {/* ---------------- tabs ---------------- */}
        <nav className="pf-tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={`pf-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => pickTab(t.key)}>
              {t.label}
              {t.key === 'saved' && reports.length > 0 && <sup>{reports.length}</sup>}
              {t.key === 'recent' && history.length > 0 && <sup>{history.length}</sup>}
            </button>
          ))}
        </nav>

        {/* ---------------- saved ---------------- */}
        {tab === 'saved' && (
          <section className="pf-panel" id="saved" role="tabpanel">
            {fetchFailed && <p className="pf-empty">We couldn&rsquo;t load your saved reports just now. That&rsquo;s on our side, not your account. Refresh in a moment.</p>}
            {!fetchFailed && reports.length === 0 ? (
              <div className="pf-empty">
                <p><strong>Nothing saved yet.</strong> Generate a full report, a sun &amp; shadow report or a furnishing plan and press &ldquo;Save report&rdquo;. Put a few under one folder, say &ldquo;Flat 402&rdquo;, to keep a home&rsquo;s reports together.</p>
                <Link href="/#find" className="pf-tlink">Check a home &rarr;</Link>
              </div>
            ) : !fetchFailed && (
              <>
                <div className="pf-tools">
                  <label className="pf-search">
                    <Search size={15} aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search your reports" />
                  </label>
                  <div className="pf-filters" role="group" aria-label="Filter by type">
                    {FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => (
                      <button key={f.key} type="button" className={`pf-filter${filter === f.key ? ' is-on' : ''}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
                        {f.label} <span>{counts[f.key] || 0}</span>
                      </button>
                    ))}
                  </div>
                  <label className="pf-sort">
                    <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                      <option value="new">Newest first</option>
                      <option value="score">Best score first</option>
                    </select>
                  </label>
                </div>

                {delError && <p className="pf-err" role="alert">{delError}</p>}
                {visible.length === 0 && <p className="pf-empty">Nothing matches that.</p>}

                {groups.map((g) => (
                  <div className="pf-group" key={g.id}>
                    {g.name && <h2 className="pf-group-h"><span>{g.name}</span><small>{g.list.length}</small></h2>}
                    <ol className="pf-ledger">
                      {g.list.map((r) => {
                        const t = typeOf(r);
                        const sc = scoreOf(r);
                        const tt = titleFor(r);
                        const dm = dayMonth(r.created_at);
                        const bits = [r.floor && `Floor ${r.floor}`, r.facing, r.areaName && !tt.main.includes(r.areaName) && r.areaName, r.pin && `PIN ${r.pin}`,
                          tt.coords && r.lat && `${num(r.lat * 100) / 100}, ${num(r.lon * 100) / 100}`].filter(Boolean);
                        return (
                          <li key={r.id} className={`pf-entry is-${t.key}`}>
                            <span className="pf-date"><b>{dm.d}</b>{dm.m}</span>
                            <Link href={`/my-reports/${r.id}`} className="pf-entry-main">
                              <strong>{tt.main}</strong>
                              <span><i className="pf-dot" aria-hidden="true" />{t.label}{bits.length ? ` · ${bits.slice(0, 3).join(' · ')}` : ''}</span>
                            </Link>
                            <span className="pf-num" title={sc != null ? 'Score when saved' : undefined}>
                              {sc != null ? <>{sc}<i aria-hidden="true"><b style={{ width: `${sc}%` }} /></i></> : <span className="pf-num-none">–</span>}
                            </span>
                            {confirmDel === r.id ? (
                              <span className="pf-confirm">
                                <button type="button" className="pf-tlink is-danger" onClick={() => deleteReport(r.id)}>Delete</button>
                                <button type="button" className="pf-tlink is-quiet" onClick={() => setConfirmDel(null)}>Keep</button>
                              </span>
                            ) : (
                              <button type="button" className="pf-del" onClick={() => setConfirmDel(r.id)} aria-label={`Delete ${tt.main}`} title="Delete"><Trash2 size={15} /></button>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* ---------------- recently viewed ---------------- */}
        {tab === 'recent' && (
          <section className="pf-panel" id="recent" role="tabpanel">
            <p className="pf-aside">Kept in this browser only.</p>
            {history.length === 0 ? (
              <div className="pf-empty"><p><strong>No homes checked here yet.</strong> Every address you open a report for lands here with its score, so you can jump back in.</p><Link href="/#find" className="pf-tlink">Check a home &rarr;</Link></div>
            ) : (
              <>
                <ol className="pf-ledger">
                  {history.map((h) => {
                    const parts = shortAddr(h.address);
                    const sc = num(h.score);
                    const dm = dayMonth(h.ts);
                    const bits = [h.areaName || parts[1], h.floor && `Floor ${h.floor}`, h.facing, h.area != null && `area ${num(h.area)}`, h.unit != null && `flat ${num(h.unit)}`].filter(Boolean);
                    return (
                      <li key={`${h.lat},${h.lon}`} className="pf-entry">
                        <span className="pf-date"><b>{dm.d}</b>{dm.m}</span>
                        <Link href={reportHref(h)} className="pf-entry-main">
                          <strong>{parts[0] || 'A pinned spot'}</strong>
                          <span>{bits.join(' · ')}</span>
                        </Link>
                        <span className="pf-num">{sc != null ? <>{sc}<i aria-hidden="true"><b style={{ width: `${sc}%` }} /></i></> : <span className="pf-num-none">–</span>}</span>
                        <button type="button" className="pf-del" onClick={() => forgetVisit(h)} aria-label="Remove from this list" title="Remove"><X size={15} /></button>
                      </li>
                    );
                  })}
                </ol>
                <p className="pf-foot">
                  <Link href="/compare" className="pf-tlink">Compare flats side by side &rarr;</Link>
                  <button type="button" className="pf-tlink is-quiet" onClick={forgetAll}>Clear this list</button>
                </p>
              </>
            )}
          </section>
        )}

        {/* ---------------- notes ---------------- */}
        {tab === 'notes' && (
          <section className="pf-panel" id="notes" role="tabpanel">
            <p className="pf-aside">Your &ldquo;what to check before you decide&rdquo; ticks and notes, from this browser.</p>
            {checklists.length === 0 ? (
              <div className="pf-empty"><p><strong>No site-visit notes yet.</strong> On any report, tick things off the checklist as you walk round a flat and write down what you found. They collect here.</p></div>
            ) : (
              <div className="pf-notes">
                {checklists.map((c) => {
                  const h = addrFor(c.lat, c.lon);
                  const parts = shortAddr(h?.address);
                  return (
                    <article key={`${c.lat},${c.lon}`} className="pf-noteset">
                      <header>
                        <h3>{parts[0] || 'A pinned spot'}</h3>
                        <span>{c.ticked.length} checked{c.notes.length ? `, ${c.notes.length} ${c.notes.length === 1 ? 'note' : 'notes'}` : ''}</span>
                        <Link href={`${reportHref(h || { lat: c.lat, lon: c.lon })}#the-visit`} className="pf-tlink">Open checklist &rarr;</Link>
                      </header>
                      {c.notes.length > 0 && (
                        <dl>
                          {c.notes.map(([k, v]) => (<div key={k}><dt>{CHECK_LABELS[k] || k}</dt><dd>{v}</dd></div>))}
                        </dl>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ---------------- account ---------------- */}
        {tab === 'account' && (
          <section className="pf-panel" id="account" role="tabpanel">
            <dl className="pf-account">
              <div><dt>Name</dt><dd>{name || <span className="pf-dim">Not set</span>}<button type="button" className="pf-tlink" onClick={() => { setNameDraft(name); setEditingName(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button></dd></div>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Signs in with</dt><dd>{providerLabel}</dd></div>
              {memberSince && <div><dt>Member since</dt><dd>{memberSince}</dd></div>}
              {profile.lastSignIn && <div><dt>Last signed in</dt><dd>{ago(profile.lastSignIn)}</dd></div>}
              <div><dt>In this browser</dt><dd>{history.length} homes checked, {checklists.length} checklists. Not synced to your account.<button type="button" className="pf-tlink is-quiet" onClick={forgetAll} disabled={!history.length}>Clear</button></dd></div>
            </dl>
            <p className="pf-foot"><button type="button" className="pf-tlink" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></p>
          </section>
        )}
      </div>
    </main>
  );
}
