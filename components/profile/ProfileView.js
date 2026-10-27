'use client';
// components/profile/ProfileView.js
//
// The profile page. Built around the way people actually use BlindSpot:
// they're choosing between a few homes. So the page is a ranked shortlist
// of homes, not a list of documents -- each home (a folder, or every save
// at the same address) is one row with its scores and the reports saved
// for it. Areas, homes checked on this device but never saved, site-visit
// notes and account settings follow as quieter sections on one page.
//
// Server-fetched: the account and every saved report (light columns only).
// Read from this browser: the homes looked at (lib/profile/history.js) and
// the site-visit checklists, which have always lived per device.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowUpRight, Plus, FileText, Sun, Sofa, MapPin } from 'lucide-react';
import HomeMark from './HomeMark';
import { createClient } from '@/lib/supabase/client';
import { readHistory, removeVisit, clearHistory, readChecklists } from '@/lib/profile/history';
import './profile.css';

// What each saved row is, in words a buyer uses.
function typeOf(r) {
  if (r.source === 'ai-report') {
    return r.kind === 'sun-shadow'
      ? { key: 'sun', label: 'Sun & shadow', Icon: Sun }
      : { key: 'full', label: 'Full report', Icon: FileText };
  }
  if (r.source === 'neighbourhood' || r.source === 'aslivastu') return { key: 'area', label: 'Area report', Icon: MapPin };
  if (r.source === 'furnishing') return { key: 'furnish', label: 'Furnishing plan', Icon: Sofa };
  return { key: 'full', label: 'Home comfort', Icon: FileText };
}

