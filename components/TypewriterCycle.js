'use client';
// components/TypewriterCycle.js
// Small reusable "typewriter" effect -- types a string in `items` out
// one character at a time, holds, deletes it, moves to the next, and
// loops forever. Runs as a single imperative setTimeout loop inside one
// effect (rather than several bits of state driving each other off a
// dependency array), so the timing stays exact and there's no
// interaction-order bugs to chase.
//
// prefers-reduced-motion: skips the animation entirely, shows the first
// item statically, no blinking cursor.

import { useEffect, useRef, useState } from 'react';

export default function TypewriterCycle({
  items,
  typeSpeed = 42,
  deleteSpeed = 26,
  holdTime = 1700,
  pauseBeforeNext = 300,
  className,
  cursorClassName,
}) {
  const [text, setText] = useState('');
  const [reduced, setReduced] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const isReduced = !!mq?.matches;
    setReduced(isReduced);

    if (!items || items.length === 0) return undefined;

    if (isReduced) {
      setText(items[0]);
      return undefined;
    }

    let cancelled = false;
    let itemIndex = 0;

    const schedule = (fn, delay) => {
      timeoutRef.current = setTimeout(() => { if (!cancelled) fn(); }, delay);
    };

    const typeItem = () => {
      const full = items[itemIndex];
      let charIndex = 0;
      const step = () => {
        if (cancelled) return;
        charIndex += 1;
        setText(full.slice(0, charIndex));
        if (charIndex < full.length) {
          schedule(step, typeSpeed);
        } else {
          schedule(deleteItem, holdTime);
        }
      };
      schedule(step, typeSpeed);
    };

    const deleteItem = () => {
      const full = items[itemIndex];
      let charIndex = full.length;
      const step = () => {
        if (cancelled) return;
        charIndex -= 1;
        setText(full.slice(0, Math.max(0, charIndex)));
        if (charIndex > 0) {
          schedule(step, deleteSpeed);
        } else {
          itemIndex = (itemIndex + 1) % items.length;
          schedule(typeItem, pauseBeforeNext);
        }
      };
      schedule(step, deleteSpeed);
    };

    typeItem();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, typeSpeed, deleteSpeed, holdTime, pauseBeforeNext]);

  return (
    <span className={className} aria-hidden="true">
      {text}
      {!reduced && <span className={cursorClassName} />}
    </span>
  );
}
