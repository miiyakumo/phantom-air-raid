import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { drawPixelArena } from '../systems/Visuals';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    drawPixelArena(this);
    this.add.rectangle(480, 270, 960, 540, 0x111824, 0.72);
    const g = this.add.graphics();
    g.fillStyle(0x254144).fillRect(100, 54, 760, 428);
    g.fillStyle(0x719383).fillRect(100, 54, 760, 4).fillRect(100, 54, 4, 428);
    g.fillStyle(0x101f2a).fillRect(104, 58, 752, 420);
    g.fillStyle(0x20333a).fillRect(124, 250, 712, 120);
    this.add.text(480, 82, 'END REALM  /  末地远征', { color: '#8fe3c6', fontSize: '14px', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(480, 132, '幻翼合体', { color: '#f2e7be', fontSize: '50px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(480, 177, '一把三叉戟，飞过整片末地。', { color: '#a4b7b6', fontSize: '17px' }).setOrigin(0.5);
    const best = new SaveSystem().load();
    this.add.text(480, 200, `最高 LV ${best.bestLevel} · 击败 ${best.bestKills}`, { color: '#ffe28a', fontSize: '14px' }).setOrigin(0.5);
    for (const [i, key] of ['phantom', 'riderPhantom', 'creeperPhantom', 'fireworkPhantom', 'witherPhantom', 'wardenPhantom'].entries()) {
      this.add.image(240 + i * 96, 222, key).setDisplaySize(56, 42);
    }
    this.add.text(480, 273, 'WASD / 方向键移动 · 点击或 Q 锁定 · F 钩爪 · 空格朝移动方向冲刺 · E 商店', { color: '#ecedce', fontSize: '17px' }).setOrigin(0.5);
    this.add.text(480, 307, '升级随机三选一 · 贴身打出更高伤害 · 连击越久越痛 · P 暂停', { color: '#a4dbca', fontSize: '17px' }).setOrigin(0.5);
    this.add.text(480, 342, '5 场首领战 · 终局由你决定撤离时机 · 触屏拖动移动', { color: '#a6b3bb', fontSize: '15px' }).setOrigin(0.5);
    const start = this.add.text(480, 411, '开启远征  →', {
      backgroundColor: '#3d8064', color: '#f2f3d5', fontSize: '24px', fontStyle: 'bold', padding: { x: 45, y: 13 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    start.on('pointerover', () => start.setBackgroundColor('#529778'));
    start.on('pointerout', () => start.setBackgroundColor('#3d8064'));
    start.on('pointerdown', () => this.scene.start('Battle'));
    this.add.text(480, 461, '原创程序像素素材 · Minecraft 风格同人作品', { color: '#728c91', fontSize: '12px' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Battle'));
  }
}
