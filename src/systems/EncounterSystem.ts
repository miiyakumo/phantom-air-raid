import { CHAPTERS, type ChapterRecipe, type PhantomVariant } from '../data/enemy-recipes';
export interface SpawnPick { variant: PhantomVariant; elite: boolean }
export type WaveKind = 'pincer' | 'dive-lane' | 'creeper-ring' | 'wither-line' | 'warden-cross';
export interface WaveCall { kind: WaveKind; label: string }
export interface BossDefeatResult { advanced: boolean; finished: boolean; chapterIndex: number }

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
    this.chapterIndex = this.killsThisChapter = this.elapsedThisChapter = this.waveClock = this.waveStep = 0;
    this.bossAlive = this.finished = false; this.nextWaveAt = 14000;
  }
  get chapter(): ChapterRecipe { return CHAPTERS[Math.min(this.chapterIndex, CHAPTERS.length - 1)]; }
  get stage(): number { return this.chapterIndex; }
  addTime(ms: number): void {
    if (this.finished || this.bossAlive) return;
    this.elapsedThisChapter += ms; this.waveClock += ms;
  }
  private wavePool(): WaveCall[] {
    const waves: WaveCall[] = [{ kind: 'pincer', label: '左右夹击' }, { kind: 'dive-lane', label: '俯冲列' }];
    // Never introduce a boss as a normal enemy before that boss has been defeated.
    if (this.chapterIndex >= 2) waves.push({ kind: 'creeper-ring', label: '爆弹圈' });
    if (this.chapterIndex >= 4) waves.push({ kind: 'wither-line', label: '凋零横排' });
    return waves;
  }
  peekWave(): boolean { return !this.finished && !this.bossAlive && this.waveClock >= this.nextWaveAt; }
  delayWave(ms: number): void { this.waveClock = Math.max(0, this.nextWaveAt - ms); }
  takeWave(_stance: 'hold' | 'strafe' | 'rush' = 'rush'): WaveCall | null {
    if (!this.peekWave()) return null;
    this.waveClock = 0; this.nextWaveAt = 16000;
    const pool = this.wavePool();
    return { ...pool[this.waveStep++ % pool.length] };
  }
  onKill(wasBoss: boolean): void { if (!wasBoss && !this.finished) this.killsThisChapter += 1; }
  shouldSpawnBoss(): boolean {
    return !this.finished && !this.bossAlive && (this.elapsedThisChapter >= this.chapter.bossAfterMs || this.killsThisChapter >= this.chapter.bossAfterKills);
  }
  bossVariant(): PhantomVariant | null { return this.finished ? null : this.chapter.boss; }
  onBossSpawned(): void { if (!this.finished) this.bossAlive = true; }
  onBossDefeated(): BossDefeatResult {
    if (!this.bossAlive || this.finished) return { advanced: false, finished: this.finished, chapterIndex: this.chapterIndex };
    this.bossAlive = false; this.chapterIndex += 1;
    this.killsThisChapter = this.elapsedThisChapter = this.waveClock = this.waveStep = 0;
    this.nextWaveAt = 12000; this.finished = this.chapterIndex >= CHAPTERS.length;
    return { advanced: true, finished: this.finished, chapterIndex: this.chapterIndex };
  }
  nextSpawn(rng: () => number = Math.random): SpawnPick {
    const pool = this.chapter.mobPool;
    const variant = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)))];
    return { variant, elite: rng() < this.chapter.eliteChance };
  }
  chapterLabel(): string { return `第 ${Math.min(CHAPTERS.length, this.chapterIndex + 1)} 章`; }
}
