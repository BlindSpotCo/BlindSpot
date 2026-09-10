// components/goToSearch.js
// The one thing every "Uncover Your BlindSpot" button is meant to do.
//
// These all pointed at /#find, which is the hero -- the top of the page.
// From anywhere on the homepage that scrolled the visitor back to where
// they started, placed no focus, and gave no sign of what to do next: the
// site's single conversion action, doing nothing visible. From another page
// it navigated fine but still landed them at a search box without the
// cursor in it.
export function goToSearch(e) {
  if (typeof window === 'undefined') return;
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
  if (window.location.pathname !== '/') return; // a real navigation; let it happen
  const target = document.getElementById('find');
  if (!target) return;
  e?.preventDefault?.();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  const field = target.querySelector('input');
  if (field) window.setTimeout(() => field.focus({ preventScroll: true }), reduced ? 0 : 420);
}
