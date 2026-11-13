// The Library: every one of the 29,940,480 loop glyphs, each exactly once, in a fixed
// scrambled order, any of them reachable directly by number.
//
// An *ordering* puts point 0 first and the other 12 points after it: 12! = 479,001,600 of
// them, numbered by their Lehmer code. Each glyph is drawn by exactly 16 orderings (two
// directions x eight orientations); exactly one of those is its canonical form: the one whose
// loop code is smallest over the symmetries (see canonicalCode in glyph-text.js).
//
// Wall position p (0 .. 12!-1) shows ordering shuffle(p): a Feistel permutation, so the order
// looks random but visits every ordering once. Positions whose ordering is not canonical are
// skipped, so every glyph appears once. To find glyph number n without scanning from the start,
// an index records how many canonical orderings each block of BLOCK positions holds.

export const ORDERINGS = 479001600;          // 12!
export const BLOCK = 4096;
export const BLOCKS = Math.ceil(ORDERINGS / BLOCK);
export const KEY = 0x5ee6175;                 // fixes the wall's order; change it to reshuffle

// ---------------------------------------------------------------- shuffle

function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** A 4-round Feistel permutation of 30-bit numbers. */
function permute30(x, key) {
  let L = x >>> 15, R = x & 0x7fff;
  for (let r = 0; r < 4; r++) {
    const F = mix(R ^ ((key + Math.imul(r + 1, 0x9e3779b9)) | 0)) & 0x7fff;
    [L, R] = [R, L ^ F];
  }
  return (L << 15) | R;
}

/** A bijection of [0, n) for n <= 2^30: the Feistel permutation, cycle-walked into range. */
export function shuffle(i, n = ORDERINGS, key = KEY) {
  let x = i;
  do x = permute30(x, key); while (x >= n);
  return x;
}

// ---------------------------------------------------------------- orderings

const FACT = [1];
for (let i = 1; i <= 12; i++) FACT[i] = FACT[i - 1] * i;

/** Ordering number k (0 .. 12!-1) as a loop: [0, then the other 12 points]. */
export function unrank(k) {
  const avail = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const loop = [0];
  for (let i = 11; i >= 0; i--) {
    const f = FACT[i];
    const idx = Math.floor(k / f);
    k -= idx * f;
    loop.push(avail.splice(idx, 1)[0]);
  }
  return loop;
}

/** The ordering number of a loop that starts at 0 (inverse of unrank). */
export function rank(loop) {
  const avail = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let k = 0;
  for (let i = 1; i <= 12; i++) {
    const idx = avail.indexOf(loop[i]);
    k += idx * FACT[12 - i];
    avail.splice(idx, 1);
  }
  return k;
}

/**
 * Is this ordering the canonical form of its glyph? It must already be in loop-code direction
 * (second point smaller than the last), and no symmetry image may have a smaller code.
 * Written for speed: most orderings are rejected after a comparison or two.
 */
export function isCanonical(loop, symmetries) {
  if (loop[1] > loop[12]) return false;
  const q = new Array(13);
  for (const s of symmetries) {
    let z = 0;
    for (let i = 0; i < 13; i++) {
      q[i] = s[loop[i]];
      if (q[i] === 0) z = i;
    }
    // the image as a loop code: start at 0, step in the direction with the smaller next point
    const step = q[(z + 1) % 13] <= q[(z + 12) % 13] ? 1 : 12;
    for (let j = 1; j <= 12; j++) {
      const v = q[(z + step * j) % 13];
      if (v < loop[j]) return false;   // this image has a smaller code
      if (v > loop[j]) break;          // larger: this symmetry cannot beat it
    }
  }
  return true;
}

/** The canonical loops found in block b, in wall order, each with its wall position. */
export function scanBlock(b, symmetries) {
  const out = [];
  const end = Math.min(ORDERINGS, (b + 1) * BLOCK);
  for (let p = b * BLOCK; p < end; p++) {
    const loop = unrank(shuffle(p));
    if (isCanonical(loop, symmetries)) out.push({ position: p, loop });
  }
  return out;
}

// ---------------------------------------------------------------- the index

/** Glyph number n -> its loop, using the per-block counts. */
export class Library {
  constructor(counts, symmetries, cacheSize = 24) {
    this.symmetries = symmetries;
    this.prefix = new Float64Array(counts.length + 1);
    for (let b = 0; b < counts.length; b++) this.prefix[b + 1] = this.prefix[b] + counts[b];
    this.size = this.prefix[counts.length];
    this.cache = new Map();
    this.cacheSize = cacheSize;
  }

  block(b) {
    let hit = this.cache.get(b);
    if (hit) {
      this.cache.delete(b);
      this.cache.set(b, hit);                // most recently used
      return hit;
    }
    hit = scanBlock(b, this.symmetries);
    this.cache.set(b, hit);
    if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value);
    return hit;
  }

  /** Glyph n (0-based) as { n, position, loop }. */
  glyph(n) {
    if (!(n >= 0 && n < this.size)) throw new RangeError(`glyph ${n} is outside 0..${this.size - 1}`);
    let lo = 0, hi = this.prefix.length - 1;      // largest b with prefix[b] <= n
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.prefix[mid] <= n) lo = mid; else hi = mid;
    }
    return { n, ...this.block(lo)[n - this.prefix[lo]] };
  }
}
