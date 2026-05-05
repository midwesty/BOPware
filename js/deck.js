/**
 * BOPWARE DECK — Main UI Controller
 * Home screen, game rows, taskbar, status bar, library, news
 */

class DeckUI {
  constructor() {
    this.appsData = null;
    this.settingsData = null;
    this.newsData = null;
    this.currentFilter = 'all';
    this.clockInterval = null;
    this.batteryLevel = 87;
    this.signalStrength = 4;
  }

  // ── INIT ─────────────────────────────────────────────────────

  async init() {
    const [appsRes, settingsRes, newsRes] = await Promise.all([
      fetch('data/apps.json'),
      fetch('data/settings.json'),
      fetch('data/news.json').catch(() => ({ json: () => null })),
    ]);
    this.appsData = await appsRes.json();
    this.settingsData = await settingsRes.json();
    try { this.newsData = await newsRes.json(); } catch (e) { this.newsData = null; }

    // Init subsystems
    await window.BopState.init(this.settingsData);
    await window.AudioMgr.init();
    await window.ThemeMgr.init(this.settingsData);
    await window.NoteStickApp.init();

    // Apply settings
    const settings = window.BopState.getSettings();
    if (!settings.scanlines && settings.scanlines !== undefined) {
      document.body.classList.add('scanlines-off');
    }

    // Build UI
    this._buildStatusBar();
    this._buildHomeScreen();
    this._buildTaskbar();
    this._buildLibrary();
    this._bindGlobalEvents();

    this._startClock();
    this._startSignalFlicker();
    this._updateNotifBadge();

    // Auto-open news after boot if configured
    if (this.newsData?.settings?.showOnBoot !== false) {
      const delay = this.newsData?.settings?.autoOpenDelay ?? 200;
      setTimeout(() => this.openApp('news'), delay);
    }
  }

  // ── STATUS BAR ────────────────────────────────────────────────

  _buildStatusBar() {
    const bar = document.getElementById('status-bar');
    const ver = this.appsData?.version ?? '0.0.1';

    bar.innerHTML = `
      <div class="status-left">
        <div class="status-item firmware-tag">BOP-DECK v${ver}</div>
        <div class="status-item" id="signal-status">
          <div class="signal-bars" id="signal-bars">
            <div class="signal-bar active"></div>
            <div class="signal-bar active"></div>
            <div class="signal-bar active"></div>
            <div class="signal-bar active"></div>
            <div class="signal-bar"></div>
          </div>
          <span style="font-size:9px;margin-left:3px;">RELAY-7</span>
        </div>
      </div>
      <div class="status-center">
        <div id="clock-display">--:--:--</div>
      </div>
      <div class="status-right">
        <div class="status-item" id="notif-area" style="cursor:pointer;" title="Transmissions">
          📡 <span class="notification-badge hidden" id="notif-badge">0</span>
        </div>
        <div class="status-item">
          <div class="battery-fill">
            <div class="battery-level" id="battery-level" style="width:87%"></div>
          </div>
          <span id="battery-pct" style="font-size:9px;margin-left:3px;">87%</span>
        </div>
      </div>
    `;

    document.getElementById('notif-area').addEventListener('click', () => {
      this.openApp('messages');
    });
  }