const CHECK_LABELS = {
  crime: 'Safety', schools: 'Schools', air: 'Air quality', water: 'Water supply', power: 'Power',
  roads: 'Roads', infrastructure: 'Infrastructure', sewerage: 'Drainage', sun: 'Sunlight',
  shadeHeat: 'Summer heat', view: 'View', privacy: 'Privacy', wind: 'Ventilation', dampness: 'Dampness', noise: 'Noise',
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function ago(ts) {
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 2) return 'yesterday';
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
function nameFor(addressOrTitle) {
  const first = shortAddr(addressOrTitle)[0] || '';
  if (!first || COORDS.test(first)) return 'A pinned spot';
  return first === first.toLowerCase() ? first.replace(/\b\w/g, (c) => c.toUpperCase()) : first;
}
const spotKey = (lat, lon) => (Number.isFinite(+lat) && Number.isFinite(+lon) ? `${(+lat).toFixed(3)},${(+lon).toFixed(3)}` : null);
const tone = (s) => (s == null ? 'none' : s >= 70 ? 'good' : s >= 50 ? 'avg' : 'poor');
const toneWord = (s) => (s == null ? '' : s >= 80 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Average' : 'Weak');

// Saved reports -> homes. A folder is a home (that's what the save panel
// tells people to use them for). Unfiled reports at the same spot -- or
// with the same name when there are no coordinates -- are one home too.
// Area-only reports have no flat behind them and are listed separately.
function buildHomes(reports, folderName, history) {
  const homes = new Map();
  const areas = [];
  const histBySpot = new Map(history.map((h) => [spotKey(h.lat, h.lon), h]));
  for (const r of reports) {
    const t = typeOf(r);
    if (t.key === 'area') { areas.push(r); continue; }
    const key = r.folder_id && folderName[r.folder_id]
      ? `f:${r.folder_id}`
      : spotKey(r.lat, r.lon) ? `s:${spotKey(r.lat, r.lon)}` : `n:${nameFor(r.address || r.title).toLowerCase()}`;
    if (!homes.has(key)) homes.set(key, { key, folder: r.folder_id ? folderName[r.folder_id] : null, reports: [] });
    homes.get(key).reports.push(r);
  }
  const out = [...homes.values()].map((h) => {
    const rs = h.reports;
    const lead = rs.find((r) => num(r.combined) != null) || rs.find((r) => num(r.unit) != null) || rs[0];
    const withSpot = rs.find((r) => r.lat && r.lon);
    const seen = withSpot ? histBySpot.get(spotKey(withSpot.lat, withSpot.lon)) : null;
    const overall = num(lead.combined) ?? num(seen?.score) ?? num(lead.unit);
    const flat = num(lead.unit) ?? num(seen?.unit);
    const area = num(seen?.area) ?? (num(lead.nqi));
    const addrParts = shortAddr(lead.address || lead.title);
    const name = nameFor(lead.address || lead.title);
    const where = [lead.areaName, addrParts[1], lead.city].filter((x) => x && x !== name);
    return {
      ...h,
      name,
      title: h.folder && h.folder.toLowerCase() !== name.toLowerCase() ? h.folder : null,
      where: [...new Set(where)].slice(0, 2).join(', '),
      floor: lead.floor, facing: lead.facing,
      overall, flat, area,
      when: rs.reduce((m, r) => (Date.parse(r.created_at) > m ? Date.parse(r.created_at) : m), 0),
      href: withSpot ? reportHref({ lat: withSpot.lat, lon: withSpot.lon, address: withSpot.address, floor: lead.floor, facing: lead.facing, pinCode: lead.pin, pin: true }) : null,
    };
  });
  // Ranked: best overall score first, unscored homes after, newest first.
  out.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || b.when - a.when);
  return { homes: out, areas };
}

function Bars({ area, flat }) {
  if (area == null && flat == null) return null;
  return (
    <span className="pf-bars">
      {area != null && (
        <span className="pf-bar is-area">
          <span className="pf-bar-k">Area</span>
          <span className="pf-bar-track"><span style={{ width: `${area}%` }} /></span>
          <span className="pf-bar-v">{area}</span>
        </span>
      )}
      {flat != null && (
        <span className="pf-bar is-flat">
          <span className="pf-bar-k">Flat</span>
          <span className="pf-bar-track"><span style={{ width: `${flat}%` }} /></span>
          <span className="pf-bar-v">{flat}</span>
        </span>
      )}
    </span>
  );
}

export default function ProfileView({ profile, initialReports, folders, fetchFailed }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports || []);
  const [history, setHistory] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [query, setQuery] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [delError, setDelError] = useState('');
  const [name, setName] = useState(profile.name || '');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name || '');
  const [nameState, setNameState] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  // Device-only data, read after mount (localStorage isn't there on the
  // server). Old /profile#recent style links scroll to their section.
  useEffect(() => {
    const t = setTimeout(() => {
      setHistory(readHistory());
      setChecklists(readChecklists());
      const h = window.location.hash.replace('#', '');
      if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }), 60);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  /* ---------- derived ---------- */
  const folderName = useMemo(() => Object.fromEntries((folders || []).map((f) => [f.id, f.name])), [folders]);
  const { homes, areas } = useMemo(() => buildHomes(reports, folderName, history), [reports, folderName, history]);

  const q = query.trim().toLowerCase();
  const match = (h) => !q || [h.name, h.title, h.where, h.facing, ...h.reports.map((r) => r.title)].filter(Boolean).join(' ').toLowerCase().includes(q);
  const shownHomes = homes.filter(match);

  // Homes looked at on this device that were never saved.
  const savedSpots = useMemo(() => new Set(reports.map((r) => spotKey(r.lat, r.lon)).filter(Boolean)), [reports]);
  const unsaved = history.filter((h) => !savedSpots.has(spotKey(h.lat, h.lon)));

  const historyFor = (lat, lon) => history.find((h) => spotKey(h.lat, h.lon) === spotKey(lat, lon)) || null;

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
      setDelError('Couldn’t delete that report. Check your connection and try again.');
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (next === name) { setEditingName(false); return; }
    setNameState('saving');
    const { error } = await createClient().auth.updateUser({ data: { full_name: next } });
    if (error) { setNameState('error'); return; }
    setName(next);
    setNameState('');
    setEditingName(false);
    router.refresh();
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
  const providerLabel = profile.provider === 'google' ? 'Google' : 'Email and password';
  const displayName = name || (profile.email || '').split('@')[0];

  const reportChip = (r) => {
    const t = typeOf(r);
    if (confirmDel === r.id) {
      return (
        <span key={r.id} className="pf-chip is-confirm">
          Delete this {t.label.toLowerCase()}?
          <button type="button" className="pf-chip-yes" onClick={() => deleteReport(r.id)}>Delete</button>
          <button type="button" className="pf-chip-no" onClick={() => setConfirmDel(null)}>Keep</button>
        </span>
      );
    }
    return (
      <span key={r.id} className={`pf-chip is-${t.key}`}>
        <Link href={`/my-reports/${r.id}`} className="pf-chip-open">
          <t.Icon size={14} strokeWidth={2.2} aria-hidden="true" />
          {t.label}
          <span className="pf-chip-when">{ago(r.created_at)}</span>
        </Link>
        <button type="button" className="pf-chip-x" onClick={() => setConfirmDel(r.id)} aria-label={`Delete ${t.label}, saved ${ago(r.created_at)}`}>
          <X size={13} strokeWidth={2.4} />
        </button>
      </span>
    );
  };

  /* ---------- render ---------- */
  return (
    <main className="pf">
      <div className="pf-wrap">
        {/* ---------------- who ---------------- */}
        <header className="pf-who">
          <HomeMark seed={profile.id || profile.email} size={52} className="pf-mark" title="Your BlindSpot mark" />
          <div className="pf-who-text">
            {editingName ? (
              <form className="pf-name-edit" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
                <button type="submit" className="pf-link" disabled={nameState === 'saving'}>{nameState === 'saving' ? 'Saving…' : 'Save'}</button>
                <button type="button" className="pf-link is-quiet" onClick={() => { setEditingName(false); setNameDraft(name); setNameState(''); }}>Cancel</button>
              </form>
            ) : (
              <p className="pf-name">{displayName}</p>
            )}
            {nameState === 'error' && <p className="pf-err">Couldn&rsquo;t save your name. Try again.</p>}
            <p className="pf-email">{profile.email}</p>
          </div>
          {/* An empty shortlist has its own button right below. */}
          {(homes.length > 0 || fetchFailed) && (
            <Link href="/#find" className="pf-new"><Plus size={17} strokeWidth={2.4} aria-hidden="true" /> Check a new home</Link>
          )}
        </header>

        {/* ---------------- the shortlist ---------------- */}
        <section className="pf-short" id="saved" aria-labelledby="pf-short-h">
          <div className="pf-short-head">
            <h1 id="pf-short-h">Your shortlist</h1>
            {homes.length > 0 && (
              <p>{homes.length === 1 ? 'One home saved so far.' : `${homes.length} homes, best score first.`}</p>
            )}
            {homes.length > 5 && (
              <label className="pf-search">
                <Search size={15} aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a home" aria-label="Find a home in your shortlist" />
              </label>
            )}
          </div>

          {fetchFailed && (
            <p className="pf-note is-bad">Your saved reports didn&rsquo;t load. Refresh the page; if it keeps happening, sign out and back in.</p>
          )}
          {delError && <p className="pf-note is-bad" role="alert">{delError}</p>}

          {!fetchFailed && homes.length === 0 && (
            <div className="pf-empty">
              <p className="pf-empty-h">Nothing on your shortlist yet.</p>
              <p>Search an address, set the floor and facing, and press <strong>Save report</strong> on any report. Every home you save lands here, ranked against the others.</p>
              <Link href="/#find" className="pf-new is-solid">Check a home</Link>
            </div>
          )}

          {shownHomes.length > 0 && (
            <ol className="pf-homes">
              {shownHomes.map((h) => {
                const rank = homes.indexOf(h) + 1;
                const lead = rank === 1 && homes.length > 1 && h.overall != null;
                return (
                  <li key={h.key} className={`pf-home${lead ? ' is-lead' : ''}`}>
                    <span className="pf-rank" aria-label={`Rank ${rank}`}>{rank}</span>
                    <div className="pf-home-body">
                      {h.title && <p className="pf-home-folder">{h.title}</p>}
                      <h2 className="pf-home-name">
                        {h.href ? <Link href={h.href}>{h.name}</Link> : h.name}
                      </h2>
                      <p className="pf-home-where">
                        {[h.floor && `Floor ${h.floor}`, h.facing && `${h.facing}-facing`, h.where].filter(Boolean).join(', ') || 'No floor or facing saved'}
                      </p>
                      <Bars area={h.area} flat={h.flat} />
                      <div className="pf-chips">{h.reports.map(reportChip)}</div>
                    </div>
                    <div className={`pf-score is-${tone(h.overall)}`}>
                      {h.overall != null ? (
                        <>
                          <span className="pf-score-n">{h.overall}</span>
                          <span className="pf-score-w">{toneWord(h.overall)}</span>
                        </>
                      ) : (
                        <span className="pf-score-none">No score</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {q && shownHomes.length === 0 && homes.length > 0 && <p className="pf-note">No home in your shortlist matches &ldquo;{query}&rdquo;.</p>}
        </section>

        {/* ---------------- areas ---------------- */}
        {areas.length > 0 && (
          <section className="pf-sec" aria-labelledby="pf-areas-h">
            <h2 id="pf-areas-h" className="pf-sec-h">Areas you&rsquo;ve looked into</h2>
            <ul className="pf-rows">
              {areas.map((r) => {
                const s = num(r.nqi);
                return (
                  <li key={r.id} className="pf-row">
                    <Link href={`/my-reports/${r.id}`} className="pf-row-main">
                      <strong>{r.areaName || nameFor(r.title)}</strong>
                      <span>{[r.city, r.pin && `PIN ${r.pin}`, `saved ${ago(r.created_at)}`].filter(Boolean).join(', ')}</span>
                    </Link>
                    {s != null && <span className={`pf-row-n is-${tone(s)}`}>{s}</span>}
                    {confirmDel === r.id ? (
                      <span className="pf-row-confirm">
                        <button type="button" className="pf-link is-danger" onClick={() => deleteReport(r.id)}>Delete</button>
                        <button type="button" className="pf-link is-quiet" onClick={() => setConfirmDel(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="pf-row-x" onClick={() => setConfirmDel(r.id)} aria-label={`Delete the area report for ${r.areaName || r.title}`}><X size={15} /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ---------------- checked, not saved ---------------- */}
        <section className="pf-sec" id="recent" aria-labelledby="pf-recent-h">
          <div className="pf-sec-top">
            <h2 id="pf-recent-h" className="pf-sec-h">Checked on this device, not saved</h2>
            {unsaved.length > 0 && <button type="button" className="pf-link is-quiet" onClick={forgetAll}>Clear</button>}
          </div>
          {unsaved.length === 0 ? (
            <p className="pf-note">Homes you open a report for show up here until you save them. They stay in this browser only.</p>
          ) : (
            <ul className="pf-rows">
              {unsaved.map((h) => {
                const sc = num(h.score);
                return (
                  <li key={`${h.lat},${h.lon}`} className="pf-row">
                    <Link href={reportHref(h)} className="pf-row-main">
                      <strong>{nameFor(h.address)}</strong>
                      <span>{[h.floor && `Floor ${h.floor}`, h.facing, shortAddr(h.address)[1], ago(h.ts)].filter(Boolean).join(', ')}</span>
                    </Link>
                    {sc != null && <span className={`pf-row-n is-${tone(sc)}`}>{sc}</span>}
                    <button type="button" className="pf-row-x" onClick={() => forgetVisit(h)} aria-label={`Remove ${nameFor(h.address)} from this list`}><X size={15} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          {homes.length + unsaved.length >= 2 && (
            <Link href="/compare" className="pf-link pf-compare">Compare two of them side by side <ArrowUpRight size={14} aria-hidden="true" /></Link>
          )}
        </section>

        {/* ---------------- site-visit notes ---------------- */}
        {checklists.length > 0 && (
          <section className="pf-sec" id="notes" aria-labelledby="pf-notes-h">
            <h2 id="pf-notes-h" className="pf-sec-h">Site-visit notes</h2>
            <div className="pf-notes">
              {checklists.map((c) => {
                const h = historyFor(c.lat, c.lon);
                return (
                  <article key={`${c.lat},${c.lon}`} className="pf-noteset">
                    <header>
                      <h3>{nameFor(h?.address)}</h3>
                      <span>{c.ticked.length} of the checks ticked</span>
                      <Link href={`${reportHref(h || { lat: c.lat, lon: c.lon })}#the-visit`} className="pf-link">Open checklist</Link>
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
          </section>
        )}

        {/* ---------------- account ---------------- */}
        <section className="pf-sec" id="account" aria-labelledby="pf-acct-h">
          <h2 id="pf-acct-h" className="pf-sec-h">Account</h2>
          <dl className="pf-account">
            <div><dt>Name</dt><dd>{name || <span className="pf-dim">Not set</span>}<button type="button" className="pf-link" onClick={() => { setNameDraft(name); setEditingName(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button></dd></div>
            <div><dt>Email</dt><dd>{profile.email}</dd></div>
            <div><dt>Signs in with</dt><dd>{providerLabel}</dd></div>
            {memberSince && <div><dt>Member since</dt><dd>{memberSince}</dd></div>}
            <div><dt>On this device</dt><dd>{history.length} {history.length === 1 ? 'home' : 'homes'} checked, {checklists.length} {checklists.length === 1 ? 'checklist' : 'checklists'}. Not synced to your account.</dd></div>
          </dl>
          <button type="button" className="pf-signout" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </section>
      </div>
    </main>
  );
}
