/**
 * BOPWARE DECK — NoteStick App
 * Draggable sticky notes with Easter eggs
 */

class NoteStickApp {
  constructor() {
    this.eggData = null;
    this.container = null;
  }

  async init() {
    this.container = document.getElementById('notestick-layer');

    try {
      const res = await fetch('data/notestick-eggs.json');
      this.eggData = await res.json();
    } catch (e) {
      this.eggData = { easterEggs: [] };
    }

    // Restore saved notes
    const saved = window.BopState.getNoteSticks();
    saved.forEach(note => this._renderNote(note));
  }

  createNew(x, y) {
    window.AudioMgr?.play('notestick', 'note_peel');

    const note = window.BopState.addNote({
      text: '',
      x: x ?? 120 + Math.random() * 200,
      y: y ?? 100 + Math.random() * 150,
    });

    this._renderNote(note);

    // Easter egg check
    const count = window.BopState.getNoteCount();
    const egg = this.eggData?.easterEggs?.find(e => e.noteNumber === count);
    if (egg) {
      setTimeout(() => this._showEggNote(egg), 400);
    }
  }

  _renderNote(data) {
    const el = document.createElement('div');
    el.className = 'notestick';
    el.id = `note_${data.id}`;
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;

    el.innerHTML = `
      <div class="notestick-header">
        <span class="notestick-drag-handle">• • • •</span>
        <button class="notestick-close" title="Remove note">✕</button>
      </div>
      <div class="notestick-body">
        <textarea class="notestick-text" placeholder="Write something...">${data.text ?? ''}</textarea>
      </div>
      <div class="notestick-footer">NOTE #${data.number ?? '?'}</div>
    `;

    this.container.appendChild(el);

    // Close button
    el.querySelector('.notestick-close').addEventListener('click', () => {
      window.AudioMgr?.play('notestick', 'note_delete');
      el.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => {
        el.remove();
        window.BopState.removeNote(data.id);
      }, 200);
    });

    // Save text changes
    const textarea = el.querySelector('.notestick-text');
    let saveTimer;
    textarea.addEventListener('input', () => {
      window.AudioMgr?.play('notestick', 'note_write');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        window.BopState.updateNote(data.id, { text: textarea.value });
      }, 500);
    });

    // Focus / bring to front
    el.addEventListener('mousedown', () => {
      document.querySelectorAll('.notestick').forEach(n => {
        n.style.zIndex = 300;
      });
      el.style.zIndex = 310;
    });

    // Make draggable
    this._makeDraggable(el, el.querySelector('.notestick-header'), data.id);

    // Focus new empty note
    if (!data.text) {
      setTimeout(() => textarea.focus(), 100);
    }

    window.AudioMgr?.play('notestick', 'note_place');
  }

  _showEggNote(egg) {
    const eggNote = window.BopState.addNote({
      text: `🥚 ${egg.message}`,
      x: 80 + Math.random() * 300,
      y: 80 + Math.random() * 200,
    });
    this._renderNote(eggNote);

    // Style the egg note slightly differently
    const el = document.getElementById(`note_${eggNote.id}`);
    if (el) {
      el.style.background = '#e8ffb0';
      el.style.borderColor = '#88cc00';
    }
  }

  _makeDraggable(el, handle, noteId) {
    let isDragging = false;
    let startX, startY, origX, origY;

    const start = (cx, cy) => {
      isDragging = true;
      startX = cx;
      startY = cy;
      origX = parseInt(el.style.left) || 0;
      origY = parseInt(el.style.top) || 0;
    };

    handle.addEventListener('mousedown', e => {
      if (e.target.classList.contains('notestick-close')) return;
      start(e.clientX, e.clientY);
      e.preventDefault();
    });

    handle.addEventListener('touchstart', e => {
      if (e.target.classList.contains('notestick-close')) return;
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });

    const move = (cx, cy) => {
      if (!isDragging) return;
      const x = Math.max(0, origX + (cx - startX));
      const y = Math.max(32, origY + (cy - startY));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    }, { passive: true });

    const stop = () => {
      if (!isDragging) return;
      isDragging = false;
      window.BopState.updateNote(noteId, {
        x: parseInt(el.style.left),
        y: parseInt(el.style.top),
      });
    };

    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop);
  }

  clearAll() {
    document.querySelectorAll('.notestick').forEach(el => el.remove());
  }
}

window.NoteStickApp = new NoteStickApp();
