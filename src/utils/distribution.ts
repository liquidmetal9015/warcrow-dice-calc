import type { Distribution, JointDistribution } from '../domain/dice';

export function incJoint(map: JointDistribution, x: number, y: number): void {
  if (!map[x]) map[x] = {} as Record<number, number>;
  map[x][y] = (map[x][y] || 0) + 1;
}

export function normalizeDistribution(map: Distribution, n: number): void {
  for (const k of Object.keys(map)) {
    const key = Number(k);
    const current = map[key] ?? 0;
    map[key] = (current / n) * 100;
  }
}

export function normalizeJoint(map: JointDistribution, n: number): void {
  for (const x of Object.keys(map)) {
    const xi = Number(x);
    const row = map[xi];
    if (!row) { map[xi] = {}; continue; }
    for (const y of Object.keys(row)) {
      const yi = Number(y);
      const val = row[yi] || 0;
      row[yi] = (val / n) * 100;
    }
    map[xi] = row;
  }
}


