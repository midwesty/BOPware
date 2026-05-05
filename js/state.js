/**
 * BOPWARE DECK — State Manager
 * Central state store for the entire deck OS
 * All persistence goes through here via localStorage (namespaced)
 */

class BopStateManager {
  constructor() {
    this.NS = 'bopware_deck_';
    this.state = {
      settings: {},
      gameData: {},
      favorites: [],
      pinnedApps: [],
      noteSticks: [],
      noteCount: 0,
      transmissions: [],
      bootLog: [],
      bootCount: 0,
      currentTheme: 'crt_green',
      layout: 'landscape',
      lastVersion: null,
    };
    this.listeners = {};
  }

  // ── PERSISTENCE ──────────────────────────────────────────────

  _key(k) { return this.NS + k; }

  save(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
    } catch (e) {
      console.warn('[BopState] Save failed:', key, e);
    }
  }

  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // ── INIT ─────────────────────────────────────────────────────

  async init(settingsManifest) {
    // Load defaults from settings.json
    const defaults = settingsManifest?.defaults ?? {};

    // Load persisted settings or use defaults
    this.state.settings = this.load('settings', defaults);
    this.state.currentTheme = this.state.settings.theme ?? 'crt_green';
    this.state.layout = this.state.settings.layout ?? 'landscape';

    this.state.favorites = this.load('favorites', []);
    this.state.pinnedApps = this.load('pinnedApps', []);
    this.state.noteSticks = this.load('noteSticks', []);
    this.state.noteCount = this.load('noteCount', 0);
    this.state.transmissions = this.load('transmissions', []);
    this.state.bootLog = this.load('bootLog', []);
    this.state.bootCount = this.load('bootCount', 0);
    this.state.lastVersion = this.load('lastVersion', null);
    this.state.gameData = this.load('gameData', {});

    console.log('[BopState] Initialized. Boot count:', this.state.bootCount);
  }

  // ── SETTINGS ─────────────────────────────────────────────────

  getSettings() { return this.state.settings; }

  updateSetting(key, value) {
    this.state.settings[key] = value;
    this.save('settings', this.state.settings);
    this.emit('settingChanged', { key, value });
  }

  getTheme() { return this.state.currentTheme; }

  setTheme(id) {
    this.state.currentTheme = id;
    this.updateSetting('theme', id);
    this.emit('themeChanged', id);
  }

  // ── BOOT ─────────────────────────────────────────────────────

  getBootCount() { return this.state.bootCount; }

  isFirstBoot() { return this.state.bootCount === 0; }

  incrementBootCount() {
    this.state.bootCount++;
    this.save('bootCount', this.state.bootCount);
  }

  addBootLogEntry(lines, type) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      type: type ?? 'random',
      lines: Array.isArray(lines) ? lines : [lines],
    };
    this.state.bootLog.unshift(entry); // newest first
    if (this.state.bootLog.length > 50) this.state.bootLog.pop();
    this.save('bootLog', this.state.bootLog);
    return entry;
  }

  getBootLog() { return this.state.bootLog; }

  getLastVersion() { return this.state.lastVersion; }

  setLastVersion(v) {
    this.state.lastVersion = v;
    this.save('lastVersion', v);
  }

  // ── GAMES ────────────────────────────────────────────────────

  getGameData(id) {
    return this.state.gameData[id] ?? {};
  }

  updateGameData(id, data) {
    this.state.gameData[id] = { ...this.state.gameData[id], ...data };
    this.save('gameData', this.state.gameData);
  }

  recordPlay(id) {
    const d = this.getGameData(id);
    this.updateGameData(id, {
      playCount: (d.playCount ?? 0) + 1,
      lastPlayed: new Date().toISOString(),
    });
  }

  isFavorite(id) { return this.state.favorites.includes(id); }

  toggleFavorite(id) {
    if (this.isFavorite(id)) {
      this.state.favorites = this.state.favorites.filter(f => f !== id);
    } else {
      this.state.favorites.push(id);
    }
    this.save('favorites', this.state.favorites);
    this.emit('favoritesChanged', this.state.favorites);
  }

  getFavorites() { return this.state.favorites; }

  // ── NOTESTICKS ───────────────────────────────────────────────

  getNoteSticks() { return this.state.noteSticks; }
  getNoteCount() { return this.state.noteCount; }

  addNote(note) {
    this.state.noteCount++;
    const entry = {
      id: `note_${Date.now()}`,
      text: note.text ?? '',
      x: note.x ?? 100,
      y: note.y ?? 100,
      createdAt: new Date().toISOString(),
      number: this.state.noteCount,
    };
    this.state.noteSticks.push(entry);
    this.save('noteSticks', this.state.noteSticks);
    this.save('noteCount', this.state.noteCount);
    this.emit('noteAdded', entry);
    return entry;
  }

  updateNote(id, changes) {
    const idx = this.state.noteSticks.findIndex(n => n.id === id);
    if (idx !== -1) {
      this.state.noteSticks[idx] = { ...this.state.noteSticks[idx], ...changes };
      this.save('noteSticks', this.state.noteSticks);
    }
  }

  removeNote(id) {
    this.state.noteSticks = this.state.noteSticks.filter(n => n.id !== id);
    this.save('noteSticks', this.state.noteSticks);
    this.emit('noteRemoved', id);
  }

  // ── TRANSMISSIONS ─────────────────────────────────────────────

  getTransmissions() { return this.state.transmissions; }

  addTransmission(msg) {
    const entry = {
      ...msg,
      id: msg.id ?? `t_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      read: false,
    };
    this.state.transmissions.unshift(entry);
    this.save('transmissions', this.state.transmissions);
    this.emit('transmissionReceived', entry);
    return entry;
  }

  markTransmissionRead(id) {
    const t = this.state.transmissions.find(t => t.id === id);
    if (t) {
      t.read = true;
      this.save('transmissions', this.state.transmissions);
      this.emit('transmissionRead', id);
    }
  }

  getUnreadCount() {
    return this.state.transmissions.filter(t => !t.read).length;
  }

  // ── PINNED APPS ───────────────────────────────────────────────

  getPinnedApps() { return this.state.pinnedApps; }

  setPinnedApps(arr) {
    this.state.pinnedApps = arr;
    this.save('pinnedApps', arr);
  }

  // ── APP-SPECIFIC SAVE NAMESPACE ───────────────────────────────

  /**
   * Namespaced save for individual apps
   * Apps call: window.parent.BopState.saveAppData('myAppId', key, value)
   */
  saveAppData(appId, key, value) {
    const nsKey = `app_${appId}_${key}`;
    this.save(nsKey, value);
  }

  loadAppData(appId, key, fallback = null) {
    const nsKey = `app_${appId}_${key}`;
    return this.load(nsKey, fallback);
  }

  // ── EVENT EMITTER ─────────────────────────────────────────────

  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }

  emit(event, data) {
    (this.listeners[event] ?? []).forEach(cb => cb(data));
  }
}

window.BopState = new BopStateManager();
