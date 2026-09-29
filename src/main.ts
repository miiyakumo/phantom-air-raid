import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/game-config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#19112d',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, PreloadScene, MenuScene, BattleScene, ResultScene],
};

// The debug bridge is excluded from production and requires an explicit URL flag.
async function boot(): Promise<void> {
  const debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug')
    ? await import('./debug/game-debug')
    : undefined;
  debug?.seedRandom(new URLSearchParams(location.search).get('seed') ?? '1');
  const game = new Phaser.Game(config);
  debug?.installDebug(game);
}

void boot();
