/**
 * BOPWARE DECK — Audio Manager
 * Handles all SFX and music playback
 * Audio files mapped via data/audio.json
 */

class AudioManager {
  constructor() {
    this.manifest = null;
    this.sfxEnabled = true;
    this.sfxVolume = 0.7;
    this.musicEnabled = true;
    this.musicVolume = 0.3;
    this.currentAmbient = null;
    this.ambientPool = [];
    this.currentAmbientIndex = 0;
    this.sfxCache = {};
    this.loaded = false;
  }

  async init() {
    try {
      const res = await fetch('data/audio.json');
      this.manifest = await res.json();
      this.loaded = true;
      console.log('[AudioManager] Manifest loaded');
    } catch (e) {
      console.warn('[AudioManager] Could not load audio manifest:', e);
    }

    // Load saved preferences
    const prefs = window.BopState?.getSettings();
    if (prefs) {
      this.sfxEnabled = prefs.sfxEnabled ?? true;
      this.sfxVolume = prefs.sfxVolume ?? 0.7;
      this.musicEnabled = prefs.ambientMusic ?? true;
      this.musicVolume = prefs.ambientVolume ?? 0.3;
    }
  }

  /**
   * Play a sound effect by category and name
   * e.g. play('ui', 'click') or play('system', 'boot_chime')
   */
  play(category, name) {
    if (!this.sfxEnabled || !this.loaded) return;

    const path = this.manifest?.sfx?.[category]?.[name];
    if (!path) {
      // Silently fail — audio files may not be dropped in yet
      return;
    }

    const cacheKey = `${category}_${name}`;
    let audio = this.sfxCache[cacheKey];

    if (!audio) {
      audio = new Audio(path);
      audio.volume = this.sfxVolume;
      this.sfxCache[cacheKey] = audio;
    } else {
      // Clone for overlapping plays
      audio = audio.cloneNode();
      audio.volume = this.sfxVolume;
    }

    audio.play().catch(() => {
      // File not found or autoplay blocked — silent fail
    });
  }

  /**
   * Start ambient/home screen music
   */
  startAmbient() {
    if (!this.musicEnabled || !this.loaded) return;

    const tracks = this.manifest?.music?.ambient;
    if (!tracks || tracks.length === 0) return;

    this.stopAmbient();

    const track = tracks[this.currentAmbientIndex % tracks.length];
    this.currentAmbient = new Audio(track.file);
    this.currentAmbient.volume = this.musicVolume;
    this.currentAmbient.loop = track.loop ?? true;

    this.currentAmbient.play().catch(() => {
      // No audio file yet
    });

    this.currentAmbient.addEventListener('ended', () => {
      this.currentAmbientIndex++;
      this.startAmbient();
    });
  }

  stopAmbient() {
    if (this.currentAmbient) {
      this.currentAmbient.pause();
      this.currentAmbient.currentTime = 0;
      this.currentAmbient = null;
    }
  }

  pauseAmbient() {
    this.currentAmbient?.pause();
  }

  resumeAmbient() {
    this.currentAmbient?.play().catch(() => {});
  }

  setSFXVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.currentAmbient) this.currentAmbient.volume = this.musicVolume;
  }

  setMusicEnabled(val) {
    this.musicEnabled = val;
    if (!val) this.stopAmbient();
    else this.startAmbient();
  }

  setSFXEnabled(val) {
    this.sfxEnabled = val;
  }

  /**
   * Get media player track list
   */
  getPlayerTracks() {
    return this.manifest?.music?.player?.tracks ?? [];
  }

  /**
   * Get boot music path
   */
  getBootMusic() {
    return this.manifest?.music?.boot?.[0]?.file ?? null;
  }
}

window.AudioMgr = new AudioManager();
