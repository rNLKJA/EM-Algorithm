"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A cursor over `count` stages with play/pause. Playing advances every
 * `intervalMs` and stops by itself at the last stage.
 */
export function usePlayback(count: number, intervalMs: number, initialIndex = 0) {
  const [index, setIndexRaw] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, count - 1);
  const clamped = Math.min(index, last);
  const atEnd = clamped >= last;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndexRaw((i) => {
        if (i >= last) {
          setPlaying(false);
          return last;
        }
        return i + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [playing, intervalMs, last]);

  const setIndex = useCallback((i: number) => setIndexRaw(Math.max(0, Math.min(last, i))), [last]);

  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) setIndexRaw(0);
    setPlaying(true);
  }, [playing, atEnd]);

  return {
    index: clamped,
    setIndex,
    playing,
    setPlaying,
    toggle,
    next: () => setIndex(clamped + 1),
    prev: () => setIndex(clamped - 1),
    reset: () => {
      setPlaying(false);
      setIndexRaw(0);
    },
    toEnd: () => {
      setPlaying(false);
      setIndexRaw(last);
    },
    atStart: clamped === 0,
    atEnd,
  };
}
