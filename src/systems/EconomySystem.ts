import { ECONOMY } from '../data/game-config';
import type { ProgressionState, ProgressionSystem } from './ProgressionSystem';

export type DropRank = 'normal' | 'elite' | 'boss';
export type EnchantId = 'sharpness' | 'haste' | 'vitality' | 'riposte' | 'pierce' | 'magnet';
export type ShopId = 'diamond-sword' | 'golden-apple' | 'swiftness-boots' | 'hook';
export interface EnchantOffer { id: EnchantId; label: string }
export interface ShopOffer { id: ShopId; label: string; price: number; available: boolean }
export interface PurchaseResult { ok: boolean; price: number; gems: number; heal: number }
export interface DropResult { rank: DropRank; xp: number; gems: number; levelsGained: number; heal: number }

/** Run-local resources. An upgrade's candidates remain fixed until consumed. */
export class EconomySystem {
  gems = 0; purchases = 0; pendingUpgrades = 0; hooks = 0; apples = 0;
  private pendingOffers?: EnchantOffer[];

  reset(): void {
    this.gems = this.purchases = this.pendingUpgrades = this.hooks = this.apples = 0;
    this.pendingOffers = undefined;
  }
  preview(rank: DropRank, roll = Math.random()): { xp: number; gems: number; heal: number } {
    const reward = ECONOMY.rewards[rank];
    return { xp: reward.xp, gems: reward.gems, heal: roll < reward.healChance ? reward.healAmount : 0 };
  }
  grant(xp: number, gems: number, progression: ProgressionSystem, stance: 'strafe' | 'rush' | 'still' = 'still'): number {
    if (!Number.isFinite(gems) || gems < 0) throw new RangeError('Gems must be finite and nonnegative');
    const before = progression.state.level;
    progression.addExperience(xp, stance);
    this.gems += gems;
    const levels = progression.state.level - before;
    this.pendingUpgrades += levels;
    return levels;
  }
  collect(rank: DropRank, progression: ProgressionSystem, roll = Math.random(), stance: 'strafe' | 'rush' | 'still' = 'still'): DropResult {
    const reward = this.preview(rank, roll);
    const levelsGained = this.grant(reward.xp, reward.gems, progression, stance);
    return { rank, ...reward, levelsGained, heal: levelsGained ? ECONOMY.levelUpHeal : reward.heal };
  }
  offers(): EnchantOffer[] {
    return [
      { id: 'sharpness', label: '锋利 · 所有三叉戟伤害 +18%' },
      { id: 'haste', label: '急迫 · 射击间隔 -10%' },
      { id: 'vitality', label: '红石心脏 · 生命上限 +30，并回复 30' },
      { id: 'riposte', label: '近战附魔 · 近距增伤 +20%，范围 +15' },
      { id: 'pierce', label: '穿透 · 三叉戟额外穿过一个敌人' },
      { id: 'magnet', label: '磁石 · 自动拾取范围 +35' },
    ];
  }
  rollOffers(rng: () => number = Math.random): EnchantOffer[] {
    if (!this.pendingOffers) {
      const pool = this.offers();
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.pendingOffers = pool.slice(0, 3);
    }
    return this.pendingOffers.map(offer => ({ ...offer }));
  }
  applyEnchant(id: EnchantId, state: ProgressionState): number {
    if (id === 'sharpness') state.attack = Math.ceil(state.attack * 1.18);
    else if (id === 'haste') state.fireInterval = Math.max(85, state.fireInterval * 0.9);
    else if (id === 'vitality') { state.maxHealth += 30; return 30; }
    else if (id === 'riposte') { state.closeDamage += 0.2; state.closeRange = Math.min(220, state.closeRange + 15); }
    else if (id === 'pierce') state.pierce += 1;
    else if (id === 'magnet') state.magnet += 35;
    return 0;
  }
  consumeUpgrade(): void {
    if (this.pendingUpgrades <= 0) return;
    this.pendingUpgrades -= 1;
    this.pendingOffers = undefined;
  }
  pricedOffer(id: ShopId, speed: number): ShopOffer {
    const price = ECONOMY.shop.damagePrice + this.purchases * ECONOMY.shop.priceStep;
    if (id === 'diamond-sword') return { id, label: `钻石剑 · 伤害 +25% · ${price} ◆`, price, available: true };
    if (id === 'golden-apple') return { id, label: `金苹果 · G 回复一半生命 · ${ECONOMY.shop.healPrice} ◆（${this.apples}/3）`, price: ECONOMY.shop.healPrice, available: this.apples < 3 };
    if (id === 'hook') return { id, label: `末影钩爪 · F 拉近并打断 · ${ECONOMY.shop.hookPrice} ◆（${this.hooks}/3）`, price: ECONOMY.shop.hookPrice, available: this.hooks < 3 };
    const capped = speed >= ECONOMY.shop.speedCap;
    return { id, label: `疾行靴 · 移速 +15 · ${price} ◆${capped ? '（已满）' : ''}`, price, available: !capped };
  }
  catalog(speed: number): ShopOffer[] {
    return (['diamond-sword', 'golden-apple', 'swiftness-boots', 'hook'] as ShopId[]).map(id => this.pricedOffer(id, speed));
  }
  purchase(id: ShopId, state: ProgressionState): PurchaseResult {
    const offer = this.pricedOffer(id, state.speed);
    if (!offer.available || this.gems < offer.price) return { ok: false, price: offer.price, gems: this.gems, heal: 0 };
    this.gems -= offer.price;
    if (id === 'diamond-sword') { this.purchases += 1; state.attack = Math.ceil(state.attack * ECONOMY.shop.damageMultiplier); }
    else if (id === 'golden-apple') this.apples += 1;
    else if (id === 'hook') this.hooks += 1;
    else { this.purchases += 1; state.speed = Math.min(ECONOMY.shop.speedCap, state.speed + ECONOMY.shop.speedStep); }
    return { ok: true, price: offer.price, gems: this.gems, heal: 0 };
  }
}
