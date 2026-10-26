// lib/reports/insertReport.js
//
// The one place a report row is written straight to Supabase from the
// browser (row-level security limits it to the signed-in user's own rows).
// Shared by SaveReportButton and PendingSaveResume, so a report saved after
// a Google sign-in round trip lands exactly like one saved in place.

// A few hundred bytes the profile page lists from, so it never has to read
// the whole report (see SUPABASE_SETUP.md section 6).
export function summaryOf(data) {
  const d = data || {};
  return Object.fromEntries(Object.entries({
    address: d.address, kind: d.kind, combined: d.combinedScore, unit: d.unitScore,
    floor: d.floor, facing: d.facing, lat: d.lat, lon: d.lon,
    nqi: d.nqi_composite, pin: d.pin_code, areaName: d.name, city: d.city,
  }).filter(([, v]) => v != null && v !== ''));
}

// Throws Error('not-signed-in') when the session is gone, or the database's
// own message otherwise.
export async function insertReport(supabase, { userId, source, data, title, folderId = null }) {
  const row = { user_id: userId, folder_id: folderId, source, title: (title || '').trim() || null, data };
  let { error } = await supabase.from('reports').insert({ ...row, summary: summaryOf(data) });
  // Project without the `summary` column yet: save without it.
  if (error && /summary/i.test(error.message || '')) ({ error } = await supabase.from('reports').insert(row));
  if (error) throw new Error(/jwt|auth/i.test(error.message || '') ? 'not-signed-in' : (error.message || 'save-failed'));
}
