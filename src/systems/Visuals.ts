import Phaser from 'phaser';

/** Original block sprites: no network assets, SVG rasterization, or font glyphs. */
export function buildPixelTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rect = (x: number, y: number, w: number, h: number, color: number) => g.fillStyle(color).fillRect(x, y, w, h);
  const save = (key: string, w = 64, h = 48) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.generateTexture(key, w, h); g.clear();
  };
  const wings = (light: number, dark: number) => {
    rect(0, 16, 64, 8, 0x132231); rect(4, 12, 56, 16, dark);
    rect(8, 8, 48, 12, light); rect(12, 20, 40, 12, dark);
    rect(4, 16, 12, 4, light); rect(48, 16, 12, 4, light);
    rect(16, 28, 32, 8, 0x27364b); rect(20, 12, 24, 12, 0x334663);
    rect(8, 12, 4, 4, 0xadb1d0); rect(52, 12, 4, 4, 0xadb1d0);
  };
  // Diamond-armored pilot, elytra wings and a visible copper face.
  wings(0x67ddd6, 0x228d9b);
  rect(24, 0, 16, 4, 0x0a4554); rect(20, 4, 24, 16, 0x24b8b8);
  rect(24, 4, 16, 4, 0xadfff1); rect(24, 12, 16, 8, 0xc99169);
  rect(24, 12, 4, 4, 0x262943); rect(36, 12, 4, 4, 0x262943);
  rect(24, 20, 16, 16, 0x35cecb); rect(24, 20, 4, 12, 0xa2fff0);
  rect(24, 36, 6, 8, 0x254b66); rect(34, 36, 6, 8, 0x254b66);
  rect(24, 42, 6, 4, 0x8af4e7); rect(34, 42, 6, 4, 0x8af4e7);
  save('player');
  wings(0x8496c5, 0x495a94);
  rect(24, 18, 20, 14, 0x8196ba); rect(24, 22, 8, 4, 0xbaff77); rect(36, 22, 8, 4, 0xbaff77);
  rect(28, 32, 12, 8, 0x414b76); rect(32, 40, 4, 4, 0x7c8fab); save('phantom');
  wings(0x6f83bd, 0x3c537f);
  rect(22, 0, 20, 4, 0x28472d); rect(20, 4, 24, 16, 0x75aa50);
  rect(24, 4, 8, 4, 0x95c467); rect(24, 12, 4, 4, 0x202d21); rect(36, 12, 4, 4, 0x202d21);
  rect(24, 20, 16, 12, 0x3fb7b5); rect(20, 28, 8, 8, 0x5a3c77); rect(36, 28, 8, 8, 0x5a3c77); save('riderPhantom');
  wings(0x82a05f, 0x445c45);
  rect(20, 4, 24, 28, 0x65bc53); rect(24, 4, 8, 4, 0x9cdc77); rect(36, 24, 8, 8, 0x3b8c45);
  rect(24, 12, 4, 8, 0x142d28); rect(36, 12, 4, 8, 0x142d28);
  rect(28, 20, 8, 4, 0x142d28); rect(24, 24, 16, 4, 0x142d28); rect(24, 28, 4, 4, 0x142d28); rect(36, 28, 4, 4, 0x142d28); save('creeperPhantom');
  wings(0xba6c8c, 0x764764);
  rect(24, 4, 16, 28, 0xc54b4c); rect(28, 0, 8, 4, 0xffd199); rect(24, 8, 16, 4, 0xffe8bb);
  rect(24, 20, 16, 4, 0xffe8bb); rect(28, 12, 4, 8, 0xf48868); rect(28, 32, 8, 8, 0xffad42); rect(30, 40, 4, 4, 0xffef94); save('fireworkPhantom');
  wings(0x786483, 0x423c57);
  for (const x of [8, 24, 40]) {
    rect(x, 8, 16, 20, 0x282938); rect(x, 8, 16, 4, 0x687082);
    rect(x + 4, 16, 4, 4, 0xd5b5f8); rect(x + 12, 16, 4, 4, 0xd5b5f8);
    rect(x + 4, 24, 8, 4, 0x8b809b);
  }
  rect(28, 28, 8, 12, 0x4e5060); rect(24, 32, 16, 4, 0x9398a1); save('witherPhantom');
  wings(0x286b71, 0x123e4b);
  rect(16, 0, 4, 16, 0x65d8bf); rect(12, 4, 4, 8, 0xc1f4d9); rect(44, 0, 4, 16, 0x65d8bf); rect(48, 4, 4, 8, 0xc1f4d9);
  rect(20, 8, 24, 24, 0x123e46); rect(24, 16, 16, 4, 0x061f31);
  rect(24, 24, 16, 4, 0xb6ddba); rect(24, 32, 16, 12, 0x126b70);
  rect(28, 32, 8, 8, 0x69f1d1); rect(24, 36, 4, 4, 0xc5ffe1); save('wardenPhantom');
  rect(0, 6, 24, 4, 0x126a73); rect(2, 6, 20, 2, 0xb2ffec);
  rect(18, 2, 4, 12, 0x61e1d2); rect(20, 0, 8, 4, 0xb2ffec); rect(20, 6, 10, 4, 0xe0fff4); rect(20, 12, 8, 4, 0xb2ffec); save('trident', 32, 16);
  rect(4, 0, 8, 16, 0x582873); rect(0, 4, 16, 8, 0x582873); rect(4, 4, 8, 8, 0xca71e5); rect(6, 6, 4, 4, 0xffdfed); save('enemyBolt', 16, 16);
  g.destroy();
}

export function drawPixelArena(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0x141721).fillRect(0, 0, 960, 540);
  // Restrained end-stone tiling keeps projectiles and warnings easy to read.
  for (let y = 64; y < 532; y += 32) {
    for (let x = 16; x < 948; x += 48) {
      const n = (x * 7 + y * 11) % 29;
      g.fillStyle(n < 10 ? 0x43473f : n < 20 ? 0x484b43 : 0x4c4f46).fillRect(x, y, 46, 30);
      g.fillStyle(0x5c6050, 0.5).fillRect(x + 4, y + 3, 16, 2);
      g.fillStyle(0x30372f, 0.4).fillRect(x + 28, y + 20, 8, 4);
    }
  }
  for (let x = 0; x < 960; x += 32) {
    g.fillStyle(x % 64 ? 0x28253d : 0x30293f).fillRect(x, 58, 30, 8).fillRect(x, 530, 30, 10);
  }
  for (let y = 64; y < 532; y += 32) {
    g.fillStyle(0x30293f).fillRect(0, y, 14, 30).fillRect(946, y, 14, 30);
  }
  for (const [x, y] of [[50, 104], [890, 104], [50, 468], [890, 468]]) {
    g.fillStyle(0x242436).fillRect(x - 12, y, 32, 16);
    g.fillStyle(0x58476b).fillRect(x - 8, y - 8, 24, 16);
    g.fillStyle(0x9374ad).fillRect(x, y - 20, 8, 24);
    g.fillStyle(0xc7a3d8).fillRect(x, y - 20, 4, 16);
    g.fillStyle(0x796291).fillRect(x - 8, y - 8, 8, 12);
  }
  // Portal ruins are scenery, not an unexplained attack indicator.
  g.fillStyle(0x353445).fillRect(426, 250, 108, 12).fillRect(426, 318, 108, 12).fillRect(426, 262, 12, 56).fillRect(522, 262, 12, 56);
  g.fillStyle(0x53515c).fillRect(438, 262, 84, 2).fillRect(438, 316, 84, 2);
  g.fillStyle(0x554562, 0.4).fillRect(442, 268, 76, 44);
}
