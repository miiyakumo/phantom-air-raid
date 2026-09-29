import Phaser from 'phaser';
import { GAME_COLORS, GAME_HEIGHT, GAME_WIDTH } from '../data/game-config';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_COLORS.void);
    this.add.text(GAME_WIDTH / 2, 180, '试飞结束', { color: '#ffe28a', fontSize: '46px', fontStyle: 'bold' }).setOrigin(0.5);
    const retry = this.add.text(GAME_WIDTH / 2, 310, '重新试飞', {
      backgroundColor: '#9d355b', color: '#fff1c7', fontSize: '24px', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    retry.on('pointerdown', () => this.scene.start('Battle'));
    const menu = this.add.text(GAME_WIDTH / 2, 400, '返回主界面', { color: '#d9c4ff', fontSize: '18px' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('Menu'));
  }
}
