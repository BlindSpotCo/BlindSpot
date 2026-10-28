'use client';
// lib/paywall/KeysProvider.js
//
// The Key wallet the whole UI reads from. MOCK: balance, unlocks and
// history are kept in localStorage. Before charging real money this has
// to move server-side (Supabase key_wallets + key_ledger), with the Key
// deducted in the API route that starts report generation -- anything
// checked only in the browser can be skipped with devtools.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEY_COST, PAYWALL_ENABLED, REPORT_TYPES } from './config';
import PaywallModal from '@/components/paywall/PaywallModal';

const Ctx = createContext(null);
const LS = 'bs_keys_mock_v1';

const load = () => {
  try { const v = JSON.parse(window.localStorage.getItem(LS) || 'null'); if (v && typeof v.balance === 'number') return v; } catch {}
  return { balance: 0, unlocks: [], ledger: [] };
};

export function KeysProvider({ children }) {
  const [wallet, setWallet] = useState({ balance: 0, unlocks: [], ledger: [] });
  const [ready, setReady] = useState(false);
  // { view: 'confirm' | 'packs' | 'checkout' | 'wallet', pending?, packId? }
  const [modal, setModal] = useState(null);

  useEffect(() => { setWallet(load()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(LS, JSON.stringify(wallet)); } catch {}
  }, [wallet, ready]);
  // Keep tabs in sync (the neighbourhood report opens in a new tab).
  useEffect(() => {
    const onStorage = (e) => { if (e.key === LS) setWallet(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const hasAnyOn = useCallback((prop) => wallet.unlocks.some((u) => u.prop === prop), [wallet.unlocks]);

  const costFor = useCallback((prop) => (hasAnyOn(prop) ? KEY_COST.extra : KEY_COST.first), [hasAnyOn]);

  // type: 'neighbourhood' | 'sun' | 'full'. variant: 'floor:facing' for
  // per-flat reports; ignored for neighbourhood.
  const isUnlocked = useCallback((prop, type, variant) => {
    if (!PAYWALL_ENABLED) return true;
    if (!prop) return false;
    return wallet.unlocks.some((u) => {
      if (u.prop !== prop) return false;
      const covers = u.type === type || (REPORT_TYPES[u.type]?.includes || []).includes(type);
      if (!covers) return false;
      return !REPORT_TYPES[type].perUnit || u.variant === variant;
    });
  }, [wallet.unlocks]);

  // The one entry point every paid button calls. Opens the report straight
  // away if it's already unlocked; otherwise asks first (or shows packs).
  const request = useCallback((req) => {
    // req: { prop, type, variant, scope, pin, onUnlocked }
    if (!PAYWALL_ENABLED || isUnlocked(req.prop, req.type, req.variant)) { req.onUnlocked?.(); return; }
    const cost = costFor(req.prop);
    setModal({ view: wallet.balance >= cost ? 'confirm' : 'packs', pending: req });
  }, [isUnlocked, costFor, wallet.balance]);

  const confirmUnlock = useCallback(() => {
    const req = modal?.pending;
    if (!req) return;
    const cost = costFor(req.prop);
    if (wallet.balance < cost) { setModal({ view: 'packs', pending: req }); return; }
    setWallet((w) => ({
      balance: w.balance - cost,
      unlocks: [...w.unlocks, { prop: req.prop, type: req.type, variant: REPORT_TYPES[req.type].perUnit ? req.variant : null, pin: req.pin || null, scope: req.scope, at: Date.now() }],
      ledger: [...w.ledger, { delta: -cost, label: REPORT_TYPES[req.type].label, sub: req.scope, at: Date.now() }],
    }));
    setModal(null);
    // Called inside the click, so window.open (neighbourhood report)
    // still counts as a user gesture and isn't popup-blocked.
    req.onUnlocked?.();
  }, [modal, costFor, wallet.balance]);

  // Placeholder for the Razorpay success webhook.
  const creditPack = useCallback((pack) => {
    setWallet((w) => ({
      ...w,
      balance: w.balance + pack.keys,
      ledger: [...w.ledger, { delta: pack.keys, label: `${pack.name} pack`, sub: 'Simulated payment', at: Date.now() }],
    }));
    setModal((m) => (m?.pending ? { view: 'confirm', pending: m.pending } : null));
  }, []);

  const resetMock = useCallback(() => { setWallet({ balance: 0, unlocks: [], ledger: [] }); setModal(null); }, []);

  const value = useMemo(() => ({
    enabled: PAYWALL_ENABLED,
    balance: wallet.balance,
    unlocks: wallet.unlocks,
    ledger: wallet.ledger,
    costFor, isUnlocked, request,
    openPacks: () => setModal({ view: 'packs' }),
    openWallet: () => setModal({ view: 'wallet' }),
    resetMock,
  }), [wallet, costFor, isUnlocked, request, resetMock]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {PAYWALL_ENABLED && modal && (
        <PaywallModal
          modal={modal}
          setModal={setModal}
          balance={wallet.balance}
          unlocks={wallet.unlocks}
          ledger={wallet.ledger}
          costFor={costFor}
          onConfirm={confirmUnlock}
          onCredit={creditPack}
          onReset={resetMock}
        />
      )}
    </Ctx.Provider>
  );
}

// Safe outside the provider too: falls back to "everything free".
const FREE = {
  enabled: false, balance: 0, unlocks: [], ledger: [],
  costFor: () => 0, isUnlocked: () => true,
  request: (r) => r.onUnlocked?.(), openPacks: () => {}, openWallet: () => {}, resetMock: () => {},
};
export const useKeys = () => useContext(Ctx) || FREE;
