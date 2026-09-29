import { CHAPTERS, type ChapterRecipe, type PhantomVariant } from '../data/enemy-recipes';

export interface SpawnPick {
  variant: PhantomVariant;
  elite: boolean;
}

export type WaveKind = 'pincer' | 'dive-lane' | 'creeper-ring' | 'wither-line' | 'warden-cross';

export interface WaveCall {
  kind: WaveKind;
  label: string;
}

export interface BossDefeatResult {
  advanced: boolean;
  finished: boolean;
  /** Chapter index used for enemy stat scaling after this defeat. */
  chapterIndex: number;
}

/**
 * Data-driven chapter flow. Bosses arrive 45s or 12 kills into the chapter,
 * whichever comes first. Defeated bosses join later mob pools via CHAPTERS.
 */
export class EncounterSystem {
  chapterIndex = 0;
  killsThisChapter = 0;
  elapsedThisChapter = 0;
  bossAlive = false;
  finished = false;
  private waveClock = 0;
  private nextWaveAt = 14000;
  private waveStep = 0;

  reset(): void {
    this.chapterIndex = 0;
    this.killsThisChapter = 0;
    this.elapsedThisChapter = 0;
    this.bossAlive = false;
    this.finished = false;
    this.waveClock = 0;
    this.nextWaveAt = 14000;
    this.waveStep = 0;
  }

  get chapter(): ChapterRecipe {
    return CHAPTERS[Math.min(this.chapterIndex, CHAPTERS.length - 1)];
  }

  /** Stage multiplier passed to enemies. Grows after each boss falls. */
  get stage(): number {
    return this.chapterIndex;
  }

  addTime(ms: number): void {
    if (this.finished || this.bossAlive) return;
    this.elapsedThisChapter += ms;
    this.waveClock += ms;
  }

  /** A scripted pack between random spawns. Null while the timer is still running. */
  private wavePool(): WaveCall[] {
    const early: WaveCall[] = [
      { kind: 'pincer', label: '左右夹击' },
      { kind: 'dive-lane', label: '俯冲列' },
    ];
    if (this.chapterIndex >= 1) early.push({ kind: 'creeper-ring', label: '爆弹圈' });
    if (this.chapterIndex >= 3) early.push({ kind: 'wither-line', label: '凋零横排' });
    if (this.chapterIndex >= 4) early.push({ kind: 'warden-cross', label: '双光束' });
    return early;
  }

  peekWave(): boolean {
    return !this.finished && !this.bossAlive && this.waveClock >= this.nextWaveAt;
  }

  delayWave(ms: number): void {
    this.waveClock = Math.max(0, this.nextWaveAt - ms);
  }

  takeWave(stance: 'hold' | 'strafe' | 'rush' = 'rush'): WaveCall | null {
    if (!this.peekWave()) return null;
    this.waveClock = 0;
    this.nextWaveAt = 16000;
    const kinds = this.wavePool();
    const preferred: WaveKind = stance === 'hold' ? 'pincer' : stance === 'strafe' ? 'creeper-ring' : 'dive-lane';
    const wave = kinds.find((kind) => kind.kind === preferred) ?? kinds[this.waveStep % kinds.length];
    this.waveStep += 1;
    return { ...wave, label: `${wave.label} · ${stance === 'hold' ? '停着引来' : stance === 'strafe' ? '侧飞引来' : '直飞引来'}` };
  }

  onKill(wasBoss: boolean): void {
    if (wasBoss || this.finished) return;
    this.killsThisChapter += 1;
  }

  shouldSpawnBoss(): boolean {
    if (this.finished || this.bossAlive || this.chapterIndex >= CHAPTERS.length) return false;
    const chapter = this.chapter;
    return this.elapsedThisChapter >= chapter.bossAfterMs || this.killsThisChapter >= chapter.bossAfterKills;
  }

  bossVariant(): PhantomVariant | null {
    if (this.finished || this.chapterIndex >= CHAPTERS.length) return null;
    return this.chapter.boss;
  }

  onBossSpawned(): void {
    this.bossAlive = true;
  }

  onBossDefeated(): BossDefeatResult {
    this.bossAlive = false;
    this.chapterIndex += 1;
    this.killsThisChapter = 0;
    this.elapsedThisChapter = 0;
    this.waveClock = 0;
    this.nextWaveAt = 12000;
    this.waveStep = 0;
    this.finished = this.chapterIndex >= CHAPTERS.length;
    return { advanced: true, finished: this.finished, chapterIndex: this.chapterIndex };
  }

  nextSpawn(rng: () => number = Math.random): SpawnPick {
    const chapter = this.chapter;
    const pool = chapter.mobPool;
    const variant = pool[Math.floor(rng() * pool.length) % pool.length];
    const elite = rng() < chapter.eliteChance;
    if (!elite) return { variant, elite: false };
    const elitePool = pool.filter((id) => id !== 'phantom');
    if (elitePool.length === 0) return { variant: 'phantom', elite: true };
    return { variant: elitePool[Math.floor(rng() * elitePool.length) % elitePool.length], elite: true };
  }

  chapterLabel(): string {
    return `第 ${Math.min(CHAPTERS.length, this.chapterIndex + 1)} 章`;
  }
}
