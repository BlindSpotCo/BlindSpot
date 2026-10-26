// lib/auth/pendingSave.js
//
// Holds a report someone pressed "Save" on while signed out, across the
// full-page trip to Google (or to the sign-up page) and back.
//
// Why: sign-in used to open /login in a popup so the report on screen
// survived. On phones a popup is a new tab, and Google's sign-in page cuts
// the link back to the opener, so the original tab gave up, jumped to
// /login itself, and the person was left with two tabs, one of them
// pointless. Sign-in now happens in the same tab; this is what keeps the
// report from being lost on the way.
//
// IndexedDB rather than sessionStorage: a combined report with its images
// is a few MB, past sessionStorage's limit, and IndexedDB is shared by
// every tab on the origin, so it also works when the confirmation link of
// a new account opens in a different tab.

const DB = 'blindspot';
const STORE = 'pending';
const KEY = 'save';
// Long enough for a sign-up with an email confirmation, short enough that
// a report nobody came back for doesn't get saved days later out of nowhere.
export const PENDING_TTL_MS = 60 * 60 * 1000;

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexeddb-open-failed'));
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out?.result);
      tx.onerror = () => reject(tx.error || new Error('indexeddb-failed'));
      tx.onabort = () => reject(tx.error || new Error('indexeddb-aborted'));
    });
  } finally {
    db.close();
  }
}

// { source, data, title } -- what SaveReportButton would have inserted.
export async function stashPendingSave(pending) {
  await run('readwrite', (s) => s.put({ ...pending, at: Date.now() }, KEY));
}

export async function readPendingSave() {
  try {
    const p = await run('readonly', (s) => s.get(KEY));
    if (!p) return null;
    if (!p.at || Date.now() - p.at > PENDING_TTL_MS) { await clearPendingSave(); return null; }
    return p;
  } catch {
    return null;
  }
}

export async function clearPendingSave() {
  try { await run('readwrite', (s) => s.delete(KEY)); } catch {}
}
