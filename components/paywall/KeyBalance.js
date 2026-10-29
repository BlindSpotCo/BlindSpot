'use client';
// components/paywall/KeyBalance.js
// "◆ 4 Keys" chip. Tapping it opens the wallet; the + opens the packs.

import { KeyRound, Plus } from 'lucide-react';
import { useKeys } from '@/lib/paywall/KeysProvider';
import { keysWord } from '@/lib/paywall/config';
import './paywall.css';

export default function KeyBalance({ compact = false }) {
  const { enabled, balance, openWallet, openPacks } = useKeys();
  if (!enabled) return null;
  return (
    <span className={`pw-chip${compact ? ' is-compact' : ''}`}>
      <button type="button" className="pw-chip-bal" onClick={openWallet} title="Your Keys and unlocked reports">
        <KeyRound size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>{compact ? balance : keysWord(balance)}</span>
      </button>
      <button type="button" className="pw-chip-add" onClick={openPacks} aria-label="Get Keys" title="Get Keys">
        <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </span>
  );
}
