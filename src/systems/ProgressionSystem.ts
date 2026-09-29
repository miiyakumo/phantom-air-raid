export interface ProgressionState {
  level: number;
  xp: number;
  attack: number;
  fireInterval: number;
  projectileCount: number;
  maxHealth: number;
  speed: number;
  /** Extra damage multiplier applied only inside closeRange. */
  closeDamage: number;
  closeRange: number;
  /** Bonus damage multiplier per combo step, capped. */
  comboPower: number;
  pierce: number;
  /** Pickup magnet radius in pixels. */
  magnet: number;
  /** Heat removed from every shot. */
  vent: number;
  /** Damage bonus that only applies while strafing. */
  flankStance: number;
  /** Fire-rate bonus that only applies while flying straight at the target. */
  rushStance: number;
}

export class ProgressionSystem {
  readonly state: ProgressionState = {
    level: 1,
    xp: 0,
    attack: 18,
    fireInterval: 360,
    projectileCount: 1,
    maxHealth: 100,
    speed: 220,
    closeDamage: 0.35,
    closeRange: 150,
    comboPower: 0.08,
    pierce: 0,
    magnet: 72,
    vent: 0,
    flankStance: 0,
    rushStance: 0,
  };

  addExperience(amount: number, stance: 'strafe' | 'rush' | 'still' = 'still'): boolean {
    this.state.xp += amount;
    let leveled = false;
    while (this.state.xp >= this.need()) {
      this.state.xp -= this.need();
      this.state.level += 1;
      if (stance === 'strafe') {
        this.state.attack = Math.round(this.state.attack * 1.18);
        this.state.fireInterval = Math.min(520, this.state.fireInterval + 12);
      } else if (stance === 'rush') {
        this.state.fireInterval = Math.max(120, this.state.fireInterval - 16);
        this.state.attack = Math.max(8, Math.round(this.state.attack * 0.94));
      } else {
        this.state.maxHealth += 14;
        this.state.attack = Math.max(8, Math.round(this.state.attack * 0.96));
      }
      if (this.state.level % 4 === 0) this.state.projectileCount = Math.min(4, this.state.projectileCount + 1);
      leveled = true;
    }
    return leveled;
  }

  need(): number { return 8 + this.state.level * 3; }
}
