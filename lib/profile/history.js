// lib/profile/history.js
// "Homes you've looked at" -- kept in this browser (localStorage), not in
// the account: it's written on every report view, signed in or not, and a
// visit isn't something anyone asked to have stored on a server. The
// profile page reads it back and says plainly that it's this device only.

const KEY = 'bs-history';
const MAX = 24;

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch {}
}

const spot = (lat, lon) => `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;

// One entry per spot: viewing the same flat again moves it to the top and
// refreshes its numbers instead of adding a duplicate.
export function recordVisit(entry) {
  if (typeof window === 'undefined' || !Number.isFinite(entry?.lat) || !Number.isFinite(entry?.lon)) return;
  const key = spot(entry.lat, entry.lon);
  const rest = read().filter((e) => spot(e.lat, e.lon) !== key);
  write([{ ...entry, ts: Date.now() }, ...rest]);
}

export function readHistory() {
  if (typeof window === 'undefined') return [];
  return read();
}

export function removeVisit(lat, lon) {
  const key = spot(lat, lon);
  write(read().filter((e) => spot(e.lat, e.lon) !== key));
}

export function clearHistory() {
  try { window.localStorage.removeItem(KEY); } catch {}
}

// The site-visit checklists ReportScreen keeps per address
// (`bs-checklist:<lat>,<lon>`), summarised for the profile page.
export function readChecklists() {
  if (typeof window === 'undefined') return [];
  const out = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith('bs-checklist:')) continue;
      const [lat, lon] = k.slice('bs-checklist:'.length).split(',').map(Number);
      let parsed = null;
      try { parsed = JSON.parse(window.localStorage.getItem(k)); } catch {}
      const ticked = Array.isArray(parsed) ? parsed : (parsed?.ticked || []);
      const notes = Array.isArray(parsed) ? {} : (parsed?.notes || {});
      const noteList = Object.entries(notes).filter(([, v]) => String(v || '').trim());
      if (!ticked.length && !noteList.length) continue;
      out.push({ lat, lon, ticked, notes: noteList });
    }
  } catch {}
  return out;
}
