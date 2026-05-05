/**
 * BOPWARE DECK — Window Manager
 * Handles creation, dragging, resizing, fullscreen of app windows
 * Minimized windows collapse to a tray bar above the taskbar
 */

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.zCounter = 200;
    this.activeWindowId = null;
    this.gameRunning = false;
    this._trayEl = null;
  }

  // ── TRAY ──────────────────────────────────────────────────

  _ensureTray() {
    if (this._trayEl) return;
    this._trayEl = document.getElementById('window-tray');
    if (!this._trayEl) {
      this._trayEl = document.createElement('div');
      this._trayEl.id = 'window-tray';
      document.body.appendChild(this._trayEl);
    }
  }

  _updateTray() {
    this._ensureTray();
    const minimized = [...this.windows.values()].filter(w => w.minimized);

    if (minimized.length === 0) {
      this._trayEl.classList.remove('tray-visible');
      this._trayEl.innerHTML = '';
      return;
    }

    this._trayEl.classList.add('tray-visible');
    this._trayEl.innerHTML = '';

    minimized.forEach(win => {
      const chip = document.createElement('div');
      chip.className = 'tray-chip';
      chip.title = `Click to restore ${win.title}`;

      chip.innerHTML = `
        <span class="tray-chip-icon">${win.icon ?? '▪'}</span>
        <span class="tray-chip-title">${win.title}</span>
        <button class="tray-chip-close" data-close-chip="${win.id}" title="Close ${win.title}">✕</button>
      `;

      // Restore on chip body click
      chip.addEventListener('click', e => {
        if (e.target.dataset.closeChip) return;
        window.AudioMgr?.play('apps', 'app_open');
        this.restore(win.id);
      });

      // Close directly from chip X
      chip.querySelector('.tray-chip-close').addEventListener('click', e => {
        e.stopPropagation();
        window.AudioMgr?.play('apps', 'app_close');
        this.close(win.id);
      });

      this._trayEl.appendChild(chip);
    });
  }

  // ── CREATE WINDOW ──────────────────────────────────────────

  open(config) {
    const {
      id,
      title,
      src,
      width = 700,
      height = 500,
      x,
      y,
      isGame = false,
      icon = '',
      resizable = true,
    } = config;

    // If already open and minimized, restore it
    if (this.windows.has(id)) {
      const existing = this.windows.get(id);
      if (existing.minimized) {
        this.restore(id);
      } else {
        this.focus(id);
      }
      return existing;
    }

    const winEl = document.createElement('div');
    winEl.className = 'app-window';
    winEl.id = `win_${id}`;
    winEl.dataset.windowId = id;
    winEl.tabIndex = 0;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const startX = x ?? Math.max(8, (vw - width) / 2 + Math.random() * 40 - 20);
    const startY = y ?? Math.max(36, (vh - height) / 2 + Math.random() * 40 - 20);

    winEl.style.left = `${startX}px`;
    winEl.style.top = `${startY}px`;
    winEl.style.width = `${width}px`;
    winEl.style.height = `${height}px`;

    if (!resizable) winEl.style.resize = 'none';

    winEl.innerHTML = `
      <div class="window-titlebar" data-drag-handle>
        <div class="window-title">
          ${icon ? `<span>${icon}</span> ` : ''}<span class="window-app-name">${title}</span>
        </div>
        <div class="window-controls">
          <button class="win-btn minimize" title="Minimize">─</button>
          <button class="win-btn maximize" title="Toggle Fullscreen">□</button>
          <button class="win-btn close" title="Close">✕</button>
        </div>
      </div>
      <div class="window-body">
        ${src
          ? `<iframe src="${src}" frameborder="0" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
          : '<div class="window-content"></div>'
        }
      </div>
    `;

    document.getElementById('windows-layer').appendChild(winEl);

    winEl.querySelector('.win-btn.close').addEventListener('click', () => {
      window.AudioMgr?.play('apps', 'app_close');
      this.close(id);
    });

    winEl.querySelector('.win-btn.minimize').addEventListener('click', () => {
      window.AudioMgr?.play('apps', 'app_minimize');
      this.minimize(id);
    });

    winEl.querySelector('.win-btn.maximize').addEventListener('click', () => {
      this.toggleFullscreen(id);
    });

    winEl.addEventListener('mousedown', () => this.focus(id));

    this._makeDraggable(winEl, winEl.querySelector('[data-drag-handle]'));

    const winState = {
      id, el: winEl,
      minimized: false,
      fullscreen: false,
      isGame, src, title,
      icon: icon || (isGame ? '🎮' : '▪'),
    };
    this.windows.set(id, winState);

    this.focus(id);

    if (isGame) {
      this.gameRunning = true;
      this._showReturnButton();
      document.getElementById('taskbar')?.classList.add('hidden');
    }

    window.AudioMgr?.play('apps', isGame ? 'game_launch' : 'app_open');

    return winState;
  }

  // ── CLOSE ─────────────────────────────────────────────────

  close(id) {
    const win = this.windows.get(id);
    if (!win) return;

    if (win.minimized) {
      win.el.remove();
    } else {
      win.el.style.animation = 'fadeOut 0.15s ease forwards';
      win.el.addEventListener('animationend', () => win.el.remove(), { once: true });
    }

    this.windows.delete(id);

    if (this.activeWindowId === id) this.activeWindowId = null;

    const anyVisibleGame = [...this.windows.values()].some(w => w.isGame && !w.minimized);
    if (!anyVisibleGame) {
      this.gameRunning = false;
      this._hideReturnButton();
      document.getElementById('taskbar')?.classList.remove('hidden');
    }

    this._updateTray();
  }

  closeAll() {
    [...this.windows.keys()].forEach(id => this.close(id));
  }

  // ── MINIMIZE ──────────────────────────────────────────────

  minimize(id) {
    const win = this.windows.get(id);
    if (!win || win.minimized) return;

    win.el.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    win.el.style.opacity = '0';
    win.el.style.transform = 'scale(0.95) translateY(4px)';

    setTimeout(() => {
      win.el.style.display = 'none';
      win.el.style.opacity = '';
      win.el.style.transform = '';
      win.el.style.transition = '';
      win.minimized = true;
      this._updateTray();

      // Reveal taskbar/hide return if no visible games remain
      const anyVisibleGame = [...this.windows.values()].some(w => w.isGame && !w.minimized);
      if (!anyVisibleGame) {
        this._hideReturnButton();
        document.getElementById('taskbar')?.classList.remove('hidden');
      }
    }, 150);
  }

  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;

    win.el.style.display = '';
    win.el.style.opacity = '0';
    win.el.style.transform = 'scale(0.97) translateY(4px)';
    win.el.style.transition = 'opacity 0.15s ease, transform 0.15s ease';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        win.el.style.opacity = '1';
        win.el.style.transform = 'scale(1) translateY(0)';
        setTimeout(() => {
          win.el.style.opacity = '';
          win.el.style.transform = '';
          win.el.style.transition = '';
        }, 150);
      });
    });

    win.minimized = false;
    this.focus(id);
    this._updateTray();

    if (win.isGame) {
      this.gameRunning = true;
      this._showReturnButton();
      document.getElementById('taskbar')?.classList.add('hidden');
    }
  }

  // ── FULLSCREEN ────────────────────────────────────────────

  toggleFullscreen(id) {
    const win = this.windows.get(id);
    if (!win) return;

    if (win.fullscreen) {
      win.el.classList.remove('fullscreen');
      if (win._prevStyle) {
        Object.assign(win.el.style, win._prevStyle);
        win._prevStyle = null;
      }
      win.fullscreen = false;
    } else {
      win._prevStyle = {
        top: win.el.style.top,
        left: win.el.style.left,
        width: win.el.style.width,
        height: win.el.style.height,
      };
      win.el.classList.add('fullscreen');
      win.fullscreen = true;
    }
  }

  // ── FOCUS ─────────────────────────────────────────────────

  focus(id) {
    this.zCounter++;
    const win = this.windows.get(id);
    if (!win) return;
    win.el.style.zIndex = this.zCounter;
    this.activeWindowId = id;
  }

  // ── DRAG ──────────────────────────────────────────────────

  _makeDraggable(winEl, handle) {
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.window-controls')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = parseInt(winEl.style.left) || 0;
      origY = parseInt(winEl.style.top) || 0;
      document.body.style.userSelect = 'none';
      window.AudioMgr?.play('apps', 'window_drag');
      e.preventDefault();
    });

    handle.addEventListener('touchstart', e => {
      if (e.target.closest('.window-controls')) return;
      isDragging = true;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      origX = parseInt(winEl.style.left) || 0;
      origY = parseInt(winEl.style.top) || 0;
    }, { passive: true });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      winEl.style.left = `${Math.max(0, origX + (e.clientX - startX))}px`;
      winEl.style.top = `${Math.max(30, origY + (e.clientY - startY))}px`;
    });

    document.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const t = e.touches[0];
      winEl.style.left = `${Math.max(0, origX + (t.clientX - startX))}px`;
      winEl.style.top = `${Math.max(30, origY + (t.clientY - startY))}px`;
    }, { passive: true });

    const stopDrag = () => {
      isDragging = false;
      document.body.style.userSelect = '';
    };

    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  // ── RETURN TO DECK BUTTON ─────────────────────────────────

  _showReturnButton() {
    document.getElementById('return-to-deck')?.classList.add('visible');
  }

  _hideReturnButton() {
    document.getElementById('return-to-deck')?.classList.remove('visible');
  }

  // ── ESCAPE / TILDE ────────────────────────────────────────

  handleEscapeKey() {
    if (!this.activeWindowId || !this.windows.has(this.activeWindowId)) return;
    const win = this.windows.get(this.activeWindowId);
    if (!win.isGame) return;
    if (win.fullscreen) {
      this.toggleFullscreen(this.activeWindowId);
    } else {
      this.close(this.activeWindowId);
    }
  }

  getWindowContent(id) {
    const win = this.windows.get(id);
    if (!win) return null;
    return win.el.querySelector('.window-content');
  }
}

window.WinMgr = new WindowManager();

// Keyboard escape
document.addEventListener('keydown', e => {
  if (e.key === '`' || e.key === '~') {
    window.WinMgr.handleEscapeKey();
  }
});
