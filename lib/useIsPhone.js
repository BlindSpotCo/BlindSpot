'use client';
// lib/useIsPhone.js
// True on phone-width screens (640px and below). Starts false so the
// server render and the first client render match, then follows the
// media query.
import { useEffect, useState } from 'react';

export const PHONE_QUERY = '(max-width: 640px)';

export default function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isPhone;
}
