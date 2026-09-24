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
import {
  Sun, FileText, Building2, Sofa, Search, Trash2, Pencil, Check, X, LogOut,
  MapPin, ClipboardCheck, FolderOpen, Clock, ArrowUpRight, Star, HardDrive,
} from 'lucide-react';
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
      ? { key: 'sun', label: 'Sun & shadow report', Icon: Sun }
      : { key: 'full', label: 'Full BlindSpot report', Icon: FileText };
  }
  if (r.source === 'neighbourhood' || r.source === 'aslivastu') return { key: 'area', label: 'Area report', Icon: Building2 };
  if (r.source === 'furnishing') return { key: 'furnish', label: 'Furnishing plan', Icon: Sofa };
  return { key: 'full', label: 'Home comfort report', Icon: FileText };
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

function Dial({ score, size = 52 }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const r = 20, c = 2 * Math.PI * r;
  return (
    <span className="pf-dial" style={{ width: size, height: size }} aria-label={score == null ? 'No score' : `Score ${score} out of 100`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="pf-dial-track" />
        {score != null && (
          <circle cx="24" cy="24" r={r} className="pf-dial-arc" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 24 24)" />
        )}
      </svg>
      <span className="pf-dial-n">{score ?? '–'}</span>
    </span>
  );
}

function initialsOf(name, email) {
  const src = (name || email || '').trim();
  if (!src) return '·';
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || src[0].toUpperCase();
}

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
  const notesTotal = checklists.reduce((n, c) => n + c.notes.length, 0);

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
  return (
    <main className="pf">
      <div className="pf-wrap">
        {/* ---------------- who ---------------- */}
        <section className="pf-hero">
          <div className="pf-id">
            <span className="pf-avatar" aria-hidden="true">
              {profile.avatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" />
                : initialsOf(name, profile.email)}
            </span>
            <div className="pf-id-text">
              <p className="pf-eyebrow">Your BlindSpot profile</p>
              {editingName ? (
                <form className="pf-name-edit" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                    maxLength={60}
                    autoFocus
                  />
                  <button type="submit" className="pf-icon-btn is-go" aria-label="Save name" disabled={nameState === 'saving'}><Check size={16} /></button>
                  <button type="button" className="pf-icon-btn" aria-label="Cancel" onClick={() => { setEditingName(false); setNameDraft(name); setNameState(''); }}><X size={16} /></button>
                </form>
              ) : (
                <h1 className="pf-name">
                  {displayName}
                  <button type="button" className="pf-icon-btn" onClick={() => { setNameDraft(name); setEditingName(true); }} aria-label="Edit your name" title="Edit your name">
                    <Pencil size={14} />
                  </button>
                </h1>
              )}
              {nameState === 'error' && <p className="pf-err">Couldn’t save your name. Try again.</p>}
              <p className="pf-sub">
                {profile.email}
                {memberSince && <> · Member since {memberSince}</>}
                {' · '}Signs in with {providerLabel}
              </p>
            </div>
          </div>
          <div className="pf-hero-actions">
            <Link href="/#find" className="pf-btn is-primary"><Search size={16} aria-hidden="true" /> Check a new home</Link>
            <button type="button" className="pf-btn is-ghost" onClick={signOut} disabled={signingOut}>
              <LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </section>

        {/* ---------------- at a glance ---------------- */}
        <section className="pf-stats" aria-label="At a glance">
          <button type="button" className="pf-stat" onClick={() => pickTab('saved')}>
            <FileText size={18} aria-hidden="true" />
            <strong>{reports.length}</strong><span>Saved reports</span>
          </button>
          <button type="button" className="pf-stat" onClick={() => pickTab('saved')}>
            <FolderOpen size={18} aria-hidden="true" />
            <strong>{(folders || []).length}</strong><span>Property folders</span>
          </button>
          <button type="button" className="pf-stat" onClick={() => pickTab('recent')}>
            <MapPin size={18} aria-hidden="true" />
            <strong>{history.length}</strong><span>Homes checked</span>
          </button>
          <button type="button" className="pf-stat" onClick={() => pickTab('notes')}>
            <ClipboardCheck size={18} aria-hidden="true" />
            <strong>{ticksTotal}</strong><span>Checks ticked{notesTotal ? ` · ${notesTotal} notes` : ''}</span>
          </button>
          {best && (
            <Link href={best.href} className="pf-best">
              <Dial score={best.score} size={58} />
              <span className="pf-best-text">
                <span className="pf-best-eyebrow"><Star size={12} aria-hidden="true" /> Best match so far</span>
                <strong>{shortAddr(best.address)[0] || 'A home you checked'}</strong>
                <span>{[best.floor && `Floor ${best.floor}`, best.facing && `${best.facing}-facing`].filter(Boolean).join(' · ') || ago(best.when)}</span>
              </span>
              <ArrowUpRight size={16} className="pf-best-go" aria-hidden="true" />
            </Link>
          )}
        </section>

        {/* ---------------- tabs ---------------- */}
        <nav className="pf-tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`pf-tab${tab === t.key ? ' is-on' : ''}`}
              onClick={() => pickTab(t.key)}
            >
              {t.label}
              {t.key === 'saved' && reports.length > 0 && <span className="pf-tab-n">{reports.length}</span>}
              {t.key === 'recent' && history.length > 0 && <span className="pf-tab-n">{history.length}</span>}
            </button>
          ))}
        </nav>

        {/* ---------------- saved reports ---------------- */}
        {tab === 'saved' && (
          <section className="pf-panel" id="saved" role="tabpanel">
            {fetchFailed && (
              <p className="pf-empty">We couldn’t load your saved reports just now. That’s on our side, not your account — refresh in a moment.</p>
            )}
            {!fetchFailed && reports.length === 0 ? (
              <div className="pf-empty">
                <FileText size={26} aria-hidden="true" />
                <strong>Nothing saved yet</strong>
                <p>Generate a full report, a sun &amp; shadow report or a furnishing plan and hit “Save report”. File a few under the same folder (say, “Flat 402”) to keep everything about one home together.</p>
                <Link href="/#find" className="pf-btn is-primary">Check a home</Link>
              </div>
            ) : !fetchFailed && (
              <>
                <div className="pf-tools">
                  <label className="pf-search">
                    <Search size={15} aria-hidden="true" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your reports" aria-label="Search your reports" />
                  </label>
                  <div className="pf-chips" role="group" aria-label="Filter by type">
                    {FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => (
                      <button key={f.key} type="button" className={`pf-chip${filter === f.key ? ' is-on' : ''}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
                        {f.label}<span>{counts[f.key] || 0}</span>
                      </button>
                    ))}
                  </div>
                  <label className="pf-sort">
                    <span>Sort</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="new">Newest</option>
                      <option value="score">Best score</option>
                    </select>
                  </label>
                </div>

                {delError && <p className="pf-err" role="alert">{delError}</p>}
                {visible.length === 0 && <p className="pf-empty is-slim">No saved reports match that.</p>}

                {groups.map((g) => (
                  <div className="pf-group" key={g.id}>
                    {g.name && (
                      <h2 className="pf-group-h">
                        <FolderOpen size={15} aria-hidden="true" /> {g.name}
                        <span>{g.list.length} {g.list.length === 1 ? 'report' : 'reports'}</span>
                      </h2>
                    )}
                    <ul className="pf-list">
                      {g.list.map((r) => {
                        const t = typeOf(r);
                        const sc = scoreOf(r);
                        const parts = shortAddr(r.address || r.title);
                        const unitBits = [r.floor && `Floor ${r.floor}`, r.facing && `${r.facing}-facing`, r.areaName, r.pin && `PIN ${r.pin}`].filter(Boolean);
                        return (
                          <li key={r.id} className={`pf-row is-${t.key}`}>
                            <span className="pf-type" aria-hidden="true"><t.Icon size={17} /></span>
                            <Link href={`/my-reports/${r.id}`} className="pf-row-main">
                              <span className="pf-row-kind">{t.label}</span>
                              <strong>{parts[0] || r.title || 'Untitled report'}</strong>
                              <span className="pf-row-meta">
                                {[...unitBits.slice(0, 2), ago(r.created_at)].filter(Boolean).join(' · ')}
                              </span>
                            </Link>
                            {sc != null && <span className="pf-score" title="Score when saved">{sc}</span>}
                            {confirmDel === r.id ? (
                              <span className="pf-confirm">
                                <span>Delete?</span>
                                <button type="button" className="pf-link is-danger" onClick={() => deleteReport(r.id)}>Yes</button>
                                <button type="button" className="pf-link" onClick={() => setConfirmDel(null)}>No</button>
                              </span>
                            ) : (
                              <button type="button" className="pf-icon-btn is-quiet" onClick={() => setConfirmDel(r.id)} aria-label={`Delete ${t.label}`} title="Delete">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* ---------------- recently viewed ---------------- */}
        {tab === 'recent' && (
          <section className="pf-panel" id="recent" role="tabpanel">
            <p className="pf-note"><HardDrive size={14} aria-hidden="true" /> Kept on this device only — the homes you’ve opened a report for.</p>
            {history.length === 0 ? (
              <div className="pf-empty">
                <MapPin size={26} aria-hidden="true" />
                <strong>No homes checked on this device yet</strong>
                <p>Every address you open a report for shows up here, with its score, so you can jump back in.</p>
                <Link href="/#find" className="pf-btn is-primary">Check a home</Link>
              </div>
            ) : (
              <>
                <ul className="pf-cards">
                  {history.map((h) => {
                    const parts = shortAddr(h.address);
                    return (
                      <li key={`${h.lat},${h.lon}`} className="pf-card">
                        <button type="button" className="pf-card-x" onClick={() => forgetVisit(h)} aria-label="Remove from this list" title="Remove"><X size={14} /></button>
                        <div className="pf-card-top">
                          <Dial score={num(h.score)} />
                          <div className="pf-card-text">
                            <strong>{parts[0] || `${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`}</strong>
                            <span>{h.areaName || parts.slice(1, 3).join(', ')}</span>
                          </div>
                        </div>
                        <div className="pf-card-bits">
                          {h.area != null && <span className="pf-bit is-av">Area {num(h.area)}</span>}
                          {h.unit != null && <span className="pf-bit is-ss">Flat {num(h.unit)}</span>}
                          {h.floor && <span className="pf-bit">Floor {h.floor}</span>}
                          {h.facing && <span className="pf-bit">{h.facing}</span>}
                        </div>
                        <div className="pf-card-foot">
                          <span><Clock size={12} aria-hidden="true" /> {ago(h.ts)}</span>
                          <Link href={reportHref(h)} className="pf-link">Reopen <ArrowUpRight size={13} aria-hidden="true" /></Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="pf-foot-actions">
                  <Link href="/compare" className="pf-link">Compare flats side by side <ArrowUpRight size={13} aria-hidden="true" /></Link>
                  <button type="button" className="pf-link is-quiet" onClick={forgetAll}>Clear this list</button>
                </p>
              </>
            )}
          </section>
        )}

        {/* ---------------- site-visit notes ---------------- */}
        {tab === 'notes' && (
          <section className="pf-panel" id="notes" role="tabpanel">
            <p className="pf-note"><HardDrive size={14} aria-hidden="true" /> Your “What to check before you decide” ticks and notes, from this device.</p>
            {checklists.length === 0 ? (
              <div className="pf-empty">
                <ClipboardCheck size={26} aria-hidden="true" />
                <strong>No site-visit notes yet</strong>
                <p>On any report, tick items off the checklist as you walk around a flat and jot down what you found. They collect here.</p>
              </div>
            ) : (
              <ul className="pf-notes">
                {checklists.map((c) => {
                  const h = addrFor(c.lat, c.lon);
                  const parts = shortAddr(h?.address);
                  return (
                    <li key={`${c.lat},${c.lon}`} className="pf-noteset">
                      <div className="pf-noteset-head">
                        <div>
                          <strong>{parts[0] || `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`}</strong>
                          <span>{c.ticked.length} checked{c.notes.length ? ` · ${c.notes.length} ${c.notes.length === 1 ? 'note' : 'notes'}` : ''}</span>
                        </div>
                        <Link href={`${reportHref(h || { lat: c.lat, lon: c.lon })}#the-visit`} className="pf-link">Open checklist <ArrowUpRight size={13} aria-hidden="true" /></Link>
                      </div>
                      {c.notes.length > 0 && (
                        <ul className="pf-notes-list">
                          {c.notes.map(([k, v]) => (
                            <li key={k}><span className="pf-note-k">{CHECK_LABELS[k] || k}</span>{v}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ---------------- account ---------------- */}
        {tab === 'account' && (
          <section className="pf-panel" id="account" role="tabpanel">
            <dl className="pf-account">
              <div><dt>Name</dt><dd>{name || <span className="pf-dim">Not set</span>} <button type="button" className="pf-link" onClick={() => { setNameDraft(name); setEditingName(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button></dd></div>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Signs in with</dt><dd>{providerLabel}</dd></div>
              {memberSince && <div><dt>Member since</dt><dd>{memberSince}</dd></div>}
              {profile.lastSignIn && <div><dt>Last signed in</dt><dd>{ago(profile.lastSignIn)}</dd></div>}
            </dl>
            <div className="pf-account-box">
              <strong>On this device</strong>
              <p>{history.length} homes checked and {checklists.length} site-visit checklists are stored in this browser only. They aren’t part of your account and don’t sync to other devices.</p>
              <button type="button" className="pf-btn is-ghost" onClick={forgetAll} disabled={!history.length}>Clear recently viewed</button>
            </div>
            <div className="pf-account-box">
              <strong>Sign out</strong>
              <p>Your saved reports stay in your account.</p>
              <button type="button" className="pf-btn is-ghost" onClick={signOut} disabled={signingOut}><LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
