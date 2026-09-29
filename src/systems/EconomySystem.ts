import { ECONOMY, type EconomyReward } from '../data/game-config';
import type { ProgressionState, ProgressionSystem } from './ProgressionSystem';

export type DropRank = 'normal' | 'elite' | 'boss';
export type EnchantId = 'sharpness' | 'haste' | 'vitality' | 'riposte' | 'pierce' | 'magnet';
export type ShopId = 'diamond-sword' | 'golden-apple' | 'swiftness-boots' | 'hook';

export interface DropResult {
  rank: DropRank;
  xp: number;
  gems: number;
  levelsGained: number;
  heal: number;
}

export interface EnchantOffer {
  id: EnchantId;
  label: string;
}

export interface ShopOffer {
  id: ShopId;
  label: string;
  price: number;
  available: boolean;
}

export interface PurchaseResult {
  ok: boolean;
  price: number;
  gems: number;
  heal: number;
}

function rewardFor(rank: DropRank): EconomyReward {
  return ECONOMY.rewards[rank];
}

/** Run-only emeralds, experience and purchases. Nothing here persists between runs. */
export class EconomySystem {
  gems = 0;
  purchases = 0;
  pendingUpgrades = 0;
  hooks = 0;
  apples = 0;

  reset(): void {
    this.gems = 0;
    this.purchases = 0;
    this.pendingUpgrades = 0;
    this.hooks = 0;
    this.apples = 0;
  }

  preview(rank: DropRank, roll = Math.random()): { xp: number; gems: number; heal: number } {
    const reward = rewardFor(rank);
    return { xp: reward.xp, gems: reward.gems, heal: roll < reward.healChance ? reward.healAmount : 0 };
  }

  grant(xp: number, gems: number, progression: ProgressionSystem, stance: 'strafe' | 'rush' | 'still'): number {
    this.gems += gems;
    const previous = progression.state.level;
    progression.addExperience(xp, stance);
    const levelsGained = progression.state.level - previous;
    this.pendingUpgrades += levelsGained;
    return levelsGained;
  }

  collect(rank: DropRank, progression: ProgressionSystem, roll = Math.random(), stance: 'strafe' | 'rush' | 'still' = 'still'): DropResult {
    const reward = rewardFor(rank);
    this.gems += reward.gems;
    const previous = progression.state.level;
    progression.addExperience(reward.xp, stance);
    const levelsGained = progression.state.level - previous;
    this.pendingUpgrades += levelsGained;
    const heal = levelsGained > 0
      ? ECONOMY.levelUpHeal
      : roll < reward.healChance ? reward.healAmount : 0;
    return { rank, xp: reward.xp, gems: reward.gems, levelsGained, heal };
  }

  offers(): EnchantOffer[] {
    return [
      { id: 'sharpness', label: '锋利附魔 · 侧飞伤害 +16%，直飞攻速 -8%' },
      { id: 'haste', label: '急迫附魔 · 直飞攻速 +10%，侧飞伤害 -8%' },
      { id: 'vitality', label: '红石心脏 · 最大生命 -30，射击少积 4 热' },
      { id: 'riposte', label: '贴身战 · 直冲近距伤害 +25%，判定 +20' },
      { id: 'pierce', label: '穿透 · 按住 C 才穿下一个，当发伤害 -20%' },
      { id: 'magnet', label: '磁石 · 按住 B 扩大拾取，同时吸来敌弹' },
    ];
  }

  /** Three distinct choices, shuffled so the table is not always the same three. */
  rollOffers(rng: () => number = Math.random): EnchantOffer[] {
    const pool = [...this.offers()];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  applyEnchant(id: EnchantId, state: ProgressionState): number {
    if (id === 'sharpness') {
      state.flankStance = Math.min(0.64, state.flankStance + 0.16);
      state.rushStance = Math.max(0, state.rushStance - 0.08);
      return 0;
    }
    if (id === 'haste') {
      state.rushStance = Math.min(0.4, state.rushStance + 0.1);
      state.flankStance = Math.max(0, state.flankStance - 0.08);
      return 0;
    }
    if (id === 'riposte') {
      state.closeDamage = Math.min(1.6, state.closeDamage + 0.25);
      state.closeRange = Math.min(240, state.closeRange + 20);
      return 0;
    }
    if (id === 'pierce') {
      state.pierce = Math.min(3, state.pierce + 1);
      return 0;
    }
    if (id === 'magnet') {
      state.magnet = Math.min(240, state.magnet + 40);
      return 0;
    }
    state.maxHealth = Math.max(40, state.maxHealth - 30);
    state.vent = Math.min(8, state.vent + 4);
    return 0;
  }

  consumeUpgrade(): void {
    this.pendingUpgrades = Math.max(0, this.pendingUpgrades - 1);
  }

  pricedOffer(id: ShopId, speed: number): ShopOffer {
    const scaling = ECONOMY.shop.damagePrice + this.purchases * ECONOMY.shop.priceStep;
    if (id === 'diamond-sword') {
      return { id, label: `钻石剑 ${scaling} ◆ · 伤害 +25%，射击多积 3 热`, price: scaling, available: true };
    }
    if (id === 'golden-apple') {
      return { id, label: `金苹果 35 ◆ · 回中心按 G 回 50% 并清零热量${this.apples ? `（已有 ${this.apples}）` : ''}`, price: ECONOMY.shop.healPrice, available: true };
    }
    if (id === 'hook') {
      return { id, label: `末影钩爪 ${ECONOMY.shop.hookPrice} ◆ · 把锁定目标拉到身边并破绽`, price: ECONOMY.shop.hookPrice, available: this.hooks < 3 };
    }
    const capped = speed >= ECONOMY.shop.speedCap;
    return {
      id,
      label: `疾行靴 ${scaling} ◆ · 移速 +15，伤害 -8%`,
      price: scaling,
      available: !capped,
    };
  }

  catalog(speed: number): ShopOffer[] {
    return (['diamond-sword', 'golden-apple', 'swiftness-boots', 'hook'] as ShopId[])
      .map((id) => this.pricedOffer(id, speed));
  }

  purchase(id: ShopId, state: ProgressionState): PurchaseResult {
    const offer = this.pricedOffer(id, state.speed);
    if (!offer.available || this.gems < offer.price) {
      return { ok: false, price: offer.price, gems: this.gems, heal: 0 };
    }
    this.gems -= offer.price;
    let heal = 0;
    if (id === 'diamond-sword') {
      this.purchases += 1;
      state.attack = Math.ceil(state.attack * ECONOMY.shop.damageMultiplier);
      state.vent = Math.max(-9, state.vent - 3);
    } else if (id === 'golden-apple') {
      this.apples = Math.min(3, this.apples + 1);
    } else if (id === 'hook') {
      this.hooks = Math.min(3, this.hooks + 1);
    } else {
      this.purchases += 1;
      state.speed = Math.min(ECONOMY.shop.speedCap, state.speed + ECONOMY.shop.speedStep);
      state.attack = Math.max(8, Math.round(state.attack * 0.92));
    }
    return { ok: true, price: offer.price, gems: this.gems, heal };
  }
}
