export function makeDeterministicRng(sequence: number[]): () => number {
  let i = 0;
  const len = sequence.length;
  return () => {
    const v = sequence[i % len] || 0;
    i++;
    return Math.min(0.999999, Math.max(0, v));
  };
}

export function makeLinearRng(start = 0.1, step = 0.137, mod = 1): () => number {
  let cur = start;
  return () => {
    const out = cur % mod;
    cur = (cur + step) % mod;
    return out;
  };
}


