'use client';
// components/auth/PendingSaveResume.js
//
// Finishes a "Save report" that had to leave the page to sign in (Google,
// or creating an account -- see components/auth/SignInSheet.js). Mounted
// once in the root layout, so it runs wherever the person lands after
// signing in. Does nothing at all unless a report is actually waiting.

import { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { readPendingSave, clearPendingSave } from '@/lib/auth/pendingSave';
import { insertReport } from '@/lib/reports/insertReport';

export default function PendingSaveResume() {
  const [toast, setToast] = useState(null); // { ok, text }

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let live = true;
    let unsub = () => {};
    let running = false;

    const attempt = async (session) => {
      if (!session?.user || running) return;
      running = true;
      const pending = await readPendingSave();
      if (!pending || !live) { running = false; return; }
      // Cleared before the insert, not after: a slow insert plus a second
      // tab finishing at the same moment must not save the report twice.
      await clearPendingSave();
      try {
        await insertReport(createClient(), {
          userId: session.user.id, source: pending.source, data: pending.data, title: pending.title,
        });
        if (live) setToast({ ok: true, text: `Saved${pending.title ? ` "${pending.title}"` : ' your report'} to your profile.` });
      } catch {
        if (live) setToast({ ok: false, text: 'You’re signed in, but the report you were saving didn’t go through. Open it again and press Save.' });
      } finally {
        running = false;
      }
    };

    (async () => {
      // Cheap check first: nothing waiting means no auth calls at all.
      const pending = await readPendingSave();
      if (!pending || !live) return;
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session) { attempt(data.session); return; }
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') attempt(session);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => { live = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.ok ? 7000 : 12000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`psr-toast${toast.ok ? '' : ' is-bad'}`} role="status">
      <span>{toast.text}</span>
      {toast.ok && <a href="/profile#saved">View</a>}
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
    </div>
  );
}
