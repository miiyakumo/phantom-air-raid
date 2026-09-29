export type PhantomVariant = 'phantom' | 'rider' | 'creeper' | 'firework' | 'wither' | 'warden';

export interface EnemyRecipe {
  id: PhantomVariant;
  name: string;
  /** First appearance role. Later chapters demote bosses into the mob/elite pool. */
  debut: 'mob' | 'boss';
  threat: number;
}

export const RECIPES: Record<PhantomVariant, EnemyRecipe> = {
  phantom: { id: 'phantom', name: '幻翼', debut: 'mob', threat: 1 },
  rider: { id: 'rider', name: '小僵尸骑士·幻翼', debut: 'boss', threat: 2 },
  creeper: { id: 'creeper', name: '苦力怕·幻翼', debut: 'boss', threat: 3 },
  firework: { id: 'firework', name: '烟花苦力怕·幻翼', debut: 'boss', threat: 4 },
  wither: { id: 'wither', name: '凋零头·幻翼', debut: 'boss', threat: 5 },
  warden: { id: 'warden', name: '监守者·凋零·幻翼', debut: 'boss', threat: 6 },
};

export interface ChapterRecipe {
  index: number;
  boss: PhantomVariant;
  /** Includes the base phantom plus every boss demoted by earlier chapters. */
  mobPool: PhantomVariant[];
  eliteChance: number;
  bossAfterMs: number;
  bossAfterKills: number;
}

const BOSS_ORDER: PhantomVariant[] = ['rider', 'creeper', 'firework', 'wither', 'warden'];

export const CHAPTERS: ChapterRecipe[] = BOSS_ORDER.map((boss, index) => ({
  index,
  boss,
  mobPool: ['phantom', ...BOSS_ORDER.slice(0, index)],
  eliteChance: Math.min(0.2, 0.08 + index * 0.02),
  bossAfterMs: 45_000,
  bossAfterKills: 12,
}));

export const ENEMY_NAMES: Record<PhantomVariant, string> = {
  phantom: RECIPES.phantom.name,
  rider: RECIPES.rider.name,
  creeper: RECIPES.creeper.name,
  firework: RECIPES.firework.name,
  wither: RECIPES.wither.name,
  warden: RECIPES.warden.name,
};
