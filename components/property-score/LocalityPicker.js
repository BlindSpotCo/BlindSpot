'use client';
// components/property-score/LocalityPicker.js
// Mode A of the Property Score tab: city -> locality (searchable by name),
// showing AsliVastu's full area card. Calls onAreaSelected(areaRecord, city)
// once a locality is picked, so the parent can hand lat/lon off to the
// SunScout step.

import { useState, useEffect, useMemo } from 'react';
import { GradeBadge } from '@/lib/property-score/ui';
import AVAreaCard from './AVAreaCard';

// Each row's identity is pin_code + sector (several sectors share one
// pincode/score now that Chandigarh rows are sector-first, so pin_code
// alone is no longer unique).
const rowKey = (r) => `${r.pin_code}::${r.sectorNum ?? r.name}`;

// ── Typo-tolerant name search ────────────────────────────────────────────
// Plain substring matching meant a real, present area could be
// unfindable by name over one wrong letter -- "Ville Parle" (a common
// misspelling/mishearing of "Vile Parle") matched nothing, even though
// Vile Parle West/East are both in the data, because pincode search
// still worked. "Every area available by name" means the common way
// someone actually types a name has to work, not just the one exact
// spelling in our records.
//
// Two additions over plain .includes(): (1) word-level matching, so
// "parle" or "kurla complex" finds a multi-word name/alias without
// needing the whole phrase typed in order; (2) a 1-edit tolerance
// (single insertion/deletion/substitution) per word of 4+ letters, so
// one dropped, doubled, or swapped letter doesn't return zero results.
function editDistanceLE1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, mismatches = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++mismatches > 1) return false;
    if (la === lb) { i++; j++; }        // substitution
    else if (la > lb) { i++; }          // extra letter in a (e.g. "ville" -> "vile")
    else { j++; }                       // missing letter in a
  }
  if (i < la || j < lb) mismatches++;
  return mismatches <= 1;
}
function wordMatches(queryWord, targetWord) {
  if (targetWord.includes(queryWord)) return true;
  if (queryWord.length >= 4 && targetWord.length >= 4) return editDistanceLE1(queryWord, targetWord);
  return false;
}
const tokenize = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function nameSearchMatches(query, fields) {
  const qWords = tokenize(query);
  if (qWords.length === 0) return false;
  const targetWords = fields.filter(Boolean).flatMap(tokenize);
  // Whole-query fallback (no spaces removed) catches run-together typing
  // like "vileparle" that word-splitting alone would miss.
  const joined = fields.filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
  const queryJoined = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (queryJoined && joined.includes(queryJoined)) return true;
  return qWords.every(qw => targetWords.some(tw => wordMatches(qw, tw)));
}

