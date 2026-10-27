'use client';
// components/profile/ProfileView.js
//
// The profile page: the homes you're deciding between, as big cards with a
// satellite view of each one and its score. Tap a card to reopen that home;
// tap a report on it to open what you saved. Homes you checked but never
// saved sit in a smaller strip underneath. Account details are a footer.
//
// Server-fetched: the account and every saved report (light columns only).
// Read from this browser: homes looked at (lib/profile/history.js) and the
// site-visit checklists, which have always lived per device.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, FileText, Sun, Sofa, MapPin, ClipboardCheck } from 'lucide-react';
import HomeMark from './HomeMark';
import MapThumb from './MapThumb';
import { createClient } from '@/lib/supabase/client';
import { readHistory, removeVisit, readChecklists } from '@/lib/profile/history';
import './profile.css';

function typeOf(r) {
  if (r.source === 'ai-report') {
    return r.kind === 'sun-shadow'
      ? { key: 'sun', label: 'Sun & shadow', Icon: Sun }
      : { key: 'full', label: 'Full report', Icon: FileText };
  }
  if (r.source === 'neighbourhood' || r.source === 'aslivastu') return { key: 'area', label: 'Area report', Icon: MapPin };
  if (r.source === 'furnishing') return { key: 'furnish', label: 'Furnishing', Icon: Sofa };
  return { key: 'full', label: 'Home comfort', Icon: FileText };
}

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const shortAddr = (a) => String(a || '').replace(/,\s*India\s*$/i, '').split(',').map((x) => x.trim()).filter(Boolean);
const COORDS = /^\s*-?\d{1,3}\.\d+(\s*,\s*-?\d{1,3}\.\d+)?\s*$/;
function nameFor(text) {
  const first = shortAddr(text)[0] || '';
  if (!first || COORDS.test(first)) return 'A pinned spot';
  return first === first.toLowerCase() ? first.replace(/\b\w/g, (c) => c.toUpperCase()) : first;
}
const spotKey = (lat, lon) => (Number.isFinite(+lat) && Number.isFinite(+lon) && lat !== null && lon !== null ? `${(+lat).toFixed(3)},${(+lon).toFixed(3)}` : null);
const tone = (s) => (s == null ? 'none' : s >= 70 ? 'good' : s >= 50 ? 'avg' : 'poor');
const toneWord = (s) => (s == null ? '' : s >= 80 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Average' : 'Weak');

function reportHref(v) {
  const q = new URLSearchParams({ lat: String(v.lat), lon: String(v.lon) });
  if (v.pinCode) q.set('pin_code', v.pinCode);
  if (v.address) q.set('address', v.address);
  if (v.floor) q.set('floor', String(v.floor));
  if (v.facing) q.set('facing', v.facing);
  if (v.pin) q.set('pin', '1');
  return `/report?${q.toString()}`;
}

// Saved reports -> homes: a folder is one home; otherwise every save at the
// same spot (or with the same name, when it has no coordinates) is one home.
function buildHomes(reports, folderName, history, checklists) {
  const map = new Map();
  for (const r of reports) {
    const key = r.folder_id && folderName[r.folder_id]
      ? `f:${r.folder_id}`
      : spotKey(r.lat, r.lon) ? `s:${spotKey(r.lat, r.lon)}` : `n:${nameFor(r.address || r.areaName || r.title).toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, folder: r.folder_id ? folderName[r.folder_id] : null, reports: [] });
    map.get(key).reports.push(r);
  }
  const homes = [...map.values()].map((h) => {
    const rs = h.reports;
    const lead = rs.find((r) => num(r.combined) != null) || rs.find((r) => num(r.unit) != null) || rs.find((r) => num(r.nqi) != null) || rs[0];
    const spot = rs.find((r) => r.lat && r.lon) || null;
    const seen = spot ? history.find((x) => spotKey(x.lat, x.lon) === spotKey(spot.lat, spot.lon)) : null;
    const lat = spot?.lat ?? seen?.lat, lon = spot?.lon ?? seen?.lon;
    const check = spot ? checklists.find((c) => spotKey(c.lat, c.lon) === spotKey(spot.lat, spot.lon)) : null;
    const name = nameFor(lead.address || lead.areaName || lead.title);
    const isArea = rs.every((r) => typeOf(r).key === 'area');
    return {
      ...h,
      name,
      label: h.folder && h.folder.toLowerCase() !== name.toLowerCase() ? h.folder : null,
      detail: isArea
        ? [lead.city, lead.pin && `PIN ${lead.pin}`].filter(Boolean).join(', ') || 'Area'
        : [lead.floor && `Floor ${lead.floor}`, lead.facing && `${lead.facing}-facing`].filter(Boolean).join(', ') || shortAddr(lead.address)[1] || '',
      score: num(lead.combined) ?? num(seen?.score) ?? num(lead.unit) ?? num(lead.nqi),
      lat, lon, check,
      when: Math.max(...rs.map((r) => Date.parse(r.created_at) || 0)),
      href: lat != null && lon != null
        ? reportHref({ lat, lon, address: lead.address || seen?.address, floor: lead.floor, facing: lead.facing, pinCode: lead.pin, pin: true })
        : `/my-reports/${lead.id}`,
    };
  });
  homes.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.when - a.when);
  return homes;
}

function ScoreRing({ score }) {
  if (score == null) return null;
  const C = 2 * Math.PI * 22;
  return (
    <span className={`pf-ring is-${tone(score)}`} aria-label={`Score ${score} out of 100, ${toneWord(score)}`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="22" className="pf-ring-bg" />
        <circle cx="26" cy="26" r="22" className="pf-ring-fg" strokeDasharray={`${(score / 100) * C} ${C}`} />
      </svg>
      <b>{score}</b>
    </span>
  );
}

export default function ProfileView({ profile, initialReports, folders, fetchFailed }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports || []);
  const [history, setHistory] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [delError, setDelError] = useState('');
  const [name, setName] = useState(profile.name || '');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name || '');
  const [nameState, setNameState] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setHistory(readHistory());
      setChecklists(readChecklists());
      const h = window.location.hash.replace('#', '');
      if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }), 60);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const folderName = useMemo(() => Object.fromEntries((folders || []).map((f) => [f.id, f.name])), [folders]);
  const homes = useMemo(() => buildHomes(reports, folderName, history, checklists), [reports, folderName, history, checklists]);
  const savedSpots = useMemo(() => new Set(reports.map((r) => spotKey(r.lat, r.lon)).filter(Boolean)), [reports]);
  // A home counts as saved if a saved report is at the same spot or has
  // the same name -- a pin moved a few metres shouldn't list it twice.
  const savedNames = useMemo(() => new Set(homes.map((h) => h.name.toLowerCase())), [homes]);
  const unsaved = history
    .filter((h) => !savedSpots.has(spotKey(h.lat, h.lon)) && !savedNames.has(nameFor(h.address).toLowerCase()))
    .slice(0, 8);

  const deleteReport = async (id) => {
    setDelError('');
    const prev = reports;
    setReports((list) => list.filter((r) => r.id !== id));
    setConfirmDel(null);
    try {
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
    setName(next); setNameState(''); setEditingName(false);
    router.refresh();
  };

  const signOut = async () => {
    setSigningOut(true);
    try { await createClient().auth.signOut(); } catch {}
    window.location.href = '/';
  };

  const displayName = name || (profile.email || '').split('@')[0];
  const firstName = displayName.split(' ')[0];

  return (
    <main className="pf">
      <div className="pf-wrap">
        <header className="pf-head">
          <HomeMark seed={profile.id || profile.email} size={48} className="pf-mark" title="Your BlindSpot mark" />
          <h1 className="pf-hello">
            {homes.length > 0 ? `${firstName}'s homes` : `Hi ${firstName}`}
          </h1>
          {homes.length > 0 && (
            <Link href="/#find" className="pf-new"><Plus size={18} strokeWidth={2.4} aria-hidden="true" /><span>Add a home</span></Link>
          )}
        </header>

        {/* ---------------- homes ---------------- */}
        <section id="saved" className="pf-homes-sec" aria-label="Your saved homes">
          {fetchFailed && <p className="pf-msg is-bad">Your saved homes didn&rsquo;t load. Refresh the page; if it keeps happening, sign out and back in.</p>}
          {delError && <p className="pf-msg is-bad" role="alert">{delError}</p>}

          {!fetchFailed && homes.length === 0 && (
            <div className="pf-empty">
              <div className="pf-empty-art" aria-hidden="true"><Plus size={28} strokeWidth={2} /></div>
              <h2>Save your first home</h2>
              <p>Look up a flat, set its floor and facing, then press <strong>Save report</strong>. It&rsquo;ll show up here with its score.</p>
              <Link href="/#find" className="pf-new is-big">Look up a flat</Link>
            </div>
          )}

          {homes.length > 0 && (
            <>
              <div className="pf-bar">
                <p>{homes.length} saved{homes.length > 1 ? ', best score first' : ''}</p>
                <button type="button" className="pf-edit" onClick={() => { setEditing((v) => !v); setConfirmDel(null); }} aria-pressed={editing}>
                  {editing ? 'Done' : 'Edit'}
                </button>
              </div>
              <ul className="pf-cards">
                {homes.map((h, i) => (
                  <li key={h.key} className={`pf-card${i === 0 && homes.length > 1 && h.score != null ? ' is-best' : ''}`}>
                    <Link href={h.href} className="pf-card-hit" aria-label={`Open ${h.name}`}>
                      <MapThumb lat={h.lat} lon={h.lon} />
                      <span className="pf-card-shade" />
                      {i === 0 && homes.length > 1 && h.score != null && <span className="pf-best-tag">Best so far</span>}
                      <ScoreRing score={h.score} />
                    </Link>
                    <div className="pf-card-body">
                      {h.label && <p className="pf-card-label">{h.label}</p>}
                      <h2 className="pf-card-name"><Link href={h.href}>{h.name}</Link></h2>
                      {h.detail && <p className="pf-card-detail">{h.detail}</p>}
                      <div className="pf-docs">
                        {h.reports.map((r) => {
                          const t = typeOf(r);
                          if (editing && confirmDel === r.id) {
                            return (
                              <span key={r.id} className="pf-doc is-confirm">
                                Delete?
                                <button type="button" onClick={() => deleteReport(r.id)} className="pf-doc-yes">Yes</button>
                                <button type="button" onClick={() => setConfirmDel(null)} className="pf-doc-no">No</button>
                              </span>
                            );
                          }
                          return editing ? (
                            <button key={r.id} type="button" className={`pf-doc is-${t.key} is-del`} onClick={() => setConfirmDel(r.id)} aria-label={`Delete ${t.label}`}>
                              <t.Icon size={14} strokeWidth={2.2} aria-hidden="true" />{t.label}<X size={14} strokeWidth={2.6} aria-hidden="true" />
                            </button>
                          ) : (
                            <Link key={r.id} href={`/my-reports/${r.id}`} className={`pf-doc is-${t.key}`}>
                              <t.Icon size={14} strokeWidth={2.2} aria-hidden="true" />{t.label}
                            </Link>
                          );
                        })}
                        {!editing && h.check && (
                          <Link href={`${h.href}#the-visit`} className="pf-doc is-check">
                            <ClipboardCheck size={14} strokeWidth={2.2} aria-hidden="true" />{h.check.ticked.length} checked
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ---------------- looked at, not saved ---------------- */}
        {unsaved.length > 0 && (
          <section id="recent" className="pf-recent" aria-labelledby="pf-recent-h">
            <h2 id="pf-recent-h">Looked at, not saved</h2>
            <ul className="pf-strip">
              {unsaved.map((h) => (
                <li key={`${h.lat},${h.lon}`} className="pf-mini">
                  <Link href={reportHref(h)} className="pf-mini-hit">
                    <MapThumb lat={h.lat} lon={h.lon} className="is-mini" />
                    <span className="pf-mini-text">
                      <strong>{nameFor(h.address)}</strong>
                      {num(h.score) != null && <span className={`pf-mini-score is-${tone(num(h.score))}`}>{num(h.score)}</span>}
                    </span>
                  </Link>
                  <button type="button" className="pf-mini-x" onClick={() => { removeVisit(h.lat, h.lon); setHistory(readHistory()); }} aria-label={`Remove ${nameFor(h.address)}`}><X size={14} strokeWidth={2.4} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------------- account ---------------- */}
        <footer id="account" className="pf-foot">
          {editingName ? (
            <form className="pf-name-edit" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
              <button type="submit" disabled={nameState === 'saving'}>{nameState === 'saving' ? 'Saving…' : 'Save'}</button>
              <button type="button" className="is-quiet" onClick={() => { setEditingName(false); setNameDraft(name); setNameState(''); }}>Cancel</button>
            </form>
          ) : (
            <p className="pf-foot-who">
              Signed in as <strong>{profile.email}</strong>{profile.provider === 'google' ? ' with Google' : ''}
            </p>
          )}
          {nameState === 'error' && <p className="pf-msg is-bad">Couldn&rsquo;t save your name. Try again.</p>}
          <div className="pf-foot-actions">
            {!editingName && <button type="button" onClick={() => { setNameDraft(name); setEditingName(true); }}>{name ? 'Change name' : 'Add your name'}</button>}
            <button type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
          <p className="pf-credit">Satellite imagery: Esri</p>
        </footer>
      </div>
    </main>
  );
}
