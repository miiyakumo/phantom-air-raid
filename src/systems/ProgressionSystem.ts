export interface ProgressionState {
  level: number; xp: number; attack: number; fireInterval: number;
  projectileCount: number; maxHealth: number; speed: number;
  closeDamage: number; closeRange: number; comboPower: number;
  pierce: number; magnet: number; vent: number; flankStance: number; rushStance: number;
}

export class ProgressionSystem {
  readonly state: ProgressionState = {
    level: 1, xp: 0, attack: 18, fireInterval: 360, projectileCount: 1,
    maxHealth: 100, speed: 220, closeDamage: 0.2, closeRange: 140,
    comboPower: 0.08, pierce: 0, magnet: 88,
    // Retained for old snapshots; basic growth no longer depends on posture.
    vent: 0, flankStance: 0, rushStance: 0,
  };

  addExperience(amount: number, _stance: 'strafe' | 'rush' | 'still' = 'still'): boolean {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Experience must be finite and nonnegative');
    this.state.xp += amount;
    let leveled = false;
    while (this.state.xp >= this.need()) {
      this.state.xp -= this.need();
      this.state.level += 1;
      this.state.attack = Math.ceil(this.state.attack * 1.1);
      this.state.fireInterval = Math.max(85, this.state.fireInterval - 6);
      this.state.maxHealth += 8;
      if (this.state.level % 4 === 0) this.state.projectileCount = Math.min(4, this.state.projectileCount + 1);
      leveled = true;
    }
    return leveled;
  }

  need(): number { return 8 + this.state.level * 3; }
}
