/** Pure combat rules shared by the game and regression tests. Units are ms/px. */
export const COMBAT = {
  dashCooldown: 4000,
  dashDistance: 160,
  dashInvulnerability: 260,
  chapterRest: 5000,
  maxEnemies: 36,
  maxEnemyShots: 80,
  maxPlayerShots: 120,
  spawnInterval: 1050,
} as const;

export interface VolleyShot { offset: number; multiplier: number }

/** Always retain the full-strength, on-axis shot. Extra lanes are additional. */
export function volleyPattern(count: number, volley = 0): VolleyShot[] {
  const size = Math.max(1, Math.min(4, Math.floor(count)));
  return Array.from({ length: size }, (_, i) => ({
    offset: i === 0 ? 0 : Math.ceil(i / 2) * 0.12 * (i % 2 ? -1 : 1) * (volley % 2 ? -1 : 1),
    multiplier: i === 0 ? 1 : 0.55,
  }));
}

export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** A cast can damage each target once, regardless of render/physics frequency. */
export class CastHits {
  private hits = new Set<object>();
  reset(): void { this.hits.clear(); }
  has(target: object): boolean { return this.hits.has(target); }
  mark(target: object): void { this.hits.add(target); }
}
