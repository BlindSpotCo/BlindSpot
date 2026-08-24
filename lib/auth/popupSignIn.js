// lib/auth/popupSignIn.js
//
// Opens the existing /login page in a popup window and resolves once the
// person finishes signing in there (email/password or Google -- both paths
// already end at /auth/popup-complete, see app/auth/popup-complete/page.js).
// The calling tab never navigates, so any client-side state on the page
// (e.g. PropertyScoreFlow's step) survives sign-in intact.
//
// Listens on TWO channels for the session coming back:
//  - BroadcastChannel('blindspot-auth') -- the reliable one. Doesn't
//    depend on window.opener staying alive, which matters because a
//    Google sign-in routes the popup through accounts.google.com, and
//    that hop severs window.opener in most browsers (a security
//    behavior on Google's side, not fixable from here). BroadcastChannel
//    only needs same-origin, which always holds for this same-domain flow.
//  - window.postMessage -- kept as a fallback for browsers without
//    BroadcastChannel support (very old Safari) and in case opener
//    happens to survive.
// Whichever arrives first wins.

export function openSignInPopup() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('popup sign-in is client-only'));
      return;
    }

    const origin = window.location.origin;
    const next = encodeURIComponent(`/auth/popup-complete?origin=${encodeURIComponent(origin)}`);
    const w = 460, h = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);

    const popup = window.open(
      `/login?next=${next}`,
      'blindspot-sign-in',
      `width=${w},height=${h},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }

    let settled = false;
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('blindspot-auth');
    }

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ access_token: payload.access_token, refresh_token: payload.refresh_token });
      try { popup.close(); } catch {}
    };

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (bc) { bc.removeEventListener('message', onBroadcast); bc.close(); }
      clearInterval(pollClosed);
    };

    const onBroadcast = (event) => {
      if (event.data?.type !== 'blindspot-popup-auth') return;
      finish(event.data);
    };
    if (bc) bc.addEventListener('message', onBroadcast);

    const onMessage = (event) => {
      if (event.origin !== origin) return;
      if (event.data?.type !== 'blindspot-popup-auth') return;
      finish(event.data);
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
