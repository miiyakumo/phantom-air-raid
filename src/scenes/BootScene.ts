import Phaser from 'phaser';
import { GAME_COLORS } from '../data/game-config';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_COLORS.void);
    this.scene.start('Preload');
  }
}
