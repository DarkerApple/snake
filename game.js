/* ===========================================================================
   Serpent — base snake game engine
   ---------------------------------------------------------------------------
   Vanilla JS + Canvas. No build step, works from file:// and on mobile.
   Structured for extension (this is the base for an RPG snake game):
     - CONFIG / PALETTE      tunable constants
     - AudioFX               procedural WebAudio blips (no assets)
     - ParticleField         lightweight burst particles
     - Game                  state machine, update + render, input

   Smooth grid movement: logic advances one cell per "tick"; rendering
   interpolates between the previous and current cell positions so the
   snake glides instead of stepping.
=========================================================================== */
(() => {
  'use strict';

  // ------------------------------------------------------------------ config
  const CONFIG = {
    cols: 19,
    rows: 19,
    startLength: 4,
    baseTickMs: 150,     // ms per step at score 0
    minTickMs: 78,       // fastest step time
    speedStepMs: 2.2,    // shave this many ms per food eaten
    growPerFood: 1,      // segments gained per food
    maxStageSize: 600,
    minStageSize: 220,
  };

  const PALETTE = {
    boardTop: '#0b1024',
    boardBottom: '#080b18',
    grid: 'rgba(120, 150, 255, 0.05)',
    gridStrong: 'rgba(120, 150, 255, 0.08)',
    snakeHead: '#9dffca',
    snakeMid: '#37e0a6',
    snakeTail: '#1b9fd6',
    snakeGlow: 'rgba(60, 226, 180, 0.55)',
    sheen: 'rgba(255, 255, 255, 0.16)',
    eye: '#0a0e1a',
    eyeShine: '#ffffff',
    food: '#ffd35c',
    foodCore: '#fff6d6',
    foodGlow: 'rgba(255, 190, 70, 0.75)',
    deathBurst: '#ff6b6b',
  };

  // ------------------------------------------------------------------- utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randInt = (n) => Math.floor(Math.random() * n);
  const nowMs = () => performance.now();

  // ------------------------------------------------------------- audio (fx)
  class AudioFX {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }
    _ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    resume() {
      this._ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    _tone(freq, dur, type = 'sine', gain = 0.05, slideTo = null) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    eat() {
      this.resume();
      this._tone(520, 0.09, 'triangle', 0.06, 880);
    }
    turn() { /* reserved for future juice */ }
    start() { this.resume(); this._tone(320, 0.12, 'sine', 0.05, 640); }
    death() {
      this.resume();
      this._tone(300, 0.5, 'sawtooth', 0.06, 70);
    }
  }

  // --------------------------------------------------------- particle field
  class ParticleField {
    constructor() { this.items = []; }
    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const s = speed * (0.4 + Math.random() * 0.8);
        this.items.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 1,
          decay: 0.8 + Math.random() * 0.9,
          size: 2 + Math.random() * 3,
          color,
        });
      }
    }
    update(dt) {
      const s = dt / 1000;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.items[i];
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.vy += 30 * s; // gentle gravity
        p.life -= p.decay * s;
        if (p.life <= 0) this.items.splice(i, 1);
      }
    }
    draw(ctx) {
      for (const p of this.items) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    clear() { this.items.length = 0; }
  }

  // ------------------------------------------------------------------- game
  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.stage = document.getElementById('stage');
      this.overlay = document.getElementById('overlay');
      this.scoreEl = document.getElementById('score');
      this.bestEl = document.getElementById('best');
      this.pauseBtn = document.getElementById('pauseBtn');
      this.muteBtn = document.getElementById('muteBtn');

      this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      this.cell = 20;

      this.audio = new AudioFX();
      this.particles = new ParticleField();

      this.state = 'menu';       // menu | playing | paused | dead
      this.score = 0;
      this.best = this._loadBest();
      this.time = 0;             // ms accumulator for animation
      this.shake = 0;

      this._bindEvents();
      this.resize();
      this.reset();
      this._renderOverlay();
      this._syncHud();

      this.lastFrame = nowMs();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    // ------------------------------------------------------------ persistence
    _loadBest() {
      try { return parseInt(localStorage.getItem('serpent.best') || '0', 10) || 0; }
      catch { return 0; }
    }
    _saveBest() {
      try { localStorage.setItem('serpent.best', String(this.best)); } catch { /* ignore */ }
    }

    // ------------------------------------------------------------------ setup
    reset() {
      const cx = Math.floor(CONFIG.cols / 2);
      const cy = Math.floor(CONFIG.rows / 2);
      this.snake = [];
      for (let i = 0; i < CONFIG.startLength; i++) {
        this.snake.push({ x: cx - i, y: cy });
      }
      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.dir = { x: 1, y: 0 };
      this.pending = [];
      this.grow = 0;
      this.score = 0;
      this.acc = 0;
      this.interp = 0;
      this.tickMs = CONFIG.baseTickMs;
      this.particles.clear();
      this.shake = 0;
      this._placeFood();
      this._syncHud();
    }

    _placeFood() {
      const occupied = new Set(this.snake.map((s) => s.x + ',' + s.y));
      const free = [];
      for (let y = 0; y < CONFIG.rows; y++) {
        for (let x = 0; x < CONFIG.cols; x++) {
          if (!occupied.has(x + ',' + y)) free.push({ x, y });
        }
      }
      this.food = free.length ? free[randInt(free.length)] : null;
    }

    // ------------------------------------------------------------ state flow
    start() {
      if (this.state === 'playing') return;
      if (this.state === 'menu' || this.state === 'dead') this.reset();
      this.state = 'playing';
      this.acc = 0;
      this.lastFrame = nowMs();
      this.audio.start();
      this._renderOverlay();
    }
    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.lastFrame = nowMs();
      } else {
        return;
      }
      this._renderOverlay();
    }
    _die() {
      this.state = 'dead';
      this.shake = 1;
      const head = this.snake[0];
      this.particles.burst(
        (head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell,
        PALETTE.snakeHead, 18, 220
      );
      this.particles.burst(
        (head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell,
        PALETTE.deathBurst, 10, 150
      );
      this.audio.death();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      if (this.score > this.best) { this.best = this.score; this._saveBest(); this._newBest = true; }
      else { this._newBest = false; }
      this._syncHud();
      this._renderOverlay();
    }

    // ------------------------------------------------------------------ input
    _queueDir(nx, ny) {
      const last = this.pending.length ? this.pending[this.pending.length - 1] : this.dir;
      if (nx === -last.x && ny === -last.y) return; // no 180° reversal
      if (nx === last.x && ny === last.y) return;    // no duplicate
      if (this.pending.length < 2) this.pending.push({ x: nx, y: ny });
    }

    _step() {
      if (this.pending.length) this.dir = this.pending.shift();

      const head = this.snake[0];
      let nx = head.x + this.dir.x;
      let ny = head.y + this.dir.y;

      // wall collision
      if (nx < 0 || ny < 0 || nx >= CONFIG.cols || ny >= CONFIG.rows) {
        this._die();
        return;
      }

      const willEat = this.food && nx === this.food.x && ny === this.food.y;
      // self collision (tail cell frees up unless we're growing)
      const body = (willEat || this.grow > 0)
        ? this.snake
        : this.snake.slice(0, this.snake.length - 1);
      if (body.some((c) => c.x === nx && c.y === ny)) {
        this._die();
        return;
      }

      // commit move (snapshot first for interpolation)
      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.snake.unshift({ x: nx, y: ny });
      if (this.grow > 0) { this.grow--; }
      else { this.snake.pop(); }

      if (willEat) {
        this.score++;
        this.grow += CONFIG.growPerFood;
        this.tickMs = Math.max(CONFIG.minTickMs, CONFIG.baseTickMs - this.score * CONFIG.speedStepMs);
        this.particles.burst(
          (this.food.x + 0.5) * this.cell, (this.food.y + 0.5) * this.cell,
          PALETTE.food, 14, 170
        );
        this.audio.eat();
        if (navigator.vibrate) navigator.vibrate(18);
        this._placeFood();
        this._syncHud();
      }
    }

    // ------------------------------------------------------------------- loop
    loop(t) {
      const dt = Math.min(64, t - this.lastFrame);
      this.lastFrame = t;
      this.time += dt;

      if (this.state === 'playing') {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= this.tickMs && steps < 5) {
          this.acc -= this.tickMs;
          this._step();
          steps++;
          if (this.state !== 'playing') { this.acc = 0; break; }
        }
        this.interp = this.tickMs ? clamp(this.acc / this.tickMs, 0, 1) : 1;
      }

      this.particles.update(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt / 380);

      this.render();
      requestAnimationFrame(this.loop);
    }

    // ---------------------------------------------------------------- render
    render() {
      const ctx = this.ctx;
      const size = CONFIG.cols * this.cell;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, size, CONFIG.rows * this.cell);

      // screen shake
      if (this.shake > 0) {
        const m = this.shake * this.shake * 8;
        ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
      }

      this._drawBoard(ctx);
      this._drawGrid(ctx);
      if (this.food) this._drawFood(ctx);
      this._drawSnake(ctx);
      this.particles.draw(ctx);
    }

    _drawBoard(ctx) {
      const w = CONFIG.cols * this.cell;
      const h = CONFIG.rows * this.cell;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, PALETTE.boardTop);
      g.addColorStop(1, PALETTE.boardBottom);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);

      // soft center glow
      const rg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.7);
      rg.addColorStop(0, 'rgba(60, 90, 170, 0.12)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    _drawGrid(ctx) {
      const c = this.cell;
      ctx.lineWidth = 1;
      ctx.strokeStyle = PALETTE.grid;
      ctx.beginPath();
      for (let i = 1; i < CONFIG.cols; i++) {
        ctx.moveTo(i * c + 0.5, 0);
        ctx.lineTo(i * c + 0.5, CONFIG.rows * c);
      }
      for (let j = 1; j < CONFIG.rows; j++) {
        ctx.moveTo(0, j * c + 0.5);
        ctx.lineTo(CONFIG.cols * c, j * c + 0.5);
      }
      ctx.stroke();
    }

    _drawFood(ctx) {
      const c = this.cell;
      const cx = (this.food.x + 0.5) * c;
      const cy = (this.food.y + 0.5) * c;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 0.006);
      const r = c * 0.30 * (1 + 0.12 * pulse);

      ctx.save();
      // glow halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
      halo.addColorStop(0, PALETTE.foodGlow);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // orb body
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, PALETTE.foodCore);
      body.addColorStop(0.55, PALETTE.food);
      body.addColorStop(1, '#e39a2a');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.34, cy - r * 0.4, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _renderPoints() {
      const cur = this.snake;
      const prev = this.prevSnake;
      const t = this.state === 'playing' ? this.interp : 1;
      const pts = [];
      for (let i = 0; i < cur.length; i++) {
        if (i < prev.length) {
          pts.push({
            x: (lerp(prev[i].x, cur[i].x, t) + 0.5) * this.cell,
            y: (lerp(prev[i].y, cur[i].y, t) + 0.5) * this.cell,
          });
        } else {
          pts.push({ x: (cur[i].x + 0.5) * this.cell, y: (cur[i].y + 0.5) * this.cell });
        }
      }
      return pts;
    }

    _drawSnake(ctx) {
      const pts = this._renderPoints();
      if (!pts.length) return;
      const c = this.cell;
      const head = pts[0];
      const tail = pts[pts.length - 1];

      // body: single smooth stroked tube with head->tail gradient + glow
      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      grad.addColorStop(0, PALETTE.snakeHead);
      grad.addColorStop(0.5, PALETTE.snakeMid);
      grad.addColorStop(1, PALETTE.snakeTail);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.save();
      ctx.shadowColor = PALETTE.snakeGlow;
      ctx.shadowBlur = c * 0.7;
      ctx.strokeStyle = grad;
      ctx.lineWidth = c * 0.76;
      this._tracePath(ctx, pts);
      ctx.stroke();
      ctx.restore();

      // glossy sheen along the top
      ctx.save();
      ctx.strokeStyle = PALETTE.sheen;
      ctx.lineWidth = c * 0.26;
      this._tracePath(ctx, pts);
      ctx.stroke();
      ctx.restore();

      this._drawHead(ctx, head);
    }

    _tracePath(ctx, pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) { ctx.lineTo(pts[0].x + 0.01, pts[0].y); return; }
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }

    _drawHead(ctx, head) {
      const c = this.cell;
      const d = this.dir;
      const r = c * 0.42;

      ctx.save();
      ctx.shadowColor = PALETTE.snakeGlow;
      ctx.shadowBlur = c * 0.6;
      ctx.fillStyle = PALETTE.snakeHead;
      ctx.beginPath();
      ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // eyes: offset perpendicular to travel + slightly forward
      const perp = { x: -d.y, y: d.x };
      const fwd = c * 0.12;
      const spread = c * 0.17;
      const er = c * 0.11;
      for (const s of [1, -1]) {
        const ex = head.x + d.x * fwd + perp.x * spread * s;
        const ey = head.y + d.y * fwd + perp.y * spread * s;
        ctx.fillStyle = PALETTE.eyeShine;
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.eye;
        ctx.beginPath();
        ctx.arc(ex + d.x * er * 0.4, ey + d.y * er * 0.4, er * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // -------------------------------------------------------------- hud / ui
    _syncHud() {
      if (this.scoreEl) this.scoreEl.textContent = String(this.score);
      if (this.bestEl) this.bestEl.textContent = String(this.best);
    }

    _renderOverlay() {
      const o = this.overlay;
      if (this.state === 'playing') {
        o.classList.add('hidden');
        o.innerHTML = '';
        if (this.pauseBtn) this.pauseBtn.setAttribute('aria-label', 'Pause');
        return;
      }
      o.classList.remove('hidden');

      if (this.state === 'menu') {
        o.innerHTML = `
          <h2 class="title">Serpent</h2>
          <p class="subtitle">Guide the serpent, feast on light, and grow. Don't bite yourself or hit the walls.</p>
          <button class="btn pulse" data-action="start">Play</button>
          <div class="keys">
            <span class="key">↑ ↓ ← →</span><span class="key">WASD</span><span class="key">Swipe</span>
          </div>`;
      } else if (this.state === 'paused') {
        o.innerHTML = `
          <h2 class="title">Paused</h2>
          <button class="btn" data-action="resume">Resume</button>
          <div class="keys"><span class="key">Space</span><span class="key">to resume</span></div>`;
      } else if (this.state === 'dead') {
        o.innerHTML = `
          <h2 class="title">Game Over</h2>
          <div class="final">
            <div class="score-block"><div class="fs-label">Score</div><div class="fs-num">${this.score}</div></div>
            <div class="best score-block"><div class="fs-label">Best</div><div class="fs-num">${this.best}</div></div>
          </div>
          ${this._newBest ? '<div class="badge-new">New Best!</div>' : ''}
          <button class="btn pulse" data-action="start">Play Again</button>`;
      }
    }

    // ---------------------------------------------------------------- events
    _bindEvents() {
      // keyboard
      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

        if (k === 'arrowup' || k === 'w') this._onDirIntent(0, -1);
        else if (k === 'arrowdown' || k === 's') this._onDirIntent(0, 1);
        else if (k === 'arrowleft' || k === 'a') this._onDirIntent(-1, 0);
        else if (k === 'arrowright' || k === 'd') this._onDirIntent(1, 0);
        else if (k === ' ' || k === 'enter') this._onPrimaryAction();
        else if (k === 'p' || k === 'escape') { if (this.state === 'playing' || this.state === 'paused') this.togglePause(); }
      }, { passive: false });

      // overlay buttons
      this.overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const a = btn.getAttribute('data-action');
        if (a === 'start') this.start();
        else if (a === 'resume') this.togglePause();
      });

      this.pauseBtn.addEventListener('click', () => {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        else if (this.state === 'menu' || this.state === 'dead') this.start();
      });
      this.muteBtn.addEventListener('click', () => {
        this.audio.enabled = !this.audio.enabled;
        this.muteBtn.classList.toggle('muted', !this.audio.enabled);
        if (this.audio.enabled) this.audio.resume();
      });

      // touch / swipe on the stage
      let sx = 0, sy = 0, st = 0, tracking = false;
      const SWIPE = 24;
      this.stage.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        sx = t.clientX; sy = t.clientY; st = nowMs(); tracking = true;
      }, { passive: true });
      this.stage.addEventListener('touchmove', (e) => {
        if (!tracking || this.state !== 'playing') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
        if (Math.abs(dx) > Math.abs(dy)) this._onDirIntent(dx > 0 ? 1 : -1, 0);
        else this._onDirIntent(0, dy > 0 ? 1 : -1);
        sx = t.clientX; sy = t.clientY; // allow chained swipes
        e.preventDefault();
      }, { passive: false });
      this.stage.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        const moved = Math.abs(dx) + Math.abs(dy);
        // a tap (little movement) starts / restarts the game
        if (moved < SWIPE && (this.state === 'menu' || this.state === 'dead')) {
          this.start();
        }
      }, { passive: true });

      // resize / lifecycle
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });
    }

    _onDirIntent(x, y) {
      if (this.state === 'playing') {
        this._queueDir(x, y);
      } else if (this.state === 'menu' || this.state === 'dead') {
        this.start();
        this._queueDir(x, y);
      }
    }
    _onPrimaryAction() {
      if (this.state === 'menu' || this.state === 'dead') this.start();
      else if (this.state === 'playing' || this.state === 'paused') this.togglePause();
    }

    // ---------------------------------------------------------------- layout
    resize() {
      const hud = document.getElementById('hud');
      const hint = document.getElementById('hint');
      const pad = 28;
      const chrome = (hud ? hud.offsetHeight : 0) + (hint ? hint.offsetHeight : 0) + 40;

      const availW = window.innerWidth - pad;
      const availH = window.innerHeight - chrome - pad;
      let size = Math.min(availW, availH);
      size = clamp(size, CONFIG.minStageSize, CONFIG.maxStageSize);

      // snap so the cell size is an integer -> crisp grid
      this.cell = Math.floor(size / CONFIG.cols);
      const boardPx = this.cell * CONFIG.cols;
      const boardPy = this.cell * CONFIG.rows;

      this.stage.style.width = boardPx + 'px';
      this.stage.style.height = boardPy + 'px';

      this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      this.canvas.width = Math.round(boardPx * this.dpr);
      this.canvas.height = Math.round(boardPy * this.dpr);
      this.canvas.style.width = boardPx + 'px';
      this.canvas.style.height = boardPy + 'px';
    }
  }

  // boot once DOM + (optional) fonts are ready
  const boot = () => { window.__serpent = new Game(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
