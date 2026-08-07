// lib/sunscout/networkFix.js
// Ported from SunScout's lib/networkFix.ts. Node's built-in fetch (undici)
// can fail with a bare "fetch failed" against some hosts when it tries
// IPv6 first and the path doesn't route -- forcing IPv4-first DNS
// resolution fixes it. Import for side effect before any external fetch.
import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Not available on very old Node versions -- harmless no-op.
}
