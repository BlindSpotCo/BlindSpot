'use client';
// components/Testimonials.js
//
// "In their words" - real feedback from people who used BlindSpot.
//
// PLACEHOLDER UNTIL REAL QUOTES ARRIVE. Rules for adding one:
//  - real person, real area they checked, their own words (keep the
//    critical part: "right about the water, wrong about the noise" is
//    more believable than praise)
//  - written consent on record (a WhatsApp "yes" screenshot is enough),
//    and only the details they agreed to: first name + city, photo only
//    if they said yes to a photo
//  - remove the same day if they ask
//
// Shape of one entry (fill TESTIMONIALS below, nothing else changes):
//   { name: 'Priya', city: 'Bangalore', area: 'HSR Layout',
//     quote: 'Right about the water, wrong about the noise.', photo: null }
//
// While the list is empty, the live site shows an honest "we're
// collecting feedback" panel that opens the feedback form - never sample
// quotes. In local development only, three labelled preview cards show
// below it so the card design can be checked.

const TESTIMONIALS = [];

const PREVIEW = [
  { name: '[First name]', city: '[City]', area: '[Area they checked]', quote: '[What the report got right, and what it got wrong, in their own words.]' },
  { name: '[First name]', city: '[City]', area: '[Area they checked]', quote: '[Their quote goes here.]' },
  { name: '[First name]', city: '[City]', area: '[Area they checked]', quote: '[Their quote goes here.]' },
];

function Card({ t, preview }) {
  const initial = t.name.replace(/[^A-Za-z]/g, '').charAt(0) || '?';
  return (
    <figure className={`tm-card reveal${preview ? ' is-preview' : ''}`}>
      {preview && <span className="tm-preview-tag">Preview, not on live site</span>}
      <blockquote className="tm-quote">{t.quote}</blockquote>
      <figcaption className="tm-who">
        {t.photo
          ? <img className="tm-avatar" src={t.photo} alt="" />
          : <span className="tm-avatar" aria-hidden="true">{initial}</span>}
        <span>
          <span className="tm-name">{t.name}, {t.city}</span>
          <span className="tm-area">Checked {t.area}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function openFeedback() {
  window.dispatchEvent(new CustomEvent('bs:feedback', { detail: { kind: 'other' } }));
}

export default function Testimonials() {
  const hasReal = TESTIMONIALS.length > 0;
  const showPreview = !hasReal && process.env.NODE_ENV !== 'production';

  return (
    <section className="section reveal" id="in-their-words">
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">04 - Feedback</span>
            <h2>In their own <span className="gold-word">words</span>.</h2>
          </div>
        </div>

        {hasReal ? (
          <div className="tm-grid">
            {TESTIMONIALS.map((t) => <Card key={`${t.name}-${t.area}`} t={t} />)}
          </div>
        ) : (
          <>
            <div className="tm-empty reveal">
              <p className="tm-empty-head">We&apos;re collecting feedback from our first buyers.</p>
              <p className="tm-empty-sub">Tried BlindSpot on an area you know well? Tell us what it got right and what it got wrong.</p>
              <button type="button" className="tm-empty-btn" onClick={openFeedback}>
                Share your feedback <span aria-hidden="true">→</span>
              </button>
            </div>
            {showPreview && (
              <div className="tm-grid">
                {PREVIEW.map((t, i) => <Card key={i} t={t} preview />)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
