'use client';
// components/reports/SaveReportButton.js
//
// One button, reused by all three savable report types (neighbourhood,
// ai-report, furnishing). Click it -> a small panel drops down asking
// which folder to save into (existing folders in a dropdown, or type a
// new name -- e.g. a flat/house number) -- and a title for this report.
// Submits to POST /api/reports.
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
import { createClient } from '@/lib/supabase/client';
import { openSignInPopup } from '@/lib/auth/popupSignIn';

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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(!!user);
      setCheckingAuth(false);
    });
  }, []);

  // Close the panel on an outside click, same pattern as other dropdowns
  // in this codebase (e.g. the mobile nav panel).
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    setFoldersFailed(false);
    try {
      const res = await fetch('/api/folders');
      const d = await res.json();
      setFolders(d.folders || []);
      setFoldersFailed(false);
    } catch {
      setFolders([]);
      setFoldersFailed(true);
    } finally {
      setLoadingFolders(false);
    }
  };

  const signIn = async () => {
    setSigningIn(true);
    try {
      const supabase = createClient();
      const { access_token, refresh_token } = await openSignInPopup();
      await supabase.auth.setSession({ access_token, refresh_token });
      setSignedIn(true);
      return true;
    } catch (e) {
      // Swallowing this made the button do nothing at all, forever, with no
      // message: popups are blocked by default in several browsers and by
      // most corporate policies, so "click Save, watch nothing happen" was
      // a whole category of user hitting a dead end in silence.
      setError(
        String(e?.message || '') === 'popup-blocked'
          ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and press Save again — or open the report and use your browser’s Save as PDF instead.'
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
      const payload = JSON.stringify({ source, data, title: title.trim() || undefined, folderName: folderName || undefined });

      // A sun & shadow report carries twelve JPEGs inline. Past roughly
      // four megabytes the platform rejects the request before it ever
      // reaches us, and the person saw a bare "save-failed-413" for a
      // report that was perfectly fine. Catch it here and say what it is.
      if (payload.length > 3_800_000) {
        throw new Error('too-large');
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `save-failed-${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setOpen(false), 1200);
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

      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 20,
            width: 280, background: '#FFFBF5', color: 'var(--ink, #1A0A00)',
            border: '1px solid var(--line-soft, rgba(26,10,0,0.15))', borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)', padding: 16,
          }}
        >
          {saved ? (
            <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, margin: 0 }}>Saved to My Reports.</p>
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
                      Saving without a folder still works — you can file it later from My Reports.
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
                title={!signedIn ? 'Sign in first — saved reports live in your account.' : undefined}
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
      )}
    </div>
  );
}
