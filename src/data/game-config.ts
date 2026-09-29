export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const GAME_COLORS = {
  void: 0x19112d,
  ender: 0x7357a5,
  panel: 0x27173e,
  gold: 0xffd467,
  text: '#fff1c7',
} as const;

export interface EconomyReward {
  xp: number;
  gems: number;
  healChance: number;
  healAmount: number;
}

export const ECONOMY = {
  rewards: {
    normal: { xp: 1, gems: 2, healChance: 0.06, healAmount: 12 },
    elite: { xp: 3, gems: 5, healChance: 0.06, healAmount: 12 },
    boss: { xp: 35, gems: 100, healChance: 0, healAmount: 0 },
  },
  levelUpHeal: 25,
  shop: {
    damagePrice: 50,
    priceStep: 30,
    damageMultiplier: 1.25,
    healPrice: 35,
    healFraction: 0.5,
    speedPrice: 50,
    speedStep: 15,
    speedCap: 340,
    hookPrice: 45,
  },
  enchant: {
    attackMultiplier: 1.18,
    fireRateMultiplier: 0.9,
    minFireInterval: 85,
    healthBonus: 20,
    heal: 40,
  },
} as const;
