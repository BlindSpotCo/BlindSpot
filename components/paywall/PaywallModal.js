'use client';
// components/paywall/PaywallModal.js
//
// Every paywall screen in one dialog: unlock confirmation, Key packs,
// checkout (payment stubbed) and the wallet. Driven by KeysProvider.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Lock, X, Check } from 'lucide-react';
import { PACKS, PAYWALL_MOCK, REPORT_TYPES, inr, inr2, keysWord, perKey } from '@/lib/paywall/config';
import './paywall.css';

export default function PaywallModal({ modal, setModal, balance, unlocks, ledger, costFor, onConfirm, onCredit, onReset }) {
  const boxRef = useRef(null);
  const close = () => setModal(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('pw-lock');
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.classList.remove('pw-lock'); };
  }, [setModal]);
  useEffect(() => { boxRef.current?.querySelector('[data-autofocus]')?.focus(); }, [modal.view]);

  if (typeof document === 'undefined') return null;
  const req = modal.pending;
  const cost = req ? costFor(req.prop) : 0;
  const t = req ? REPORT_TYPES[req.type] : null;

  let body;
  if (modal.view === 'confirm' && req) {
    const after = balance - cost;
    body = (
      <>
        <p className="pw-eyebrow">Unlock</p>
        <h2 className="pw-h">{t.label}</h2>
        <p className="pw-scope">{req.scope}</p>
        <dl className="pw-sum">
          <div><dt>Cost</dt><dd>{keysWord(cost)}</dd></div>
          <div><dt>Balance after</dt><dd>{keysWord(after)}</dd></div>
        </dl>
        {req.type === 'full' && <p className="pw-note">Includes the neighbourhood report and the sunlight report for this flat.</p>}
        <button type="button" className="pw-btn" data-autofocus onClick={onConfirm}>Use {keysWord(cost)}</button>
        <button type="button" className="pw-btn is-quiet" onClick={close}>Not now</button>
      </>
    );
  } else if (modal.view === 'checkout') {
    const p = PACKS.find((x) => x.id === modal.packId);
    body = (
      <>
        <p className="pw-eyebrow">Checkout</p>
        <h2 className="pw-h">{p.name} pack</h2>
        <dl className="pw-sum">
          <div><dt>{p.keys} Keys</dt><dd>{inr(p.price)}</dd></div>
          <div><dt>Per Key</dt><dd>{inr2(perKey(p))}</dd></div>
          <div><dt>Covers about</dt><dd>{p.fits}</dd></div>
        </dl>
        <button type="button" className="pw-btn" disabled><Lock size={14} aria-hidden="true" /> Pay {inr(p.price)} with Razorpay</button>
        <div className="pw-stub">
          <strong>Payments aren&apos;t live yet</strong>
          <span>This is where Razorpay opens. A payment webhook adds the Keys to your account.</span>
          {PAYWALL_MOCK && (
            <button type="button" className="pw-btn is-line" data-autofocus onClick={() => onCredit(p)}>Simulate successful payment</button>
          )}
        </div>
        <button type="button" className="pw-btn is-quiet" onClick={() => setModal({ view: 'packs', pending: req })}>Back to packs</button>
      </>
    );
  } else if (modal.view === 'wallet') {
    body = (
      <>
        <p className="pw-eyebrow">Your Keys</p>
        <h2 className="pw-h pw-bal">{keysWord(balance)}</h2>
        <button type="button" className="pw-btn" data-autofocus onClick={() => setModal({ view: 'packs' })}>Get more Keys</button>
        <section>
          <p className="pw-eyebrow">Unlocked reports</p>
          {unlocks.length ? (
            <ul className="pw-list">
              {unlocks.slice().reverse().map((u, i) => (
                <li key={i}><span>{REPORT_TYPES[u.type].label}</span><span className="pw-list-sub">{u.scope}</span></li>
              ))}
            </ul>
          ) : <p className="pw-note">Nothing unlocked yet. Paid reports show a lock and their Key cost before you click.</p>}
        </section>
        <section>
          <p className="pw-eyebrow">History</p>
          {ledger.length ? (
            <ul className="pw-list">
              {ledger.slice().reverse().map((l, i) => (
                <li key={i}>
                  <span>{l.label}</span>
                  <span className={`pw-delta ${l.delta > 0 ? 'is-plus' : 'is-minus'}`}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
                  <span className="pw-list-sub">{l.sub}</span>
                </li>
              ))}
            </ul>
          ) : <p className="pw-note">No Key activity yet.</p>}
        </section>
        {PAYWALL_MOCK && <button type="button" className="pw-link" onClick={onReset}>Reset demo wallet</button>}
      </>
    );
  } else {
    // packs
    const need = req ? Math.max(0, cost - balance) : 0;
    body = (
      <>
        <p className="pw-eyebrow">Get Keys</p>
        <h2 className="pw-h">Pay per property, not per month</h2>
        {req && need > 0 && (
          <p className="pw-need">You need <strong>{need} more {need === 1 ? 'Key' : 'Keys'}</strong> to unlock the {t.label.replace(/^\w/, (c) => c.toLowerCase())} for {req.scope}.</p>
        )}
        <div className="pw-rules">
          <div><strong>2 Keys</strong>Per report, any floor or facing</div>
          <div><strong>Any city</strong>Use Keys anywhere we cover</div>
        </div>
        <div className="pw-packs">
          {PACKS.map((p, i) => (
            <div key={p.id} className={`pw-pack${p.tag ? ' is-hot' : ''}`}>
              {p.tag && <span className="pw-tag">{p.tag}</span>}
              <strong className="pw-pack-name">{p.name}</strong>
              <span className="pw-pack-keys">{p.keys} <small>Keys</small></span>
              <span className="pw-pack-price">{inr(p.price)}</span>
              <span className="pw-pack-per">{inr2(perKey(p))} per Key</span>
              <span className="pw-pack-fits">{p.fits}</span>
              <button type="button" className="pw-btn" data-autofocus={i === 1 ? '' : undefined} onClick={() => setModal({ view: 'checkout', packId: p.id, pending: req })}>
                Choose {p.name}
              </button>
            </div>
          ))}
        </div>
        <p className="pw-note">
          Free on every flat: the 3D sun &amp; shadow map, both scores and the score breakdowns.{' '}
          <Link href="/pricing" onClick={close}>How Keys work</Link>
        </p>
      </>
    );
  }

  const narrow = modal.view !== 'packs';
  return createPortal(
    <div className="pw-overlay" onClick={close}>
      <div
        ref={boxRef}
        className={`pw-box${narrow ? ' is-narrow' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="BlindSpot Keys"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="pw-x" onClick={close} aria-label="Close"><X size={18} /></button>
        {body}
      </div>
    </div>,
    document.body
  );
}

// Small inline marker for paid buttons/links: lock + cost, or a tick once
// this exact report is unlocked.
export function KeyCostTag({ unlocked, cost, tone }) {
  if (unlocked) return <span className={`pw-cost is-open${tone ? ` is-${tone}` : ''}`}><Check size={12} strokeWidth={3} aria-hidden="true" />Unlocked</span>;
  return <span className={`pw-cost${tone ? ` is-${tone}` : ''}`} title={`Costs ${keysWord(cost)}`}><Lock size={12} strokeWidth={2.6} aria-hidden="true" />{keysWord(cost)}</span>;
}