export default function LocalityPicker({ onAreaSelected, selectedPinCode }) {
  const [citiesData, setCitiesData] = useState(null);
  const [citiesError, setCitiesError] = useState('');
  const [city, setCity] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => setCitiesData(data.cities))
      .catch(() => setCitiesError('Could not load locality data right now.'));
  }, []);

  const selectedAreaRecord = city && citiesData
    ? (citiesData[city].find(r => rowKey(r) === selectedKey)
       || citiesData[city].find(r => r.pin_code === selectedPinCode))
    : null;

  const filteredLocalities = useMemo(() => {
    if (!city || !citiesData) return [];
    const list = citiesData[city];
    if (!search.trim()) return list;
    const s = search.toLowerCase().trim();
    // "sector 40", "sec-40", "40" -> 40
    const sectorDigits = s.replace(/^sec(tor)?\.?\s*-?\s*/, '');
    const wantsSector = /^\d{1,2}$/.test(sectorDigits);
    const sectorQuery = wantsSector ? Number(sectorDigits) : null;

    const matched = list.filter(r => {
      // Exact sector match first -- typing "22" or "Sector 22" should hit
      // ONLY that sector's own row, not its pincode-siblings (Sector 22's
      // pincode also covers 21/34/35, but searching "22" means Sector 22).
      if (sectorQuery != null && r.sectorNum === sectorQuery) return true;
      if (r.pin_code.includes(s)) return true;
      // Name, area/ward, and landmarks ("PEC", "Panjab University",
      // "Elante", "GPO"...) all go through the typo-tolerant matcher —
      // exact substrings still match (fast path, same as before), plus
      // near-misses like "Ville Parle" for "Vile Parle".
      if (nameSearchMatches(search, [r.name, r.area, ...(r.aliases || [])])) return true;
      return false;
    });

    // Exact sector hits float to the top so "22" doesn't bury Sector 22
    // under substring noise like Sector 2, 12, 21, 24...29.
    if (sectorQuery != null) {
      matched.sort((a, b) => {
        const ae = a.sectorNum === sectorQuery ? 0 : 1;
        const be = b.sectorNum === sectorQuery ? 0 : 1;
        return ae - be;
      });
    }
    return matched;
  }, [city, citiesData, search]);

  const pick = (record) => {
    setSearch(record.name);
    setSelectedKey(rowKey(record));
    onAreaSelected(record, city);
  };

  return (
    <>
      {/* CITY */}
      <div style={{ marginBottom: 36 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--slate)', letterSpacing: '.12em', marginBottom: 12 }}>CITY</div>
        {citiesError && <div style={{ color: '#f87171', fontSize: 13.5 }}>{citiesError}</div>}
        {!citiesData && !citiesError && <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading…</div>}
        {citiesData && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.keys(citiesData).map(c => (
              <button key={c} onClick={() => { setCity(c); setSearch(''); }} className="ps-btn"
                style={{
                  background: city === c ? 'var(--slate)' : 'transparent', color: city === c ? '#fff' : 'var(--text)',
                  border: `1px solid ${city === c ? 'var(--slate)' : 'var(--line)'}`, borderRadius: 'var(--radius)',
                  padding: '10px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                }}>
                {c} <span className="mono" style={{ fontSize: 11.5, opacity: .7 }}>({citiesData[c].length})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LOCALITY, SEARCHABLE BY NAME */}
      {city && citiesData && (
        <div style={{ marginBottom: 36 }}>
          <div className="mono" style={{ fontSize: 12, color: 'var(--slate)', letterSpacing: '.12em', marginBottom: 12 }}>LOCALITY</div>
          <input
            type="text" placeholder={
              // Chandigarh has no named localities to speak of -- people
              // navigate by sector number or pincode -- so prompting them
              // with "Koramangala, Whitefield" would be actively unhelpful.
              city === 'Chandigarh'
                ? 'Search by sector or PIN — "Sector 40", "40", "160036", "PEC"…'
                : 'Search by area name or PIN — Koramangala, Whitefield, Vasant Kunj…'
            }
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            {/* Was capped at the first 30 (by score, since that's the
                default sort) -- harmless with ~20-30 localities per city,
                but with Mumbai's 96 it silently hid two-thirds of the
                city unless you already knew the exact name to search for
                (Vile Parle ranks 58th/66th by score -- invisible while
                just browsing). The list is already a scrollable box, so
                there's no real reason to truncate it at all. */}
            {filteredLocalities.map(r => (
              <button key={rowKey(r)} onClick={() => pick(r)} className="ps-row-btn"
                style={{
                  // Was a hardcoded rgba(175,47,64) -- an off-brand hot pink
                  // with no relation to any design token. A tint of --slate
                  // matches every other selection/accent state on the site.
                  textAlign: 'left', background: selectedKey === rowKey(r) ? 'color-mix(in srgb, var(--slate) 14%, var(--paper))' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--line-soft)', padding: '11px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{r.area ? `${r.area} · ` : ''}{r.pin_code}</div>
                  {/* Landmarks here are genuinely new info (not a restated
                      title) since the title is now just the sector number. */}
                  {(r.aliases || []).length > 0 && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                      near {r.aliases.slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--slate)' }}>{r.nqi_composite}</span>
                  <GradeBadge grade={r.grade} color="var(--slate)" />
                </div>
              </button>
            ))}
            {filteredLocalities.length === 0 && (
              <div style={{ padding: 16, fontSize: 13.5, color: 'var(--text-dim)' }}>No localities match &ldquo;{search}&rdquo;.</div>
            )}
          </div>
        </div>
      )}

      {selectedAreaRecord && (
        <AVAreaCard record={selectedAreaRecord} city={city} citiesData={citiesData} />
      )}
    </>
  );
}
