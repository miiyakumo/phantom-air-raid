const KEY = 'huanyi-heti-save-v1';
export interface SaveData { bestLevel: number; bestKills: number; sound: boolean }
export class SaveSystem {
  load(): SaveData {
    const defaults: SaveData = { bestLevel: 1, bestKills: 0, sound: true };
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      return {
        bestLevel: Number.isSafeInteger(data?.bestLevel) && data.bestLevel > 0 ? data.bestLevel : defaults.bestLevel,
        bestKills: Number.isSafeInteger(data?.bestKills) && data.bestKills >= 0 ? data.bestKills : defaults.bestKills,
        sound: typeof data?.sound === 'boolean' ? data.sound : defaults.sound,
      };
    } catch { return defaults; }
  }
  save(data: SaveData): void {
    // Storage can be blocked in private/embedded browsers; never lose the result screen.
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* Session remains playable. */ }
  }
}
