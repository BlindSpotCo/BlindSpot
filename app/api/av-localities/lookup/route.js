// app/api/av-localities/lookup/route.js
// One-record lookup by exact PIN code -- GET ?pin=110001 -> the same
// scored-locality shape /api/av-localities returns per row, or
// { found:false } for a pin BlindSpot doesn't have neighbourhood data
// for. Built for the homepage hero's live insight chips: a search
// result only carries a postcode, and fetching the entire by-city
// dataset just to read one row was unnecessary weight for something
// that fires on every address a visitor picks.
import { NextResponse } from 'next/server';
import { getLocalityByPin } from '@/lib/aslivastu/localities';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pin = (searchParams.get('pin') || '').trim();

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ found: false, reason: 'bad-pin' }, { status: 400 });
  }

  try {
    const record = getLocalityByPin(pin);
    if (!record) return NextResponse.json({ found: false, reason: 'not-covered' });
    return NextResponse.json({ found: true, record });
  } catch (err) {
    console.error('[av-localities/lookup] Failed to read local data:', err?.message || err);
    return NextResponse.json({ found: false, reason: 'error' }, { status: 500 });
  }
}
