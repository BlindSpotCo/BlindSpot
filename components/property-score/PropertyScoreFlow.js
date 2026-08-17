'use client';
// components/property-score/PropertyScoreFlow.js
// The Property Score tab's flow. Opens as a 3-screen scroll-snap sequence
// -- threshold ("here's what's about to happen") -> persona dial (Pick
// your angle) -> entry mode (pick locality vs address). The two picker
// screens are filled to the viewport so scrolling feels like a deliberate
// sequence rather than past empty space; the threshold screen is sized to
// its own content instead, so the persona screen peeks in below it and
// arriving doesn't read as another full-height wall. Everything after
// that (the actual locality/address picker, then the unit sun/shadow panel +
// verdict) is genuinely variable-height content, so it flows normally
// below the snap sequence instead of being forced into fixed screens.

import { useState, useCallback } from 'react';
import LocalityPicker from './LocalityPicker';
import AddressPicker from './AddressPicker';
import UnitVerdict from './UnitVerdict';
import PersonaPicker from './PersonaPicker';
import PropertyScoreProgress from './PropertyScoreProgress';
import SideDataStrip from './SideDataStrip';
import HeroMap from '@/components/HeroMap';
import { coverageLabel } from '@/lib/aslivastu/cityMeta';

const SCREEN_H = 'calc(100vh - 66px)'; // 66px = the sticky header's own height

