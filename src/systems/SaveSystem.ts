const KEY = 'huanyi-heti-save-v1';
export interface SaveData { bestLevel: number; bestKills: number; sound: boolean; }
export class SaveSystem {
  load(): SaveData { try { return { bestLevel: 1, bestKills: 0, sound: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { bestLevel: 1, bestKills: 0, sound: true }; } }
  save(data: SaveData): void { localStorage.setItem(KEY, JSON.stringify(data)); }
}
