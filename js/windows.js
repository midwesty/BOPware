/**
 * BOPWARE DECK — Window Manager
 * Handles creation, dragging, resizing, fullscreen of app windows
 */

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.zCounter = 200;
    this.activeWindowId = null;
    this.gameRunning = false;
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

    // If already open, focus it
    if (this.windows.has(id)) {
      this.focus(id);
      return this.windows.get(id);
    }

    const winEl = document.createElement('div');
    winEl.className = 'app-window';
    winEl.id = `win_${id}`;
    winEl.dataset.windowId = id;
    winEl.tabIndex = 0;

    // Position — center if no x/y given
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
        ${src ? `<iframe src="${src}" frameborder="0" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>` : '<div class="window-content"></div>'}
      </div>
    `;

    document.getElementById('windows-layer').appendChild(winEl);

    // Wire controls
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

    // Focus on click
    winEl.addEventListener('mousedown', () => this.focus(id));

    // Drag
    this._makeDraggable(winEl, winEl.querySelector('[data-drag-handle]'));

    // Store
    const winState = { id, el: winEl, minimized: false, fullscreen: false, isGame, src, title };
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

    win.el.style.animation = 'fadeOut 0.15s ease forwards';
    win.el.addEventListener('animationend', () => win.el.remove(), { once: true });

    this.windows.delete(id);

    // Check if any games still running
    const anyGame = [...this.windows.values()].some(w => w.isGame);
    if (!anyGame) {
      this.gameRunning = false;
      this._hideReturnButton();
      document.getElementById('taskbar')?.classList.remove('hidden');
    }
  }

  closeAll() {
    [...this.windows.keys()].forEach(id => this.close(id));
  }

  // ── MINIMIZE ──────────────────────────────────────────────

  minimize(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.style.display = 'none';
    win.minimized = true;
  }

  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.style.display = '';
    win.minimized = false;
    this.focus(id);
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

    // Touch support
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
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      winEl.style.left = `${Math.max(0, origX + dx)}px`;
      winEl.style.top = `${Math.max(30, origY + dy)}px`;
    });

    document.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      winEl.style.left = `${Math.max(0, origX + dx)}px`;
      winEl.style.top = `${Math.max(30, origY + dy)}px`;
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
    const btn = document.getElementById('return-to-deck');
    if (btn) btn.classList.add('visible');
  }

  _hideReturnButton() {
    const btn = document.getElementById('return-to-deck');
    if (btn) btn.classList.remove('visible');
  }

  // ── ESCAPE KEY / TILDE ────────────────────────────────────

  handleEscapeKey() {
    if (this.activeWindowId && this.windows.has(this.activeWindowId)) {
      const win = this.windows.get(this.activeWindowId);
      if (win.isGame) {
        // Exit fullscreen first if fullscreen
        if (win.fullscreen) {
          this.toggleFullscreen(this.activeWindowId);
        } else {
          this.close(this.activeWindowId);
        }
      }
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