export default function PropertyScoreFlow() {
  const [mode, setMode] = useState(null); // 'locality' | 'address'
  const [personaId, setPersonaId] = useState(null);

  const [areaRecord, setAreaRecord] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [city, setCity] = useState(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  // "Unit" ticks when Get Combined/Home Comfort Score is clicked;
  // "Verdict" ticks when the full AI report is generated.
  const [unitSeen, setUnitSeen] = useState(false);
  const [verdictStarted, setVerdictStarted] = useState(false);

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon(''); setUnitSeen(false); setVerdictStarted(false);
  };

  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    resetLocation();
  };

  const handleAreaSelected = useCallback((record, cityName) => {
    setAreaRecord(record);
    setPinCode(record.pin_code);
    setCity(cityName);
    setAddressLabel(record.name);
    if (record.lat && record.lon) {
      setLat(String(record.lat));
      setLon(String(record.lon));
    }
  }, []);

  const handleAddressConfirmed = useCallback((newLat, newLon, matchedArea, matchCity, label) => {
    setLat(String(newLat));
    setLon(String(newLon));
    setAreaRecord(matchedArea);
    setPinCode(matchedArea?.pin_code ?? null);
    setCity(matchCity);
    setAddressLabel(label || '');
  }, []);

  function scrollToNext(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  // Coarse but reliable -- derived straight from state this component
  // already owns, no scroll-spying needed. Persona picking itself isn't a
  // hard gate (you can still continue without one), so it's just the
  // first stage that hasn't happened yet vs. has. "Unit" and "Verdict"
  // are ticked (done) independently of which stage is currently active --
  // see PropertyScoreProgress's `done` prop -- so the active pointer
  // moves straight to Verdict as soon as Unit is marked seen.
  const progressStage = !personaId ? 'angle'
    : !(lat && lon) ? 'location'
    : !unitSeen ? 'unit'
    : 'verdict';
  const progressDone = [
    ...(personaId ? ['angle'] : []),
    ...(lat && lon ? ['location'] : []),
    ...(unitSeen ? ['unit'] : []),
    ...(verdictStarted ? ['verdict'] : []),
  ];

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      <PropertyScoreProgress current={progressStage} done={progressDone} />
      <SideDataStrip />

      {/* ── snap sequence: 3 full screens ── */}
      <div style={{ scrollSnapType: 'y proximity' }}>

        {/* Screen 1 — the threshold.
            This used to be a near-clone of the landing page hero: same
            HeroMap grid, same left-text/right-cards split, same oversized
            Bricolage headline with two engine-coloured words, same
            coverage pill. Arriving here read as "nothing happened, same
            page" -- because compositionally nothing had.
            It also did the wrong job. The landing page's job is "here's
            what BlindSpot is"; repeating that pitch a third time (hero →
            How It Works → here) is why this felt heavy to sit with.
            This screen's job is "here's what's about to happen to you" --
            the four steps of the flow, named exactly as the stepper above
            names them. That's inherently different content from the
            landing page, so it can't read as a duplicate, and it still
            orients someone who clicked the CTA without ever scrolling the
            landing page (which is why it isn't simply deleted).
            Visually deliberately unlike the hero: no HeroMap, a solid
            --bg-2 field so the surface colour itself changes on arrival,
            centred single column instead of the two-column split, and a
            smaller headline. */}
        <div className="ps-arrive ps-threshold" style={{ scrollSnapAlign: 'start' }}>
          <HeroMap variant="dim" />
          <div className="wrap" style={{ width: '100%', maxWidth: 780, textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <span className="mono ps-threshold-eyebrow">You&apos;re in · takes about a minute</span>

            <h1 className="ps-threshold-h">Let&apos;s find the blind spot.</h1>

            <p className="ps-threshold-sub">
              BlindSpot answers one question — <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>is this actually a good place to live?</strong>{' '}
              We score the <span style={{ color: 'var(--av)', fontWeight: 600 }}>neighbourhood</span> from government records
              and the <span style={{ color: 'var(--ss)', fontWeight: 600 }}>flat itself</span> from real sun and shadow geometry,
              then combine them into one verdict. Four steps:
            </p>

            {/* Mirrors PropertyScoreProgress's STAGES exactly -- same four
                labels in the same order, so the strip pinned at the top of
                the page is legible as a map of this list rather than an
                unexplained row of words. */}
            <ol className="ps-threshold-steps">
              {[
                ['Your Angle', 'Tell us who’s house-hunting. It re-weights everything below.', 'var(--brand)'],
                ['Location', 'Browse a scored locality, or search the exact address.', 'var(--av)'],
                ['Unit', 'Pick the floor and facing. We simulate the sun on it.', 'var(--ss)'],
                ['Verdict', 'One combined score — you control the weighting.', 'var(--brand)'],
              ].map(([label, desc, color], i) => (
                <li key={label} className="ps-threshold-step">
                  <span className="mono ps-threshold-step-n" style={{ background: color }}>{i + 1}</span>
                  <span>
                    <span className="ps-threshold-step-label">{label}</span>
                    <span className="ps-threshold-step-desc">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>

            {/* A real button, not just a "scroll down" hint -- someone who
                just clicked a CTA to get here expects another clear action,
                not an instruction to go find one. */}
            <button onClick={() => scrollToNext('ps-screen-persona')} className="btn btn-lg btn-cta ps-btn ps-cta-btn ps-threshold-cta">
              Start — Pick Your Angle <span className="btn-cta-arrow">↓</span>
            </button>

            {/* Shared with the landing page hero (app/page.js) -- surfaces
                the two-city scope right where someone decides whether to
                keep going, instead of them finding out several steps in
                via AddressPicker's "no coverage" message. */}
            <div style={{ marginTop: 22 }}>
              <span className="coverage-pill">
                <span className="dot" />Live in {coverageLabel()} — more cities coming
              </span>
            </div>
          </div>
        </div>

        {/* Screen 2 — persona dial.
            `alignItems:center` on a fixed-height flex box clips overflow at
            BOTH ends rather than just the bottom, which is how the dial
            ended up cutting "Pick your angle." off above the fold on
            shorter viewports. The vertical padding plus `marginBlock:auto`
            on the child means it still centres when there's room, but
            degrades to normal top-aligned scrolling when there isn't --
            instead of hiding the headline. */}
        <div id="ps-screen-persona" style={{ minHeight: SCREEN_H, display: 'flex', alignItems: 'center', scrollSnapAlign: 'start', padding: '28px 0' }}>
          <div className="ps-flow-wrap" style={{ width: '100%', marginBlock: 'auto' }}>
            <PersonaPicker personaId={personaId} onSelect={setPersonaId} big />
            <button onClick={() => scrollToNext('ps-screen-location')} className="mono"
              style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px auto 0', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, letterSpacing: '.1em', cursor: 'pointer' }}>
              SCROLL TO PICK A LOCATION <span style={{ fontSize: 14 }}>↓</span>
            </button>
          </div>
        </div>

        {/* Screen 3 — entry mode. Only forces a full screen while nothing's
            picked yet; once a mode is chosen it shrinks to fit its own
            content so the picker/search bar right after it isn't left
            floating a screen's height below with a big empty gap. */}
        <div id="ps-screen-location" style={{
          minHeight: mode ? 0 : SCREEN_H, display: 'flex', alignItems: 'center',
          scrollSnapAlign: 'start', padding: mode ? '48px 0' : 0,
        }}>
          <div className="ps-flow-wrap" style={{ width: '100%' }}>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 28, textAlign: 'center' }}>HOW DO YOU WANT TO START?</div>
            {/* Cards used to be a title + one line of copy inside a big
                padded box -- on a full-height screen that read as mostly
                empty field with two small labels floating in the middle.
                Grown to a fixed min-height and filled with content that's
                actually informative (the real sub-steps, and the reasons
                to pick one path over the other), not decoration added
                just to occupy space. */}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1080, margin: '0 auto' }}>
              <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                style={{
                  // Was a hardcoded rgba(175,47,64) -- an off-brand hot
                  // pink unrelated to any token. A tint of --slate matches
                  // the rest of the site's selection states.
                  flex: '1 1 380px', maxWidth: 460, minHeight: 320, textAlign: 'left', background: mode === 'locality' ? 'color-mix(in srgb, var(--slate) 14%, var(--bg-2))' : 'var(--bg-2)',
                  border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`, borderRadius: 'var(--radius)', padding: '40px 34px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--slate)', letterSpacing: '.1em', marginBottom: 14 }}>OPTION A</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>City → Locality → Unit</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 14.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 26 }}>Browse scored neighbourhoods, then pick a floor/facing.</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                  {['City', 'Locality', 'Unit'].map((step, i) => (
                    <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11.5, padding: '7px 13px', borderRadius: 'var(--radius)', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--text)' }}>{step}</span>
                      {i < 2 && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→</span>}
                    </span>
                  ))}
                </div>

                <ul style={{ margin: '0 0 0 0', padding: 0, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.9, listStyle: 'none', marginTop: 'auto' }}>
                  {[
                    'Compare against a full scored shortlist first',
                    'See all 8 Neighbourhood Score metrics before committing to one address',
                    'Best if you’re still deciding between areas',
                  ].map(line => (
                    <li key={line} style={{ position: 'relative', paddingLeft: 16 }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--slate)' }}>—</span>{line}
                    </li>
                  ))}
                </ul>
              </button>
              <button onClick={() => chooseMode('address')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 380px', maxWidth: 460, minHeight: 320, textAlign: 'left', background: mode === 'address' ? 'color-mix(in srgb, var(--sun) 14%, var(--bg-2))' : 'var(--bg-2)',
                  border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`, borderRadius: 'var(--radius)', padding: '40px 34px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--sun)', letterSpacing: '.1em', marginBottom: 14 }}>OPTION B</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>I have the exact address</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 14.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 26 }}>Search it directly — we&apos;ll place the pin and detect the area for you.</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                  {['Address', 'Auto-detect area', 'Unit'].map((step, i) => (
                    <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11.5, padding: '7px 13px', borderRadius: 'var(--radius)', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--text)' }}>{step}</span>
                      {i < 2 && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→</span>}
                    </span>
                  ))}
                </div>

                <ul style={{ margin: '0 0 0 0', padding: 0, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.9, listStyle: 'none', marginTop: 'auto' }}>
                  {[
                    'Fastest if you already have one building in mind',
                    'We match it to the nearest scored locality automatically',
                    'No need to browse a list first',
                  ].map(line => (
                    <li key={line} style={{ position: 'relative', paddingLeft: 16 }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--sun)' }}>—</span>{line}
                    </li>
                  ))}
                </ul>
              </button>
            </div>
            {!mode && (
              <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-dim)', marginTop: 32 }}>Pick one to continue — the rest of the flow opens below.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── everything after this point is variable-height, normal scroll ── */}
      <div className="wrap section-inner" style={{ paddingTop: 0 }}>
        {mode === 'locality' && (
          <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />
        )}

        {mode === 'address' && (
          <AddressPicker onConfirmed={handleAddressConfirmed} />
        )}

        {lat && lon && (
          <UnitVerdict
            areaRecord={areaRecord}
            pinCode={pinCode}
            city={city}
            lat={lat}
            lon={lon}
            setLat={setLat}
            setLon={setLon}
            addressLabel={addressLabel}
            personaId={personaId}
            onUnitSeen={setUnitSeen}
            onVerdictStart={setVerdictStarted}
          />
        )}
      </div>
    </section>
  );
}
