// components/SourceStrip.js
//
// "Where our scores come from" - a quiet strip straight under the hero
// map, the spot where a first-time visitor decides whether a score from
// a site they have never heard of is worth believing.
//
// Text only, no logos: we are not partnered with any of these bodies,
// we use their published data, and a logo would read as endorsement.
//
// Every name below is a source the live scoring actually reads - check
// before adding one:
//   police crime records    -> lib/aslivastu/cityMeta.js sources.crime (city police / NCRB)
//   pollution control board -> sources.air + app/api/aqi (CPCB index)
//   CBSE & ICSE records     -> sources.schools
//   city water boards       -> sources.water (DJB, BWSSB, HMWSSB, Metrowater...)
//   electricity companies   -> sources.power (BSES, BESCOM, TANGEDCO...)
//   metro and master plans  -> sources.infrastructure (DDA, DMRC, MMRDA...)
//   NASA climate records    -> lib/trends/climate.js, windScore.js (NASA POWER)
//   OpenStreetMap           -> buildingSight.js, noiseScore.js
// Do not add RERA, satellite heat, or anything else here until the code
// actually uses it.

const SOURCES = [
  'City police crime records',
  'Pollution control board air data',
  'CBSE & ICSE school records',
  'City water boards',
  'Electricity company reports',
  'Metro & city master plans',
  'NASA climate records',
  'OpenStreetMap buildings & roads',
];

export default function SourceStrip() {
  return (
    <section className="src-strip" aria-labelledby="src-strip-title">
      <div className="wrap">
        <p className="src-strip-title mono" id="src-strip-title">Where our scores come from</p>
        <ul className="src-strip-list">
          {SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="src-strip-note">Public records and map data. Nothing from brokers, builders or sellers.</p>
      </div>
    </section>
  );
}
