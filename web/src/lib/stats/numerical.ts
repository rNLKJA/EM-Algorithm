/**
 * Small dense linear algebra and a finite-difference Hessian, enough for the
 * five-parameter observed information matrix of a two-component mixture.
 */

export type Matrix = number[][];

/**
 * Hessian of `f` at `x` by central differences. Step h_i = relStep × max(|x_i|, 1):
 * about eps^(1/4) balances truncation (O(h²)) against round-off (O(eps |f| / h²)).
 * Diagonal: [f(x + h e_i) - 2 f(x) + f(x - h e_i)] / h_i²;
 * off-diagonal: the four-point formula, symmetric by construction.
 */
export function numericalHessian(
  f: (x: number[]) => number,
  x: readonly number[],
  relStep = 1e-4,
): Matrix {
  const n = x.length;
  const h = x.map((v) => relStep * Math.max(Math.abs(v), 1));
  const at = (deltas: [number, number][]) => {
    const y = [...x];
    for (const [i, d] of deltas) y[i] += d;
    return f(y);
  };
  const f0 = f([...x]);
  const H: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    H[i][i] = (at([[i, h[i]]]) - 2 * f0 + at([[i, -h[i]]])) / (h[i] * h[i]);
    for (let j = i + 1; j < n; j++) {
      const v =
        (at([
          [i, h[i]],
          [j, h[j]],
        ]) -
          at([
            [i, h[i]],
            [j, -h[j]],
          ]) -
          at([
            [i, -h[i]],
            [j, h[j]],
          ]) +
          at([
            [i, -h[i]],
            [j, -h[j]],
          ])) /
        (4 * h[i] * h[j]);
      H[i][j] = v;
      H[j][i] = v;
    }
  }
  return H;
}

/** Inverse by Gauss-Jordan elimination with partial pivoting; null if (numerically) singular. */
export function invertMatrix(A: Matrix): Matrix | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...A.flat().map(Math.abs), 1e-300);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (!(Math.abs(M[pivot][col]) > 1e-13 * scale)) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const p = M[col][col];
    for (let c = 0; c < 2 * n; c++) M[col][c] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = 0; c < 2 * n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row.slice(n));
}

/** True when the symmetric matrix A is positive definite (a Cholesky factorisation exists). */
export function isPositiveDefinite(A: Matrix): boolean {
  const n = A.length;
  const L: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0)) return false;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return true;
}

export function negate(A: Matrix): Matrix {
  return A.map((row) => row.map((v) => -v));
}
