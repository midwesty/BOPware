/**
 * BOPWARE DECK — Boot Sequence Controller
 * Handles the full cinematic boot animation
 */

class BootSequence {
  constructor() {
    this.container = null;
    this.onComplete = null;
    this.bootMessages = null;
    this.selectedLines = [];
  }

  async init(onComplete) {
    this.onComplete = onComplete;
    this.container = document.getElementById('boot-screen');

    try {
      const res = await fetch('data/boot-messages.json');
      this.bootMessages = await res.json();
    } catch (e) {
      console.warn('[Boot] Could not load boot messages');
      this.bootMessages = { messages: { random: [], first_boot: [], post_update: [] } };
    }
  }

  async run() {
    const isFirst = window.BopState.isFirstBoot();
    const lastVer = window.BopState.getLastVersion();
    const currentVer = this.bootMessages?.firmwareVersion ?? '0.0.1';
    const isUpdate = lastVer && lastVer !== currentVer;

    // Pick message lines
    let msgLines = [];
    let msgType = 'random';

    if (isFirst) {
      const fb = this.bootMessages.messages.first_boot?.[0];
      if (fb && !fb.shown) {
        msgLines = fb.lines;
        msgType = 'first_boot';
      }
    } else if (isUpdate) {
      const pu = this.bootMessages.messages.post_update?.find(
        m => m.triggerVersion === currentVer && !m.shown
      );
      if (pu) {
        msgLines = pu.lines;
        msgType = 'post_update';
      }
    }

    if (msgLines.length === 0) {
      msgLines = this._pickRandom();
      msgType = 'random';
    }

    this.selectedLines = msgLines;

    // Log to state
    window.BopState.addBootLogEntry(msgLines, msgType);

    // Deliver any transmissions tied to this boot type
    this._deliverTransmissions(msgType);

    // Run the sequence
    await this._phase1_bios();
    await this._phase2_static();
    await this._phase3_logo();
    await this._phase4_messages(msgLines);

    // Complete
    window.BopState.incrementBootCount();
    window.BopState.setLastVersion(currentVer);

    this.container.classList.add('done');

    setTimeout(() => {
      this.container.style.display = 'none';
      if (this.onComplete) this.onComplete();
      window.AudioMgr?.startAmbient();
    }, 800);
  }

  // ── PHASE 1: BIOS TEXT ──────────────────────────────────────

  async _phase1_bios() {
    const phase = document.getElementById('boot-bios');
    phase.classList.add('active');
    window.AudioMgr?.play('system', 'boot_start');

    const lines = [
      { text: 'BOPWARE DECK v0.0.1', cls: 'green' },
      { text: 'BETTER OFF PUBLISHED LLC', cls: 'dim' },
      { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', cls: 'dim' },
      { text: 'POST SELF CHECK...', cls: '' },
      { text: 'MEMORY SCAN: ████████████████ OK', cls: 'green' },
      { text: 'SIGNAL ARRAY: CALIBRATING...', cls: '' },
      { text: 'QUANTUM CLOCK: SYNCED (CONFIDENCE 87%)', cls: 'green' },
      { text: 'DEEP SPACE RELAY: STANDBY', cls: 'amber' },
      { text: 'LIBRARY INDEX: LOADING', cls: '' },
      { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', cls: 'dim' },
      { text: 'INITIALIZING DECK OS...', cls: 'green' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const el = document.createElement('div');
      el.className = `bios-line ${lines[i].cls}`;
      el.textContent = lines[i].text;
      phase.appendChild(el);

      await this._delay(80 + Math.random() * 60);
      el.classList.add('typed');
      window.AudioMgr?.play('system', 'boot_beep');
    }

    await this._delay(400);
    phase.classList.remove('active');
    phase.innerHTML = '';
  }

  // ── PHASE 2: STATIC BURST ──────────────────────────────────

  async _phase2_static() {
    const phase = document.getElementById('boot-static-burst');
    phase.classList.add('active');
    window.AudioMgr?.play('system', 'static_burst');

    await this._delay(120);

    // Quick flicker
    for (let i = 0; i < 4; i++) {
      phase.style.opacity = Math.random() > 0.5 ? '1' : '0';
      await this._delay(30 + Math.random() * 40);
    }

    phase.style.opacity = '0';
    await this._delay(100);
    phase.classList.remove('active');
    phase.style.opacity = '';
  }

  // ── PHASE 3: LOGO REVEAL ─────────────────────────────────

  async _phase3_logo() {
    const phase = document.getElementById('boot-logo');
    phase.classList.add('active');
    window.AudioMgr?.play('system', 'power_on_hum');

    // Hold logo with ambient hum
    await this._delay(2200);

    window.AudioMgr?.play('system', 'boot_chime');
    await this._delay(800);

    phase.classList.remove('active');
  }

  // ── PHASE 4: BOOT MESSAGES ────────────────────────────────

  async _phase4_messages(lines) {
    const phase = document.getElementById('boot-messages');
    const progressFill = document.getElementById('boot-progress-fill');
    phase.classList.add('active');
    window.AudioMgr?.play('system', 'signal_ping');

    // Clear any existing lines
    const existing = phase.querySelectorAll('.boot-message-line');
    existing.forEach(el => el.remove());

    // Add cursor
    const cursor = document.createElement('span');
    cursor.className = 'boot-cursor';
    phase.appendChild(cursor);

    for (let i = 0; i < lines.length; i++) {
      const line = document.createElement('div');
      line.className = 'boot-message-line';
      line.textContent = lines[i];
      phase.insertBefore(line, cursor);

      await this._delay(50);
      line.classList.add('visible');
      window.AudioMgr?.play('system', 'boot_beep');

      // Update progress bar
      if (progressFill) {
        progressFill.style.width = `${((i + 1) / lines.length) * 100}%`;
      }

      const delay = lines[i].length > 30 ? 320 : 220;
      await this._delay(delay + Math.random() * 100);
    }

    await this._delay(600);

    // Final flash
    window.AudioMgr?.play('system', 'boot_complete');
    if (progressFill) progressFill.style.width = '100%';

    await this._delay(500);
    phase.classList.remove('active');
  }

  // ── HELPERS ────────────────────────────────────────────────

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _pickRandom() {
    const pool = this.bootMessages?.messages?.random ?? [];
    if (pool.length === 0) return ['SYSTEM READY'];

    // Weighted random
    const totalWeight = pool.reduce((s, m) => s + (m.weight ?? 1), 0);
    let rand = Math.random() * totalWeight;
    for (const msg of pool) {
      rand -= (msg.weight ?? 1);
      if (rand <= 0) return msg.lines;
    }
    return pool[0].lines;
  }

  _deliverTransmissions(type) {
    const msgs = this.bootMessages?.transmissions?.deckMessages ?? [];
    for (const msg of msgs) {
      if (msg.trigger === type || (msg.trigger === 'random' && type === 'random' && Math.random() < 0.3)) {
        // Only add if not already in state
        const existing = window.BopState.getTransmissions().find(t => t.id === msg.id);
        if (!existing) {
          window.BopState.addTransmission(msg);
        }
      }
    }
  }
}

window.BootSeq = new BootSequence();
