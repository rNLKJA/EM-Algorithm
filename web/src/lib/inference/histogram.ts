export interface Histogram {
  x0: number;
  width: number;
  counts: number[];
}

/** Equal-width bins over the range of the finite values. */
export function binValues(values: readonly number[], bins: number): Histogram {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { x0: 0, width: 1, counts: new Array(bins).fill(0) };
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const width = hi > lo ? (hi - lo) / bins : 1;
  const counts = new Array<number>(bins).fill(0);
  for (const v of finite) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]++;
  return { x0: lo, width, counts };
}
