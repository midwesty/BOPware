/**
 * BOPWARE DECK — Theme Manager
 * Applies color themes to CSS variables
 */

class ThemeManager {
  constructor() {
    this.themes = [];
    this.activeTheme = null;
  }

  async init(settingsData) {
    this.themes = settingsData?.themes ?? [];
    const savedThemeId = window.BopState.getTheme();
    this.apply(savedThemeId);

    // Listen for theme changes
    window.BopState.on('themeChanged', id => this.apply(id));
  }

  apply(themeId) {
    const theme = this.themes.find(t => t.id === themeId)
      ?? this.themes.find(t => t.isDefault)
      ?? this.themes[0];

    if (!theme) return;

    this.activeTheme = theme;
    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty('--color-primary', c.primary);
    root.style.setProperty('--color-primary-dim', c.primaryDim);
    root.style.setProperty('--color-primary-glow', c.primaryGlow);
    root.style.setProperty('--color-secondary', c.secondary);
    root.style.setProperty('--color-accent', c.accent);
    root.style.setProperty('--color-bg', c.background);
    root.style.setProperty('--color-bg-panel', c.backgroundPanel);
    root.style.setProperty('--color-bg-card', c.backgroundCard);
    root.style.setProperty('--color-text', c.text);
    root.style.setProperty('--color-text-dim', c.textDim);
    root.style.setProperty('--color-text-muted', c.textMuted);
    root.style.setProperty('--color-border', c.border);
    root.style.setProperty('--color-border-bright', c.borderBright);
    root.style.setProperty('--color-scanline', c.scanlineColor);
    root.style.setProperty('--color-glow', c.glowColor);

    // Update custom cursor colors to match
    document.body.setAttribute('data-theme', themeId);

    window.AudioMgr?.play('settings', 'theme_change');
  }

  getAll() { return this.themes; }
  getActive() { return this.activeTheme; }
}

window.ThemeMgr = new ThemeManager();
