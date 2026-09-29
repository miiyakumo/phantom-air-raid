import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { drawPixelArena } from '../systems/Visuals';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create(): void {
    drawPixelArena(this);
    this.add.rectangle(480, 270, 960, 540, 0x111824, 0.75);
    this.add.rectangle(480, 270, 760, 430, 0x15252e).setStrokeStyle(3, 0x719383);
    this.add.text(480, 112, '幻翼合体：空袭升级', { color: '#f2e7be', fontSize: '38px', fontStyle: 'bold' }).setOrigin(0.5);
    const best = new SaveSystem().load();
    this.add.text(480, 160, `最高 LV ${best.bestLevel} · 击败 ${best.bestKills}`, { color: '#ffe28a', fontSize: '15px' }).setOrigin(0.5);
    for (const [i, key] of ['phantom', 'riderPhantom', 'creeperPhantom', 'fireworkPhantom', 'witherPhantom', 'wardenPhantom'].entries()) this.add.image(240 + i * 96, 212, key).setDisplaySize(56, 42);
    const lines = [
      '自动攻击 · WASD / 方向键 / 触屏拖动移动',
      '空格或屏幕按钮冲刺 · 点击敌人 / Q 切换锁定',
      'E 升级与商店 · F 使用钩爪 · G 吃金苹果 · P 暂停',
      '躲过预警，利用收招破绽 · 五场首领战，胜利后休整',
    ];
    lines.forEach((text, i) => this.add.text(480, 266 + i * 32, text, { color: i ? '#accbc4' : '#ecedce', fontSize: '17px' }).setOrigin(0.5));
    const start = this.add.text(480, 424, '开始远征', { backgroundColor: '#3d8064', color: '#f2f3d5', fontSize: '23px', padding: { x: 50, y: 12 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => this.scene.start('Battle'));
    const enter = () => this.scene.start('Battle');
    this.input.keyboard?.once('keydown-ENTER', enter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ENTER', enter));
  }
}