  _startClock() {
    const update = () => {
      const el = document.getElementById('clock-display');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  }

  _startSignalFlicker() {
    setInterval(() => {
      if (Math.random() < 0.1) {
        this.signalStrength = Math.max(1, this.signalStrength - 1);
      } else {
        this.signalStrength = Math.min(5, this.signalStrength + (Math.random() < 0.3 ? 1 : 0));
      }
      this._updateSignalBars();

      if (Math.random() < 0.02) {
        this.batteryLevel = Math.max(5, this.batteryLevel - 1);
        const lvl = document.getElementById('battery-level');
        const pct = document.getElementById('battery-pct');
        if (lvl) lvl.style.width = `${this.batteryLevel}%`;
        if (pct) pct.textContent = `${this.batteryLevel}%`;
      }
    }, 3000);
  }

  _updateSignalBars() {
    document.querySelectorAll('.signal-bar').forEach((bar, i) => {
      bar.classList.toggle('active', i < this.signalStrength);
    });
  }

  _updateNotifBadge() {
    const count = window.BopState.getUnreadCount();
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // ── HOME SCREEN ───────────────────────────────────────────────

  _buildHomeScreen() {
    const screen = document.getElementById('home-screen');

    screen.innerHTML = `
      <div class="home-header">
        <div class="deck-wordmark">
          BOPWARE DECK
          <span>BETTER OFF PUBLISHED LLC</span>
        </div>
        <div class="home-actions">
          <button class="icon-btn" id="show-library-btn">▦ ALL GAMES</button>
          <button class="icon-btn" id="add-note-btn" title="New sticky note">📝 NOTE</button>
        </div>
      </div>
      <div id="game-rows"></div>
    `;

    document.getElementById('show-library-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'click');
      this._showLibrary();
    });

    document.getElementById('add-note-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'click');
      window.NoteStickApp.createNew();
    });

    this._renderGameRows();
  }

  _renderGameRows() {
    const container = document.getElementById('game-rows');
    if (!container) return;
    container.innerHTML = '';

    const rows = this.appsData?.rows ?? [];
    const games = this.appsData?.games ?? [];

    rows.forEach(row => {
      let rowGames;
      if (row.filter === 'featured') {
        rowGames = games.filter(g => !g.hidden && (g.featured || g.isNew));
      } else if (row.filter === 'locked') {
        rowGames = games.filter(g => !g.hidden && !g.unlocked);
      } else {
        rowGames = games.filter(g => !g.hidden && g.unlocked);
      }

      if (rowGames.length === 0) return;

      const rowEl = document.createElement('div');
      rowEl.className = 'game-row';
      rowEl.innerHTML = `
        <div class="row-header">
          <div class="row-title">${row.label}</div>
          <button class="row-see-all">SEE ALL →</button>
        </div>
        <div class="game-scroll-container" id="row_${row.id}"></div>
      `;

      rowEl.querySelector('.row-see-all').addEventListener('click', () => {
        window.AudioMgr?.play('ui', 'click');
        this._showLibrary();
      });

      container.appendChild(rowEl);

      const scrollContainer = rowEl.querySelector(`#row_${row.id}`);
      rowGames.forEach(game => scrollContainer.appendChild(this._buildGameCard(game)));
    });
  }

