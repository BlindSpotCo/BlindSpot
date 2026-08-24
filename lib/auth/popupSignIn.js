// lib/auth/popupSignIn.js
//
// Opens the existing /login page in a popup window and resolves once the
// person finishes signing in there (email/password or Google -- both paths
// already end at /auth/popup-complete, see app/auth/popup-complete/page.js).
// The calling tab never navigates, so any client-side state on the page
// (e.g. PropertyScoreFlow's step) survives sign-in intact.
//
// This re-uses plumbing that already existed for SunScout/AsliVastu's
// cross-domain "Save to BlindSpot" popups -- /login already honours a
// relative `next`, and /auth/popup-complete already posts the session back
// to window.opener. The only other change needed was adding this site's
// own origin to popup-complete's ALLOWED_ORIGINS allowlist.

export function openSignInPopup() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('popup sign-in is client-only'));
      return;
    }

    const origin = window.location.origin;
    const next = encodeURIComponent(`/auth/popup-complete?origin=${encodeURIComponent(origin)}`);
    const w = 420, h = 620;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);

    const popup = window.open(
      `/login?next=${next}`,
      'blindspot-sign-in',
      `width=${w},height=${h},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(pollClosed);
    };

    const onMessage = (event) => {
      if (event.origin !== origin) return;
      if (event.data?.type !== 'blindspot-popup-auth') return;
      settled = true;
      cleanup();
      resolve({ access_token: event.data.access_token, refresh_token: event.data.refresh_token });
      try { popup.close(); } catch {}
    };
    window.addEventListener('message', onMessage);

    // If the person closes the popup without finishing (or it never gets
    // a session -- e.g. they gave up on the form), don't hang forever.
    const pollClosed = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('popup-closed'));
      }
    }, 500);
  });
}
