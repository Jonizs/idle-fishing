// Server-side rolls.
//
// Every random outcome in the game — catch rolls, struck, enchanted, gold,
// double drop, mutations, crates, the 0.005% scroll drop — is rolled here and
// nowhere else. If the client rolls, the client rerolls until it likes the
// answer, and that is the entire reason the save is moving off it.
//
// mulberry32: small, fast, and deterministic, which matters more than
// cryptographic quality. The seed a batch of rolls started from goes into the
// action log, so any result in the log can be replayed and checked.

export const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);

export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // The chance helpers the game phrases everything in.
    chance: p => next() < p,
    int: n => Math.floor(next() * n),
    // Where the seed has got to, so it can be stored and carried on from.
    seed: () => s >>> 0,
  };
}
