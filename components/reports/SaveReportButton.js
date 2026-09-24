'use client';
// components/reports/SaveReportButton.js
//
// One button, reused by all three savable report types (neighbourhood,
// ai-report, furnishing). Click it -> a small panel drops down asking
// which folder to save into (existing folders in a dropdown, or type a
// new name -- e.g. a flat/house number) -- and a title for this report.
// Submits to POST /api/reports.
//
// The panel is a fixed-width (280px) absolute box anchored to its own
// trigger's right edge -- fine on a full-width page (the other two call
// sites), broken on the sun & shadow "report ready" screen: that button
// sits inside a `flex:1` wrapper (ReportModal.js passes `style={{flex:1,
// display:'flex'}}`) next to a Close button, inside a ~330px-wide corner
// card. right:0 there anchors the panel to a point maybe 200px from the
// card's own left edge, so a 280px panel opening leftward from it runs
// straight off the card (and the button sits near the card's bottom, so
// the panel's own height ran off the bottom too) -- exactly what the
// screenshot showed. Under 480px the panel drops the trigger-relative
// anchor entirely and becomes a small fixed, centred sheet instead
// (.srb-panel / .srb-backdrop below), so it no longer matters how wide
// or how narrow the thing that opened it is.
//
// If the person isn't signed in yet, clicking Save opens the popup
// sign-in flow (lib/auth/popupSignIn.js) instead of losing whatever
// report they're looking at -- same fix as the header's Sign in link.
//
// `source` is one of 'neighbourhood' | 'ai-report' | 'furnishing'.
// `data` is the JSON blob to store -- shaped however that report type
// wants (see the three call sites). `defaultTitle` pre-fills the title
// field (e.g. an address or pin code) but stays editable.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { openSignInPopup } from '@/lib/auth/popupSignIn';

// Folders are fetched once per tab and shared by every Save button, and
// fetched as soon as we know someone is signed in -- not when the panel
// opens -- so the dropdown is ready the moment it appears.
let folderCache = null; // Promise<{ folders, failed }>
function loadFoldersOnce(force = false) {
  if (folderCache && !force) return folderCache;
  const supabase = createClient();
  folderCache = (typeof supabase.from === 'function'
    ? supabase.from('folders').select('id, name').order('name', { ascending: true })
        .then(({ data, error }) => ({ folders: error ? [] : (data || []), failed: !!error }))
    : fetch('/api/folders').then((r) => r.json()).then((d) => ({ folders: d.folders || [], failed: false }))
  ).catch(() => ({ folders: [], failed: true }));
  return folderCache;
}
const LAST_FOLDER_KEY = 'bs-last-folder';

