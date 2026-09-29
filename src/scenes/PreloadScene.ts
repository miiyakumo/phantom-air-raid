import Phaser from 'phaser';
import { buildPixelTextures } from '../systems/Visuals';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  create(): void {
    buildPixelTextures(this);
    this.scene.start('Menu');
  }
}
