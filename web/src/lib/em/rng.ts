/**
 * Seeded pseudo-random numbers for "make your own data" and restarts.
 *
 * This is NOT NumPy's Mersenne Twister, so the same seed gives different numbers
 * from the notebook. The original 200 ratings come from the exported parity file
 * instead; anything generated here is labelled as such in the UI.
 */

export interface Rng {
  /** uniform on [0, 1) */
  next(): number;
  uniform(low: number, high: number): number;
  normal(mean: number, sd: number): number;
  int(maxExclusive: number): number;
}

/** splitmix32: spreads a small integer seed into well-mixed 32-bit state words. */
function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** xoshiro128** seeded through splitmix32. Deterministic across browsers and Node. */
export function createRng(seed: number): Rng {
  const sm = splitmix32(Math.floor(seed));
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const nextU32 = () => {
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };

  let spare: number | null = null;

  const next = () => nextU32() / 4294967296;

  return {
    next,
    uniform: (low, high) => low + (high - low) * next(),
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    normal(mean, sd) {
      if (spare !== null) {
        const z = spare;
        spare = null;
        return mean + sd * z;
      }
      // Box-Muller; 1 - u keeps log() away from zero.
      const u = 1 - next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return mean + sd * r * Math.cos(2 * Math.PI * v);
    },
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export interface GenerateConfig {
  n: number;
  pi1: number;
  mu1: number;
  mu2: number;
  sigma1: number;
  sigma2: number;
  seed: number;
  /** clip to [low, high] like `np.clip(ratings, 1, 10)`; null disables clipping */
  clip: [number, number] | null;
}

export interface GeneratedData {
  ratings: number[];
  /** 0 = group 1 (mean mu1), 1 = group 2 (mean mu2), as in the notebook */
  trueGroups: number[];
}

/**
 * Same recipe as notebook cell 4: draw every user's group first, then one normal
 * rating per user in order, then clip. Only the random source differs.
 */
export function generateRatings(config: GenerateConfig): GeneratedData {
  const rng = createRng(config.seed);
  const trueGroups: number[] = [];
  for (let i = 0; i < config.n; i++) trueGroups.push(rng.next() < config.pi1 ? 0 : 1);
  const ratings = trueGroups.map((g) =>
    g === 0 ? rng.normal(config.mu1, config.sigma1) : rng.normal(config.mu2, config.sigma2),
  );
  if (config.clip) {
    const [low, high] = config.clip;
    for (let i = 0; i < ratings.length; i++) ratings[i] = Math.min(high, Math.max(low, ratings[i]));
  }
  return { ratings, trueGroups };
}