export default function SaveReportButton({ source, data, defaultTitle = '', style, dark = false }) {
  const [open, setOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  // An empty dropdown reads as "you have no folders". When the fetch failed
  // it means the opposite -- we don't know what folders you have -- and
  // saving would quietly file the report loose.
  const [foldersFailed, setFoldersFailed] = useState(false);
  const [folderChoice, setFolderChoice] = useState(''); // existing folder id, or '' (none), or '__new'
  const [newFolderName, setNewFolderName] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  const titleTouched = useRef(false);
  // The report this button saves often doesn't exist yet when the button
  // mounts -- the modal renders it, then fills in the address a minute
  // later. Without this the title box stayed empty for exactly the reports
  // that most needed a name.
  useEffect(() => {
    if (!titleTouched.current && defaultTitle) setTitle(defaultTitle);
  }, [defaultTitle]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const panelRef = useRef(null);
  const sheetRef = useRef(null);

  // getSession() reads the stored session -- no network call -- so the
  // button is usable immediately. The database still checks the token on
  // save (row-level security), so nothing is trusted on this alone.
  useEffect(() => {
    let live = true;
    createClient().auth.getSession().then(({ data }) => {
      if (!live) return;
      const on = !!data?.session;
      setSignedIn(on);
      setCheckingAuth(false);
      if (on) loadFoldersOnce();
    }).catch(() => live && setCheckingAuth(false));
    return () => { live = false; };
  }, []);

  // Close the panel on an outside click, same pattern as other dropdowns
  // in this codebase (e.g. the mobile nav panel).
  useEffect(() => {
    if (!open) return;
    // stopPropagation: Escape closes this sheet only, not the report card
    // underneath (ReportModal listens on window).
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const loadFolders = async (force = false) => {
    setLoadingFolders(!folderCache || force);
    const { folders: list, failed } = await loadFoldersOnce(force);
    setFolders(list);
    setFoldersFailed(failed);
    setLoadingFolders(false);
    // Default to the folder used last time, if it still exists -- most
    // people save several reports about the same flat in a row.
    try {
      const last = window.localStorage.getItem(LAST_FOLDER_KEY);
      if (last && list.some((f) => f.id === last)) setFolderChoice((c) => c || last);
    } catch {}
  };

  const signIn = async () => {
    setSigningIn(true);
    try {
      const supabase = createClient();
      const { access_token, refresh_token } = await openSignInPopup();
      await supabase.auth.setSession({ access_token, refresh_token });
      setSignedIn(true);
      loadFoldersOnce(true);
      return true;
    } catch (e) {
      // Swallowing this made the button do nothing at all, forever, with no
      // message: popups are blocked by default in several browsers and by
      // most corporate policies, so "click Save, watch nothing happen" was
      // a whole category of user hitting a dead end in silence.
      setError(
        String(e?.message || '') === 'popup-blocked'
          ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and press Save again - or open the report and use your browser’s Save as PDF instead.'
          : 'Sign-in didn’t complete, so there’s nothing to save this to yet. Press Save to try again.'
      );
      setOpen(true); // show the panel so the message has somewhere to appear
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const handleOpen = async () => {
    setError('');
    setSaved(false);
    if (!signedIn) {
      const ok = await signIn();
      if (!ok) return;
    }
    setOpen(true);
    loadFolders();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const folderName = folderChoice === '__new'
      ? newFolderName.trim()
      : (folders.find(f => f.id === folderChoice)?.name || '');

    try {
      const supabase = createClient();
      const direct = typeof supabase.from === 'function';
      if (direct) {
        // Straight to the database (row-level security limits it to this
        // user's own rows). Going through /api/reports uploaded the whole
        // report twice -- browser to server, server to database -- and a
        // sun & shadow report with its twelve images ran into the 4.5 MB
        // limit on that first hop.
        const { data: sess } = await supabase.auth.getSession();
        const user = sess?.session?.user;
        if (!user) throw new Error('not-signed-in');

        let folder_id = folderChoice && folderChoice !== '__new' ? folderChoice : null;
        if (folderChoice === '__new' && folderName) {
          const hit = folders.find((f) => f.name.toLowerCase() === folderName.toLowerCase());
          if (hit) folder_id = hit.id;
          else {
            const { data: made, error: fErr } = await supabase.from('folders')
              .insert({ user_id: user.id, name: folderName }).select('id, name').single();
            if (made) {
              folder_id = made.id;
              folderCache = Promise.resolve({ folders: [...folders, made].sort((a, b) => a.name.localeCompare(b.name)), failed: false });
            } else if (fErr) {
              // Most likely the same name was just made in another tab.
              const { data: again } = await supabase.from('folders').select('id').eq('name', folderName).maybeSingle();
              folder_id = again?.id ?? null;
            }
          }
        }
        // A few hundred bytes the profile page lists from, so it never has
        // to read the whole report (see SUPABASE_SETUP.md section 6).
        const d = data || {};
        const summary = Object.fromEntries(Object.entries({
          address: d.address, kind: d.kind, combined: d.combinedScore, unit: d.unitScore,
          floor: d.floor, facing: d.facing, lat: d.lat, lon: d.lon,
          nqi: d.nqi_composite, pin: d.pin_code, areaName: d.name, city: d.city,
        }).filter(([, v]) => v != null && v !== ''));
        const row = { user_id: user.id, folder_id, source, title: title.trim() || null, data };
        let { error: rErr } = await supabase.from('reports').insert({ ...row, summary });
        // Project without the `summary` column yet: save without it.
        if (rErr && /summary/i.test(rErr.message || '')) ({ error: rErr } = await supabase.from('reports').insert(row));
        if (rErr) throw new Error(/jwt|auth/i.test(rErr.message || '') ? 'not-signed-in' : (rErr.message || 'save-failed'));
        try {
          if (folder_id) window.localStorage.setItem(LAST_FOLDER_KEY, folder_id);
          else window.localStorage.removeItem(LAST_FOLDER_KEY);
        } catch {}
      } else {
        const payload = JSON.stringify({ source, data, title: title.trim() || undefined, folderName: folderName || undefined });
        if (payload.length > 3_800_000) throw new Error('too-large');
        const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `save-failed-${res.status}`);
        }
      }
      setSaved(true);
      setTimeout(() => setOpen(false), 1600);
    } catch (e) {
      const m = String(e?.message || '');
      if (m === 'not-signed-in') setSignedIn(false); // the panel then offers a way back in
      setError(
        m === 'not-signed-in'
          ? 'Your sign-in has expired. Sign in again below, then press Save.'
          : m === 'too-large'
            ? 'This report is too big to save with all its images. Open it and use your browser\u2019s Save as PDF instead.'
            : m.startsWith('save-failed-401') || m === 'save-failed'
              ? 'Your sign-in seems to have expired. Sign in again and retry.'
              : `Couldn\u2019t save that report (${m || 'unknown error'}), please try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  const btnBase = {
    fontSize: 12.5, fontWeight: 600, borderRadius: 3, padding: '9px 18px', cursor: 'pointer',
    justifyContent: 'center',
    border: dark ? '1px solid rgba(255,253,248,0.35)' : '1px solid var(--line)',
    color: dark ? '#FFFDF8' : 'var(--text-mute)',
    background: 'transparent',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }} ref={panelRef}>
      <button onClick={handleOpen} disabled={checkingAuth || signingIn} style={{ ...btnBase, flex: style?.flex ? 1 : undefined }}>
        {signingIn ? 'Signing in…' : 'Save report'}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
        {/* Mobile-only backdrop -- invisible and non-interactive on a wide
            screen (display:none is the base rule; the media query below
            turns it on), a plain tap-to-close scrim once the panel becomes
            a centred sheet. */}
        <div className="srb-backdrop" onClick={() => setOpen(false)} />
        <div
          className="srb-panel"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Save this report"
        >
          <div className="srb-head">
            <strong>Save to your profile</strong>
            <button type="button" className="srb-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          {saved ? (
            <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center' }}>
              <svg className="cta-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved to your profile.&nbsp;<a href="/profile#saved" style={{ color: 'inherit', textDecoration: 'underline' }}>View</a>
            </p>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8A8A8A', marginBottom: 6 }}>Title</label>
              <input
                value={title}
                onChange={(e) => { titleTouched.current = true; setTitle(e.target.value); }}
                placeholder="e.g. an address or PIN"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid rgba(26,10,0,0.15)', borderRadius: 4, marginBottom: 12 }}
              />

              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8A8A8A', marginBottom: 6 }}>
                Folder <span style={{ textTransform: 'none', letterSpacing: 0 }}>(e.g. flat or house number)</span>
              </label>
              {loadingFolders ? (
                <p style={{ fontSize: 12.5, color: '#8A8A8A', margin: '0 0 12px' }}>Loading your folders…</p>
              ) : (
                <>
                  <select
                    value={folderChoice}
                    onChange={(e) => setFolderChoice(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid rgba(26,10,0,0.15)', borderRadius: 4, marginBottom: 8, background: '#fff' }}
                  >
                    <option value="">No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                    <option value="__new">+ New folder…</option>
                  </select>
                  {foldersFailed && (
                    <p style={{ fontSize: 11.5, color: '#8A8A8A', margin: '0 0 8px', lineHeight: 1.5 }}>
                      We couldn&apos;t load your folders just now, so only a new one can be made here.
                      Saving without a folder still works - you can find it on your profile.
                    </p>
                  )}
                  {folderChoice === '__new' && (
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="e.g. Flat 402"
                      autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid rgba(26,10,0,0.15)', borderRadius: 4, marginBottom: 12 }}
                    />
                  )}
                </>
              )}

              {error && <p style={{ fontSize: 12, color: '#e5484d', margin: '0 0 10px', lineHeight: 1.55 }}>{error}</p>}

              {!signedIn && (
                <button
                  onClick={signIn}
                  disabled={signingIn}
                  style={{
                    width: '100%', padding: '10px', fontSize: 13, fontWeight: 700, border: '1px solid #1A0A00',
                    borderRadius: 4, background: 'transparent', color: '#1A0A00', cursor: 'pointer', marginBottom: 8,
                  }}
                >
                  {signingIn ? 'Signing in…' : 'Sign in'}
                </button>
              )}

              <button
                onClick={handleSave}
                className="srb-save-btn"
                title={!signedIn ? 'Sign in first - saved reports live in your account.' : undefined}
                disabled={saving || !signedIn || (folderChoice === '__new' && !newFolderName.trim())}
                style={{
                  width: '100%', padding: '10px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 4,
                  background: '#1A0A00', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                  textTransform: 'uppercase', letterSpacing: '.03em',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
        </>,
        document.body
      )}

      <style>{`
        /* Same press-then-settle idiom used across the site's other CTAs
           (see .btn-cta in globals.css) -- instant snap on press, a
           bounce-eased settle on release. */
        .srb-save-btn{ transition:transform .3s cubic-bezier(.34,1.56,.64,1); }
        .srb-save-btn:active:not(:disabled){ transform:scale(.97); transition:transform .05s ease; }

        @keyframes ctaCheckPop{
          0%{ transform:scale(0); opacity:0 }
          60%{ transform:scale(1.15); opacity:1 }
          100%{ transform:scale(1); opacity:1 }
        }
        .cta-check{
          display:inline-block; width:15px; height:15px; margin-right:6px;
          animation:ctaCheckPop .38s cubic-bezier(.34,1.56,.64,1) both;
        }
        @media (prefers-reduced-motion:reduce){
          .srb-save-btn, .srb-save-btn:active{ transition:none; }
          .cta-check{ animation:none; }
        }

        /* Always a centred sheet over everything, portalled to <body>.
           Opening it inside the report-ready corner card (overflow:auto,
           max-height 70vh) clipped it, and as a box anchored to the
           button it ran off narrow cards. */
        .srb-backdrop{ position:fixed; inset:0; background:rgba(10,5,0,0.38); z-index:1200; animation:srbFade .15s ease-out }
        .srb-panel{
          position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:1201;
          width:calc(100vw - 32px); max-width:360px; max-height:calc(100vh - 32px); overflow-y:auto;
          background:#FFFBF5; color:var(--ink, #1A0A00); border-radius:14px; padding:16px 18px 18px;
          border:1px solid var(--line-soft, rgba(26,10,0,0.12)); box-shadow:0 24px 60px rgba(0,0,0,0.28);
          font-family:inherit; animation:srbPop .18s ease-out;
        }
        .srb-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px }
        .srb-head strong{ font-size:15px }
        .srb-x{ width:28px; height:28px; border-radius:50%; border:0; background:rgba(26,10,0,0.06); cursor:pointer; font-size:17px; line-height:1; color:#5A5140 }
        .srb-x:hover{ background:rgba(26,10,0,0.12) }
        @keyframes srbFade{ from{opacity:0} to{opacity:1} }
        @keyframes srbPop{ from{opacity:0; transform:translate(-50%,-46%)} to{opacity:1; transform:translate(-50%,-50%)} }
        @media (prefers-reduced-motion:reduce){ .srb-backdrop, .srb-panel{ animation:none } }
      `}</style>
    </div>
  );
}