  _buildGameCard(game) {
    const card = document.createElement('div');
    card.className = `game-card${game.unlocked ? '' : ' locked'}`;
    card.dataset.gameId = game.id;

    const isFav = window.BopState.isFavorite(game.id);

    card.innerHTML = `
      <button class="card-favorite ${isFav ? 'active' : ''}" title="Favorite" data-fav-btn>
        ${isFav ? '★' : '☆'}
      </button>
      <div class="card-thumb-placeholder" style="background:${game.thumbnailPlaceholderColor ?? '#111'}">
        <img
          src="${game.thumbnail}"
          alt="${game.title}"
          class="card-thumb-img"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none'"
        />
        <span class="card-thumb-icon">${this._getGenreIcon(game.genre)}</span>
      </div>
      ${game.isNew ? '<div class="card-badge">NEW</div>' : ''}
      <div class="card-info">
        <div class="card-title">${game.title}</div>
        <div class="card-genre">${game.genre ?? ''}</div>
      </div>
      <div class="card-actions">
        ${game.unlocked
          ? `<button class="card-btn primary" data-launch="${game.id}">▶ PLAY</button>`
          : `<button class="card-btn" disabled>🔒 LOCKED</button>`
        }
        <button class="card-btn" data-info="${game.id}">INFO</button>
      </div>
    `;

    card.addEventListener('mouseenter', () => window.AudioMgr?.play('ui', 'hover'));

    card.querySelector('[data-fav-btn]').addEventListener('click', e => {
      e.stopPropagation();
      window.AudioMgr?.play('ui', 'click');
      window.BopState.toggleFavorite(game.id);
      const fav = window.BopState.isFavorite(game.id);
      const btn = e.currentTarget;
      btn.textContent = fav ? '★' : '☆';
      btn.classList.toggle('active', fav);
    });

    const launchBtn = card.querySelector('[data-launch]');
    if (launchBtn) {
      launchBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.launchGame(game);
      });
    }

    card.querySelector('[data-info]').addEventListener('click', e => {
      e.stopPropagation();
      window.AudioMgr?.play('ui', 'click');
      this._showGameInfo(game);
    });

    return card;
  }

  _getGenreIcon(genre) {
    const map = {
      'Arcade': '🕹️', 'Puzzle': '🧩', 'Creative': '🎨',
      'Utility': '🛠️', 'Survival': '⚔️', 'Unknown': '❓',
    };
    return map[genre] ?? '🎮';
  }

  // ── GAME LAUNCH ───────────────────────────────────────────────

  launchGame(game) {
    if (!game.unlocked || !game.path) return;
    window.AudioMgr?.play('ui', 'confirm');
    window.BopState.recordPlay(game.id);

    window.WinMgr.open({
      id: `game_${game.id}`,
      title: game.title,
      src: game.path,
      width: Math.min(window.innerWidth - 20, 1000),
      height: Math.min(window.innerHeight - 60, 700),
      isGame: true,
      icon: this._getGenreIcon(game.genre),
    });
  }

  // ── LIBRARY ───────────────────────────────────────────────────

  _buildLibrary() {
    const libView = document.getElementById('library-view');

    libView.innerHTML = `
      <div class="library-header">
        <div class="library-title">// FULL LIBRARY</div>
        <button class="icon-btn" id="close-library-btn">✕ CLOSE</button>
      </div>
      <div class="filter-bar">
        <button class="filter-btn active" data-filter="all">ALL</button>
        <button class="filter-btn" data-filter="new">NEW</button>
        <button class="filter-btn" data-filter="recent">RECENTLY PLAYED</button>
        <button class="filter-btn" data-filter="favorites">FAVORITES</button>
        <button class="filter-btn" data-filter="alpha">A–Z</button>
        <button class="filter-btn" data-filter="custom">CUSTOM</button>
      </div>
      <div class="library-grid" id="library-grid"></div>
    `;

    document.getElementById('close-library-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'back');
      libView.classList.remove('visible');
    });

    libView.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.AudioMgr?.play('ui', 'navigate');
        libView.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this._renderLibraryGrid(this.currentFilter);
      });
    });

    this._renderLibraryGrid('all');
  }

  _renderLibraryGrid(filter) {
    const grid = document.getElementById('library-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let games = [...(this.appsData?.games ?? [])].filter(g => !g.hidden);

    switch (filter) {
      case 'new':
        games = games.filter(g => g.isNew);
        break;
      case 'recent':
        games = games.filter(g => window.BopState.getGameData(g.id).lastPlayed)
          .sort((a, b) => {
            const da = window.BopState.getGameData(a.id).lastPlayed ?? '';
            const db = window.BopState.getGameData(b.id).lastPlayed ?? '';
            return db.localeCompare(da);
          });
        break;
      case 'favorites':
        games = games.filter(g => window.BopState.isFavorite(g.id));
        break;
      case 'alpha':
        games = games.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    games.forEach(game => grid.appendChild(this._buildGameCard(game)));
  }

  _showLibrary() {
    const libView = document.getElementById('library-view');
    libView.classList.add('visible');
    this._renderLibraryGrid(this.currentFilter);
    window.AudioMgr?.play('ui', 'click');
  }

  // ── GAME INFO ─────────────────────────────────────────────────

  _showGameInfo(game) {
    const existing = document.getElementById('game-info-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'game-info-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:850;
      display:flex;align-items:center;justify-content:center;
      animation:fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="
        background:var(--color-bg-panel);border:1px solid var(--color-border);
        border-radius:8px;padding:24px;max-width:380px;width:90%;
        box-shadow:0 0 32px var(--color-glow);
      ">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--color-primary);margin-bottom:8px;letter-spacing:0.1em;">
          ${game.title}
        </div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--color-text-muted);letter-spacing:0.15em;margin-bottom:16px;">
          ${game.genre?.toUpperCase()} · v${game.version} · ${game.developer}
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--color-text-dim);line-height:1.6;margin-bottom:20px;">
          ${game.description}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="info-close-btn" style="
            background:transparent;border:1px solid var(--color-border);
            color:var(--color-text-dim);font-family:var(--font-mono);
            font-size:10px;padding:6px 14px;border-radius:4px;cursor:pointer;letter-spacing:0.1em;
          ">CLOSE</button>
          ${game.unlocked ? `
          <button id="info-play-btn" style="
            background:var(--color-primary);border:1px solid var(--color-primary);
            color:var(--color-bg);font-family:var(--font-mono);font-weight:bold;
            font-size:10px;padding:6px 14px;border-radius:4px;cursor:pointer;
            letter-spacing:0.1em;box-shadow:0 0 12px var(--color-primary-glow);
          ">▶ PLAY NOW</button>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) { window.AudioMgr?.play('ui', 'back'); modal.remove(); }
    });

    modal.querySelector('#info-close-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'back'); modal.remove();
    });

    modal.querySelector('#info-play-btn')?.addEventListener('click', () => {
      modal.remove(); this.launchGame(game);
    });
  }

  // ── TASKBAR ───────────────────────────────────────────────────

  _buildTaskbar() {
    const taskbar = document.getElementById('taskbar');
    const sysApps = this.appsData?.systemApps ?? [];

    let html = `
      <button class="taskbar-home-btn" id="home-btn">⌂ HOME</button>
      <div class="taskbar-separator"></div>
    `;

    // News button always first
    html += `
      <button class="taskbar-btn" data-app-id="news" title="BOPware News & Updates">
        <span class="btn-icon">📰</span>
        <span class="btn-label">NEWS</span>
      </button>
    `;

    sysApps.forEach(app => {
      const unread = app.id === 'messages' ? window.BopState.getUnreadCount() : 0;
      html += `
        <button class="taskbar-btn" data-app-id="${app.id}" title="${app.description}">
          ${unread > 0 ? '<div class="btn-notif"></div>' : ''}
          <span class="btn-icon">${app.icon}</span>
          <span class="btn-label">${app.title.toUpperCase()}</span>
        </button>
      `;
    });

    html += `<div class="taskbar-spacer"></div>`;
    html += `
      <button class="taskbar-btn" id="settings-taskbar-btn" title="Settings">
        <span class="btn-icon">⚙️</span>
        <span class="btn-label">SETTINGS</span>
      </button>
    `;

    taskbar.innerHTML = html;

    taskbar.querySelectorAll('[data-app-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.AudioMgr?.play('ui', 'click');
        this.openApp(btn.dataset.appId);
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 300);
      });
    });

    document.getElementById('home-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'click');
      document.getElementById('home-screen')?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('settings-taskbar-btn')?.addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'click');
      this.openApp('settings');
    });

    window.BopState.on('transmissionReceived', () => {
      this._updateNotifBadge();
      this._updateTaskbarBadges();
    });
    window.BopState.on('transmissionRead', () => {
      this._updateNotifBadge();
      this._updateTaskbarBadges();
    });
  }

  _updateTaskbarBadges() {
    const count = window.BopState.getUnreadCount();
    const msgBtn = document.querySelector('[data-app-id="messages"] .btn-notif');
    if (msgBtn) msgBtn.style.display = count > 0 ? 'block' : 'none';
  }

  // ── APP OPENER ────────────────────────────────────────────────

  openApp(appId) {
    switch (appId) {
      case 'notestick':   window.NoteStickApp.createNew(); break;
      case 'bopmedia':    this._openMediaPlayer(); break;
      case 'messages':    this._openTransmissions(); break;
      case 'settings':    this._openSettings(); break;
      case 'news':        this._openNews(); break;
      default: {
        const app = this.appsData?.systemApps?.find(a => a.id === appId);
        if (app?.path) {
          window.WinMgr.open({
            id: appId, title: app.title, src: app.path,
            width: 600, height: 450, icon: app.icon,
          });
        }
      }
    }
  }

  // ── NEWS APP ─────────────────────────────────────────────────

  _openNews() {
    const nd = this.newsData;

    const win = window.WinMgr.open({
      id: 'news',
      title: 'BOPWARE NEWS',
      width: Math.min(window.innerWidth - 40, 680),
      height: Math.min(window.innerHeight - 80, 580),
      icon: '📰',
    });

    const content = window.WinMgr.getWindowContent('news');
    if (!content) return;

    // Category color map
    const catColor = (c) => {
      const map = {
        primary: 'var(--color-primary)',
        amber: '#ffb000',
        dim: 'var(--color-text-muted)',
        red: '#ff4040',
        blue: '#00d4ff',
      };
      return map[c] ?? 'var(--color-primary)';
    };

    // Featured block
    const feat = nd?.featured;
    const featHTML = feat ? `
      <div class="news-featured" style="background:${feat.backgroundGradient ?? 'var(--color-bg-card)'}">
        <div class="news-featured-badge" style="color:${feat.accentColor ?? 'var(--color-primary)'};border-color:${feat.accentColor ?? 'var(--color-primary)'}">
          ${feat.badgeText ?? 'FEATURED'}
        </div>
        <div class="news-featured-title" style="color:${feat.accentColor ?? 'var(--color-primary)'}">
          ${feat.title}
        </div>
        <div class="news-featured-subtitle">${feat.subtitle ?? ''}</div>
        <div class="news-featured-desc">${feat.description ?? ''}</div>
        ${feat.ctaLabel ? `
          <button class="news-featured-cta" style="
            background:${feat.accentColor ?? 'var(--color-primary)'};
            box-shadow:0 0 16px ${feat.accentColor ?? 'var(--color-primary)'}66;
          " data-cta-action="${feat.ctaAction}" data-cta-target="${feat.ctaTarget}">
            ${feat.ctaLabel}
          </button>
        ` : ''}
      </div>
    ` : '';

    // News items
    const newsItems = nd?.news ?? [];
    const newsHTML = newsItems.map(item => `
      <div class="news-item ${item.pinned ? 'news-pinned' : ''}">
        <div class="news-item-meta">
          <span class="news-category" style="color:${catColor(item.categoryColor)};border-color:${catColor(item.categoryColor)}44">
            ${item.category}
          </span>
          <span class="news-date">${item.date}</span>
          ${item.pinned ? '<span class="news-pin-icon">📌</span>' : ''}
        </div>
        <div class="news-headline">${item.headline}</div>
        <div class="news-body">${item.body}</div>
      </div>
    `).join('');

    // Patch notes
    const patches = nd?.patchNotes ?? [];
    const patchHTML = patches.length === 0 ? '' : `
      <div class="news-section-label">// PATCH NOTES</div>
      ${patches.map(p => `
        <div class="news-patch-block">
          <div class="news-patch-header">
            <span class="news-patch-version">v${p.version}</span>
            <span class="news-patch-label">${p.label}</span>
            <span class="news-patch-date">${p.date}</span>
          </div>
          <ul class="news-patch-list">
            ${p.notes.map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    `;

    content.innerHTML = `
      <div class="news-app">

        <div class="news-masthead">
          <div class="news-masthead-logo">
            <div class="news-sphere">
              <div class="news-sphere-core"></div>
              <div class="news-sphere-ring"></div>
            </div>
            <div>
              <div class="news-masthead-title">BOPWARE</div>
              <div class="news-masthead-sub">DECK DISPATCH · v${this.appsData?.version ?? '0.0.1'}</div>
            </div>
          </div>
          <div class="news-masthead-date">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }).toUpperCase()}</div>
        </div>

        <div class="news-scroll">
          ${featHTML}
          <div class="news-section-label">// LATEST TRANSMISSIONS</div>
          ${newsHTML || '<div class="news-empty">NO TRANSMISSIONS ON FILE</div>'}
          ${patchHTML}
        </div>

      </div>
    `;

    // Wire featured CTA button
    content.querySelector('[data-cta-action]')?.addEventListener('click', e => {
      const action = e.currentTarget.dataset.ctaAction;
      const target = e.currentTarget.dataset.ctaTarget;
      if (action === 'launch') {
        const game = this.appsData?.games?.find(g => g.id === target);
        if (game) {
          window.WinMgr.close('news');
          this.launchGame(game);
        }
      } else if (action === 'open') {
        window.WinMgr.close('news');
        this.openApp(target);
      }
      window.AudioMgr?.play('ui', 'confirm');
    });
  }

  // ── MEDIA PLAYER ─────────────────────────────────────────────

  _openMediaPlayer() {
    const tracks = window.AudioMgr.getPlayerTracks();

    window.WinMgr.open({
      id: 'bopmedia', title: 'BOP MEDIA',
      width: 320, height: 480, icon: '🎵',
    });

    const content = window.WinMgr.getWindowContent('bopmedia');
    if (!content) return;

    let currentTrack = 0;
    let isPlaying = false;
    let audio = null;

    const render = () => {
      const track = tracks[currentTrack] ?? {
        title: 'No tracks loaded',
        artist: 'Drop files in assets/audio/music/player/',
        file: null,
      };

      content.innerHTML = `
        <div class="media-player">
          <div class="media-album-art ${isPlaying ? 'playing' : ''}">🎵</div>
          <div class="media-track-info">
            <div class="media-track-title">${track.title}</div>
            <div class="media-track-artist">${track.artist ?? ''}</div>
          </div>
          <input type="range" class="media-scrubber" id="media-scrubber" value="0" min="0" max="100" step="1">
          <div style="display:flex;justify-content:space-between;padding:0 4px;">
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--color-text-muted);" id="media-time-current">0:00</span>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--color-text-muted);" id="media-time-total">0:00</span>
          </div>
          <div class="media-controls">
            <button class="media-btn" id="media-prev">⏮</button>
            <button class="media-btn play-btn" id="media-play">${isPlaying ? '⏸' : '▶'}</button>
            <button class="media-btn" id="media-next">⏭</button>
          </div>
          <div class="media-tracklist">
            ${tracks.length === 0
              ? '<div style="padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--color-text-muted);text-align:center;">Drop audio files into<br>assets/audio/music/player/<br>and update data/audio.json</div>'
              : tracks.map((t, i) => `
                <div class="media-track-item ${i === currentTrack ? 'active' : ''}" data-track="${i}">
                  <span class="track-num">${i + 1}</span>
                  <span class="track-name">${t.title}</span>
                  <span class="track-duration">${t.duration ? this._formatTime(t.duration) : '--:--'}</span>
                </div>
              `).join('')
            }
          </div>
        </div>
      `;

      document.getElementById('media-play')?.addEventListener('click', () => {
        if (!track.file) return;
        if (!audio) audio = new Audio(track.file);
        if (isPlaying) {
          audio.pause(); isPlaying = false;
          window.AudioMgr?.play('media', 'pause');
        } else {
          audio.play().catch(() => {}); isPlaying = true;
          window.AudioMgr?.play('media', 'play');
        }
        render();
      });

      document.getElementById('media-prev')?.addEventListener('click', () => {
        currentTrack = Math.max(0, currentTrack - 1);
        if (audio) { audio.pause(); audio = null; isPlaying = false; }
        window.AudioMgr?.play('media', 'skip');
        render();
      });

      document.getElementById('media-next')?.addEventListener('click', () => {
        currentTrack = Math.min(tracks.length - 1, currentTrack + 1);
        if (audio) { audio.pause(); audio = null; isPlaying = false; }
        window.AudioMgr?.play('media', 'skip');
        render();
      });

      content.querySelectorAll('[data-track]').forEach(el => {
        el.addEventListener('click', () => {
          currentTrack = parseInt(el.dataset.track);
          if (audio) { audio.pause(); audio = null; isPlaying = false; }
          render();
        });
      });
    };

    render();
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── TRANSMISSIONS ─────────────────────────────────────────────

  _openTransmissions() {
    window.WinMgr.open({
      id: 'messages', title: 'TRANSMISSIONS',
      width: 400, height: 460, icon: '📡',
    });

    const content = window.WinMgr.getWindowContent('messages');
    if (!content) return;

    const transmissions = window.BopState.getTransmissions();

    content.innerHTML = `
      <div class="transmissions-app">
        <div style="
          padding:8px 14px;font-family:var(--font-mono);font-size:9px;
          color:var(--color-text-muted);letter-spacing:0.15em;
          border-bottom:1px solid var(--color-border);background:var(--color-bg-panel);
        ">
          DEEP SPACE RELAY · ${transmissions.length} MESSAGES · ${window.BopState.getUnreadCount()} UNREAD
        </div>
        <div class="transmission-list" id="transmission-list">
          ${transmissions.length === 0
            ? '<div style="padding:24px;text-align:center;font-family:var(--font-mono);font-size:11px;color:var(--color-text-muted);">NO TRANSMISSIONS RECEIVED</div>'
            : transmissions.map(t => `
              <div class="transmission-item ${t.read ? '' : 'unread'}" data-msg-id="${t.id}">
                <div class="transmission-unread-dot" style="${t.read ? 'opacity:0' : ''}"></div>
                <div class="transmission-content">
                  <div class="transmission-from">${t.from ?? 'UNKNOWN'}</div>
                  <div class="transmission-subject">${t.subject ?? '(no subject)'}</div>
                  <div class="transmission-timestamp">${t.timestamp ?? t.receivedAt ?? ''}</div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;

    content.querySelectorAll('[data-msg-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.msgId;
        const msg = transmissions.find(t => t.id === id);
        if (!msg) return;
        window.BopState.markTransmissionRead(id);
        window.AudioMgr?.play('system', 'transmission_receive');
        this._showTransmissionDetail(msg);
        this._updateNotifBadge();
      });
    });
  }

  _showTransmissionDetail(msg) {
    const existing = document.getElementById('transmission-detail');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'transmission-detail';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:860;
      display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="
        background:var(--color-bg-panel);border:1px solid var(--color-border);
        border-radius:8px;padding:24px;max-width:420px;width:90%;
        box-shadow:0 0 40px var(--color-glow);
      ">
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--color-text-muted);letter-spacing:0.2em;margin-bottom:4px;">
          FROM: ${msg.from ?? 'UNKNOWN'}
        </div>
        <div style="font-family:var(--font-display);font-size:14px;color:var(--color-primary);letter-spacing:0.1em;margin-bottom:4px;">
          ${msg.subject}
        </div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--color-text-muted);margin-bottom:16px;">
          ${msg.timestamp ?? ''}
        </div>
        <div style="
          font-family:var(--font-retro);font-size:18px;color:var(--color-text-dim);
          line-height:1.6;margin-bottom:20px;padding:12px;
          border:1px solid var(--color-border);border-radius:4px;background:var(--color-bg);
        ">${msg.body}</div>
        <button style="
          background:transparent;border:1px solid var(--color-border);
          color:var(--color-text-dim);font-family:var(--font-mono);
          font-size:10px;padding:6px 16px;border-radius:4px;cursor:pointer;
          letter-spacing:0.1em;float:right;
        " id="close-detail-btn">CLOSE TRANSMISSION</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#close-detail-btn').addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'back');
      modal.remove();
    });
  }

  // ── SETTINGS ─────────────────────────────────────────────────

  _openSettings() {
    window.WinMgr.open({
      id: 'settings', title: 'SYSTEM SETTINGS',
      width: 400, height: 520, icon: '⚙️',
    });

    const content = window.WinMgr.getWindowContent('settings');
    if (!content) return;

    const settings = window.BopState.getSettings();
    const themes = window.ThemeMgr.getAll();
    const activeTheme = window.BopState.getTheme();
    const bootLog = window.BopState.getBootLog();

    content.innerHTML = `
      <div class="settings-panel">

        <div class="settings-section">
          <div class="settings-section-title">DISPLAY</div>
          <div class="settings-row">
            <div><div class="settings-label">SCANLINES</div><div class="settings-desc">CRT scanline overlay effect</div></div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-scanlines" ${settings.scanlines !== false ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
          <div class="settings-row">
            <div><div class="settings-label">GLOW EFFECT</div><div class="settings-desc">Phosphor glow on text and UI</div></div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-glow" ${settings.glowEffect !== false ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
          <div class="settings-row">
            <div><div class="settings-label">SHOW CLOCK</div></div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-clock" ${settings.showClock !== false ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">COLOR THEME</div>
          <div class="theme-grid">
            ${themes.map(t => `
              <div class="theme-swatch ${t.id === activeTheme ? 'active' : ''}" data-theme-id="${t.id}">
                <div class="swatch-dot" style="background:${t.colors.primary};box-shadow:0 0 6px ${t.colors.primaryGlow}"></div>
                <div class="swatch-name">${t.name}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">AUDIO</div>
          <div class="settings-row">
            <div><div class="settings-label">AMBIENT MUSIC</div></div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-music" ${settings.ambientMusic !== false ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
          <div class="settings-row">
            <div><div class="settings-label">SOUND EFFECTS</div></div>
            <label class="toggle-switch">
              <input type="checkbox" id="setting-sfx" ${settings.sfxEnabled !== false ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">BOOT LOG</div>
          <div class="boot-log-list">
            ${bootLog.length === 0
              ? '<div style="font-family:var(--font-mono);font-size:10px;color:var(--color-text-muted);padding:8px;">No boot history yet.</div>'
              : bootLog.slice(0, 8).map(entry => `
                <div class="boot-log-entry">
                  <div class="boot-log-timestamp">${entry.timestamp} · ${entry.type?.toUpperCase() ?? 'RANDOM'}</div>
                  <div class="boot-log-text">${entry.lines?.[0] ?? '—'}</div>
                </div>
              `).join('')
            }
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">SYSTEM INFO</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--color-text-muted);line-height:2;">
            <div>FIRMWARE: v${this.appsData?.version ?? '0.0.1'}</div>
            <div>DEVICE ID: BOP-DECK-7749</div>
            <div>MANUFACTURER: BETTER OFF PUBLISHED LLC</div>
            <div>BOOT COUNT: ${window.BopState.getBootCount()}</div>
            <div>GAMES INSTALLED: ${(this.appsData?.games ?? []).filter(g => g.unlocked).length}</div>
          </div>
        </div>

      </div>
    `;

    document.getElementById('setting-scanlines')?.addEventListener('change', e => {
      const on = e.target.checked;
      window.BopState.updateSetting('scanlines', on);
      document.body.classList.toggle('scanlines-off', !on);
      window.AudioMgr?.play('settings', on ? 'toggle_on' : 'toggle_off');
    });

    document.getElementById('setting-glow')?.addEventListener('change', e => {
      window.BopState.updateSetting('glowEffect', e.target.checked);
      window.AudioMgr?.play('settings', e.target.checked ? 'toggle_on' : 'toggle_off');
    });

    document.getElementById('setting-clock')?.addEventListener('change', e => {
      window.BopState.updateSetting('showClock', e.target.checked);
      const clock = document.getElementById('clock-display');
      if (clock) clock.style.display = e.target.checked ? '' : 'none';
      window.AudioMgr?.play('settings', e.target.checked ? 'toggle_on' : 'toggle_off');
    });

    document.getElementById('setting-music')?.addEventListener('change', e => {
      window.BopState.updateSetting('ambientMusic', e.target.checked);
      window.AudioMgr?.setMusicEnabled(e.target.checked);
      window.AudioMgr?.play('settings', e.target.checked ? 'toggle_on' : 'toggle_off');
    });

    document.getElementById('setting-sfx')?.addEventListener('change', e => {
      window.BopState.updateSetting('sfxEnabled', e.target.checked);
      window.AudioMgr?.setSFXEnabled(e.target.checked);
    });

    content.querySelectorAll('[data-theme-id]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        content.querySelectorAll('[data-theme-id]').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        window.BopState.setTheme(swatch.dataset.themeId);
      });
    });
  }

  // ── GLOBAL EVENTS ─────────────────────────────────────────────

  _bindGlobalEvents() {
    document.getElementById('return-to-deck')?.addEventListener('click', () => {
      window.AudioMgr?.play('ui', 'back');
      window.WinMgr.handleEscapeKey();
    });

    window.addEventListener('resize', () => {});

    document.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON' && !e.target.closest('.notestick')) {
        window.AudioMgr?.play('ui', 'click');
      }
    });
  }
}

window.DeckUI = new DeckUI();
