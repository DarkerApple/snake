/* ===========================================================================
   Serpent — snake game with fruit, XP levels and coins
   ---------------------------------------------------------------------------
   Vanilla JS + Canvas. No build step, works from file:// and on mobile.

   Progression:
     - Several fruit types spawn on the board at once (weighted by rarity).
     - Eating fruit grants XP; rarer fruit grants more.
     - Filling the XP bar levels you up and awards coins (a persistent wallet).

   Structure: CONFIG / PALETTE / FRUITS constants, then AudioFX,
   ParticleField, and the Game state machine.
=========================================================================== */
(() => {
  'use strict';

  // ------------------------------------------------------------------ config
  const CONFIG = {
    cols: 19,
    rows: 19,
    startLength: 4,
    baseTickMs: 155,      // ms per step at level 1
    minTickMs: 82,        // fastest step time
    speedPerLevel: 6,     // shave this many ms off the step time per level
    foodCount: 3,         // fruits on the board at once
    maxStageSize: 560,
    minStageSize: 220,
  };

  const PALETTE = {
    boardTop: '#0c1120',
    boardBottom: '#090d18',
    grid: 'rgba(255, 255, 255, 0.035)',
    snakeHead: '#7cf0b4',
    snakeTail: '#2aa970',
    snakeGlow: 'rgba(64, 217, 138, 0.35)',
    sheen: 'rgba(255, 255, 255, 0.14)',
    eye: '#0a0e1a',
    eyeShine: '#ffffff',
    coin: '#ffce4a',
  };

  // Fruit catalogue. `xp` is reward; `weight` is spawn frequency (rarity).
  const FRUITS = [
    { id: 'apple',      xp: 1, weight: 26, color: '#ff5a5f', draw: drawApple },
    { id: 'orange',     xp: 1, weight: 22, color: '#ffa53b', draw: drawOrange },
    { id: 'blueberry',  xp: 1, weight: 18, color: '#6ea8ff', draw: drawBlueberry },
    { id: 'cherry',     xp: 2, weight: 13, color: '#e84a5f', draw: drawCherry },
    { id: 'banana',     xp: 2, weight: 11, color: '#ffd23b', draw: drawBanana },
    { id: 'grapes',     xp: 3, weight: 6,  color: '#a77bff', draw: drawGrapes },
    { id: 'strawberry', xp: 3, weight: 4,  color: '#ff4d6d', draw: drawStrawberry },
  ];
  const FRUIT_WEIGHT = FRUITS.reduce((s, f) => s + f.weight, 0);

  // ------------------------------------------------------------------- utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randInt = (n) => Math.floor(Math.random() * n);
  const nowMs = () => performance.now();

  function pickFruit() {
    let r = Math.random() * FRUIT_WEIGHT;
    for (const f of FRUITS) { if ((r -= f.weight) <= 0) return f; }
    return FRUITS[0];
  }

  // --------------------------------------------------------- fruit drawings
  // All take (ctx, x, y, r): centre point and a base radius (~half a cell).
  function drawApple(ctx, x, y, r) {
    ctx.strokeStyle = '#7a4b2b'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.75); ctx.lineTo(x + r * 0.14, y - r * 1.15); ctx.stroke();
    ctx.fillStyle = '#5cc46a';
    ctx.beginPath(); ctx.ellipse(x + r * 0.5, y - r * 1.0, r * 0.36, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
    fillCircle(ctx, x, y, r, '#ff5a5f');
    highlight(ctx, x, y, r);
  }
  function drawOrange(ctx, x, y, r) {
    ctx.fillStyle = '#5cc46a';
    ctx.beginPath(); ctx.ellipse(x + r * 0.35, y - r * 0.95, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
    fillCircle(ctx, x, y, r, '#ffa53b');
    ctx.fillStyle = 'rgba(214, 122, 20, 0.5)';
    ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.25, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 0.15, y + r * 0.4, r * 0.08, 0, Math.PI * 2); ctx.fill();
    highlight(ctx, x, y, r);
  }
  function drawBlueberry(ctx, x, y, r) {
    fillCircle(ctx, x, y, r * 0.92, '#6ea8ff');
    fillCircle(ctx, x, y, r * 0.92, null, '#2f6bd6', r * 0.12); // outline
    ctx.fillStyle = '#294f8f';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.16, y - r * 0.28 + Math.sin(a) * r * 0.16, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    highlight(ctx, x, y, r * 0.92);
  }
  function drawCherry(ctx, x, y, r) {
    const rr = r * 0.55;
    ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - rr * 0.7, y + r * 0.15); ctx.quadraticCurveTo(x, y - r * 1.1, x + r * 0.15, y - r * 1.05);
    ctx.moveTo(x + rr * 0.9, y + r * 0.15); ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.9, x + r * 0.2, y - r * 1.05);
    ctx.stroke();
    fillCircle(ctx, x - rr * 0.7, y + r * 0.35, rr, '#e84a5f');
    fillCircle(ctx, x + rr * 0.9, y + r * 0.35, rr, '#d93a52');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(x - rr * 0.9, y + r * 0.15, rr * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  function drawBanana(ctx, x, y, r) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f7c948'; ctx.lineWidth = r * 0.62;
    ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 1.02, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 1.16, Math.PI * 0.28, Math.PI * 0.72); ctx.stroke();
    ctx.fillStyle = '#6b4b2a';
    ctx.beginPath(); ctx.arc(x - r * 0.82, y + r * 0.28, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.82, y + r * 0.28, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  function drawGrapes(ctx, x, y, r) {
    ctx.strokeStyle = '#6b4b2a'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.7); ctx.lineTo(x, y - r * 1.05); ctx.stroke();
    ctx.fillStyle = '#5cc46a';
    ctx.beginPath(); ctx.ellipse(x + r * 0.3, y - r * 0.95, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
    const g = r * 0.33;
    const pts = [[-1, -0.4], [1, -0.4], [0, -0.1], [-2, 0.2], [2, 0.2], [-1, 0.55], [1, 0.55], [0, 0.9]];
    for (const [dx, dy] of pts) fillCircle(ctx, x + dx * g, y + dy * r * 0.9, g, '#a77bff');
    for (const [dx, dy] of pts) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(x + dx * g - g * 0.3, y + dy * r * 0.9 - g * 0.3, g * 0.28, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawStrawberry(ctx, x, y, r) {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 1.05);
    ctx.quadraticCurveTo(x - r * 1.15, y + r * 0.15, x - r * 0.55, y - r * 0.55);
    ctx.quadraticCurveTo(x, y - r * 0.1, x + r * 0.55, y - r * 0.55);
    ctx.quadraticCurveTo(x + r * 1.15, y + r * 0.15, x, y + r * 1.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 227, 150, 0.95)';
    const seeds = [[-0.35, -0.1], [0.35, -0.1], [0, 0.2], [-0.5, 0.35], [0.5, 0.35], [-0.2, 0.55], [0.2, 0.55]];
    for (const [dx, dy] of seeds) {
      ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, r * 0.09, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4bbf5f';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.5);
      ctx.lineTo(x + Math.cos(a) * r * 0.7, y - r * 0.5 + Math.sin(a) * r * 0.5);
      ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.35, y - r * 0.35);
      ctx.fill();
    }
  }
  // small drawing helpers
  function fillCircle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function highlight(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.36, r * 0.2, 0, Math.PI * 2); ctx.fill();
  }

  // ------------------------------------------------------------- audio (fx)
  class AudioFX {
    constructor() { this.enabled = true; this.ctx = null; }
    _ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    resume() { this._ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    _tone(freq, dur, type = 'sine', gain = 0.05, slideTo = null, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    eat() { this.resume(); this._tone(520, 0.08, 'triangle', 0.05, 760); }
    levelUp() {
      this.resume();
      this._tone(523, 0.12, 'triangle', 0.05, null, 0);
      this._tone(659, 0.12, 'triangle', 0.05, null, 0.08);
      this._tone(784, 0.18, 'triangle', 0.05, null, 0.16);
    }
    start() { this.resume(); this._tone(320, 0.12, 'sine', 0.04, 620); }
    death() { this.resume(); this._tone(300, 0.5, 'sawtooth', 0.05, 70); }
  }

  // --------------------------------------------------------- particle field
  class ParticleField {
    constructor() { this.items = []; }
    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const s = speed * (0.4 + Math.random() * 0.8);
        this.items.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 1, decay: 0.9 + Math.random() * 0.9,
          size: 2 + Math.random() * 3, color,
        });
      }
    }
    update(dt) {
      const s = dt / 1000;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.items[i];
        p.x += p.vx * s; p.y += p.vy * s;
        p.vx *= 0.9; p.vy *= 0.9; p.vy += 30 * s;
        p.life -= p.decay * s;
        if (p.life <= 0) this.items.splice(i, 1);
      }
    }
    draw(ctx) {
      for (const p of this.items) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
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
      this.levelEl = document.getElementById('level');
      this.coinsEl = document.getElementById('coins');
      this.xpFillEl = document.getElementById('xpFill');
      this.xpTrackEl = this.xpFillEl ? this.xpFillEl.parentElement : null;
      this.pauseBtn = document.getElementById('pauseBtn');
      this.muteBtn = document.getElementById('muteBtn');

      this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      this.cell = 20;

      this.audio = new AudioFX();
      this.particles = new ParticleField();
      this.fruitTypes = FRUITS; // fruit catalogue (also handy for future systems)

      this.state = 'menu';
      this.time = 0;
      this.shake = 0;

      // persistent wallet + best level
      this.coins = this._loadNum('serpent.coins');
      this.bestLevel = this._loadNum('serpent.bestLevel') || 1;

      this._bindEvents();
      this.resize();
      this.reset();
      this._renderOverlay();
      this._syncHud();

      this.lastFrame = nowMs();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    _loadNum(key) { try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch { return 0; } }
    _save(key, val) { try { localStorage.setItem(key, String(val)); } catch { /* ignore */ } }

    // ------------------------------------------------------------------ setup
    reset() {
      const cx = Math.floor(CONFIG.cols / 2);
      const cy = Math.floor(CONFIG.rows / 2);
      this.snake = [];
      for (let i = 0; i < CONFIG.startLength; i++) this.snake.push({ x: cx - i, y: cy });
      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.dir = { x: 1, y: 0 };
      this.pending = [];
      this.grow = 0;
      this.acc = 0;
      this.interp = 0;

      // run progression
      this.level = 1;
      this.xp = 0;
      this.eaten = 0;
      this.coinsThisRun = 0;
      this.tickMs = CONFIG.baseTickMs;

      this.foods = [];
      this._refillFood();
      this.particles.clear();
      this.shake = 0;
      this._updateXpBar();
      this._syncHud();
    }

    _xpNeed(level) { return 4 + level * 3; }

    _freeCells() {
      const taken = new Set(this.snake.map((s) => s.x + ',' + s.y));
      for (const f of this.foods) taken.add(f.x + ',' + f.y);
      const free = [];
      for (let y = 0; y < CONFIG.rows; y++)
        for (let x = 0; x < CONFIG.cols; x++)
          if (!taken.has(x + ',' + y)) free.push({ x, y });
      return free;
    }

    _refillFood() {
      while (this.foods.length < CONFIG.foodCount) {
        const free = this._freeCells();
        if (!free.length) break;
        const cell = free[randInt(free.length)];
        this.foods.push({ x: cell.x, y: cell.y, fruit: pickFruit(), born: this.time });
      }
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
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') { this.state = 'playing'; this.lastFrame = nowMs(); }
      else return;
      this._renderOverlay();
    }
    _die() {
      this.state = 'dead';
      this.shake = 1;
      const head = this.snake[0];
      this.particles.burst((head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell, PALETTE.snakeHead, 16, 210);
      this.particles.burst((head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell, '#ff6b6b', 10, 150);
      this.audio.death();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      this._newBest = this.level > this.bestLevel;
      if (this._newBest) { this.bestLevel = this.level; this._save('serpent.bestLevel', this.bestLevel); }
      this._renderOverlay();
    }

    // ------------------------------------------------------------------ input
    _queueDir(nx, ny) {
      const last = this.pending.length ? this.pending[this.pending.length - 1] : this.dir;
      if (nx === -last.x && ny === -last.y) return;
      if (nx === last.x && ny === last.y) return;
      if (this.pending.length < 2) this.pending.push({ x: nx, y: ny });
    }

    _step() {
      if (this.pending.length) this.dir = this.pending.shift();
      const head = this.snake[0];
      const nx = head.x + this.dir.x;
      const ny = head.y + this.dir.y;

      if (nx < 0 || ny < 0 || nx >= CONFIG.cols || ny >= CONFIG.rows) { this._die(); return; }

      const foodIndex = this.foods.findIndex((f) => f.x === nx && f.y === ny);
      const willEat = foodIndex >= 0;
      const body = (willEat || this.grow > 0) ? this.snake : this.snake.slice(0, this.snake.length - 1);
      if (body.some((c) => c.x === nx && c.y === ny)) { this._die(); return; }

      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.snake.unshift({ x: nx, y: ny });
      if (this.grow > 0) this.grow--; else this.snake.pop();

      if (willEat) {
        const eaten = this.foods.splice(foodIndex, 1)[0];
        this.grow += 1;
        this.eaten += 1;
        this.particles.burst((nx + 0.5) * this.cell, (ny + 0.5) * this.cell, eaten.fruit.color, 12, 160);
        this.audio.eat();
        if (navigator.vibrate) navigator.vibrate(14);
        this._gainXp(eaten.fruit.xp);
        this._refillFood();
      }
    }

    _gainXp(amount) {
      this.xp += amount;
      let need = this._xpNeed(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level += 1;
        const reward = 5 + this.level * 2;
        this.coins += reward;
        this.coinsThisRun += reward;
        this._onLevelUp();
        need = this._xpNeed(this.level);
      }
      this._save('serpent.coins', this.coins);
      this._updateXpBar();
      this._syncHud();
    }

    _onLevelUp() {
      this.tickMs = Math.max(CONFIG.minTickMs, CONFIG.baseTickMs - (this.level - 1) * CONFIG.speedPerLevel);
      const head = this.snake[0];
      this.particles.burst((head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell, PALETTE.coin, 18, 200);
      this.audio.levelUp();
      if (navigator.vibrate) navigator.vibrate([12, 26, 12]);
      if (this.xpTrackEl) {
        this.xpTrackEl.classList.remove('flash');
        void this.xpTrackEl.offsetWidth; // restart animation
        this.xpTrackEl.classList.add('flash');
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
      const w = CONFIG.cols * this.cell;
      const h = CONFIG.rows * this.cell;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (this.shake > 0) {
        const m = this.shake * this.shake * 7;
        ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
      }

      this._drawBoard(ctx, w, h);
      this._drawGrid(ctx);
      this._drawFoods(ctx);
      this._drawSnake(ctx);
      this.particles.draw(ctx);
    }

    _drawBoard(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, PALETTE.boardTop);
      g.addColorStop(1, PALETTE.boardBottom);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    _drawGrid(ctx) {
      const c = this.cell;
      ctx.lineWidth = 1;
      ctx.strokeStyle = PALETTE.grid;
      ctx.beginPath();
      for (let i = 1; i < CONFIG.cols; i++) { ctx.moveTo(i * c + 0.5, 0); ctx.lineTo(i * c + 0.5, CONFIG.rows * c); }
      for (let j = 1; j < CONFIG.rows; j++) { ctx.moveTo(0, j * c + 0.5); ctx.lineTo(CONFIG.cols * c, j * c + 0.5); }
      ctx.stroke();
    }

    _drawFoods(ctx) {
      const c = this.cell;
      for (const f of this.foods) {
        const cx = (f.x + 0.5) * c;
        const bob = Math.sin((this.time - f.born) * 0.004 + f.x) * c * 0.05;
        const cy = (f.y + 0.5) * c + bob;
        const r = c * 0.34;
        ctx.save();
        // soft shadow underneath for grounding
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.ellipse(cx, (f.y + 0.5) * c + c * 0.34, r * 0.7, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        f.fruit.draw(ctx, cx, cy, r);
        ctx.restore();
      }
    }

    _renderPoints() {
      const cur = this.snake, prev = this.prevSnake;
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
      const head = pts[0], tail = pts[pts.length - 1];

      const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      grad.addColorStop(0, PALETTE.snakeHead);
      grad.addColorStop(1, PALETTE.snakeTail);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.save();
      ctx.shadowColor = PALETTE.snakeGlow;
      ctx.shadowBlur = c * 0.35;
      ctx.strokeStyle = grad;
      ctx.lineWidth = c * 0.72;
      this._tracePath(ctx, pts);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = PALETTE.sheen;
      ctx.lineWidth = c * 0.22;
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
      const c = this.cell, d = this.dir, r = c * 0.4;
      ctx.fillStyle = PALETTE.snakeHead;
      ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI * 2); ctx.fill();

      const perp = { x: -d.y, y: d.x };
      const fwd = c * 0.11, spread = c * 0.17, er = c * 0.1;
      for (const s of [1, -1]) {
        const ex = head.x + d.x * fwd + perp.x * spread * s;
        const ey = head.y + d.y * fwd + perp.y * spread * s;
        ctx.fillStyle = PALETTE.eyeShine;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PALETTE.eye;
        ctx.beginPath(); ctx.arc(ex + d.x * er * 0.4, ey + d.y * er * 0.4, er * 0.55, 0, Math.PI * 2); ctx.fill();
      }
    }

    // -------------------------------------------------------------- hud / ui
    _syncHud() {
      if (this.levelEl) this.levelEl.textContent = String(this.level);
      if (this.coinsEl) this.coinsEl.textContent = String(this.coins);
    }
    _updateXpBar() {
      const need = this._xpNeed(this.level);
      const pct = clamp(this.xp / need, 0, 1) * 100;
      if (this.xpFillEl) this.xpFillEl.style.width = pct.toFixed(1) + '%';
    }

    _renderOverlay() {
      const o = this.overlay;
      if (this.state === 'playing') {
        o.classList.add('hidden'); o.innerHTML = '';
        if (this.pauseBtn) this.pauseBtn.setAttribute('aria-label', 'Pause');
        return;
      }
      o.classList.remove('hidden');

      if (this.state === 'menu') {
        o.innerHTML = `
          <h2 class="title">Serpent</h2>
          <p class="subtitle">Eat fruit to fill the XP bar. Level up to earn coins. Don't hit the walls or yourself.</p>
          <div class="wallet"><span class="coin-ic"></span>${this.coins}</div>
          <button class="btn" data-action="start">Play</button>
          <div class="keys"><span class="key">↑ ↓ ← →</span><span class="key">WASD</span><span class="key">Swipe</span></div>`;
      } else if (this.state === 'paused') {
        o.innerHTML = `
          <h2 class="title">Paused</h2>
          <button class="btn" data-action="resume">Resume</button>
          <div class="keys"><span class="key">Space</span><span class="key">to resume</span></div>`;
      } else if (this.state === 'dead') {
        o.innerHTML = `
          <h2 class="title">Game Over</h2>
          <div class="final">
            <div class="fcol"><div class="fs-label">Level</div><div class="fs-num">${this.level}</div></div>
            <div class="fcol"><div class="fs-label">Fruit</div><div class="fs-num">${this.eaten}</div></div>
            <div class="fcol coins-col"><div class="fs-label">Coins +</div><div class="fs-num">${this.coinsThisRun}</div></div>
          </div>
          ${this._newBest ? '<div class="badge-new">New Best Level!</div>' : ''}
          <div class="wallet"><span class="coin-ic"></span>${this.coins} total</div>
          <button class="btn" data-action="start">Play Again</button>`;
      }
    }

    // ---------------------------------------------------------------- events
    _bindEvents() {
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

      this.overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const a = btn.getAttribute('data-action');
        if (a === 'start') this.start();
        else if (a === 'resume') this.togglePause();
      });

      this.pauseBtn.addEventListener('click', () => {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        else this.start();
      });
      this.muteBtn.addEventListener('click', () => {
        this.audio.enabled = !this.audio.enabled;
        this.muteBtn.classList.toggle('muted', !this.audio.enabled);
        if (this.audio.enabled) this.audio.resume();
      });

      let sx = 0, sy = 0, tracking = false;
      const SWIPE = 24;
      this.stage.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
      }, { passive: true });
      this.stage.addEventListener('touchmove', (e) => {
        if (!tracking || this.state !== 'playing') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
        if (Math.abs(dx) > Math.abs(dy)) this._onDirIntent(dx > 0 ? 1 : -1, 0);
        else this._onDirIntent(0, dy > 0 ? 1 : -1);
        sx = t.clientX; sy = t.clientY;
        e.preventDefault();
      }, { passive: false });
      this.stage.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const moved = Math.abs(t.clientX - sx) + Math.abs(t.clientY - sy);
        if (moved < SWIPE && (this.state === 'menu' || this.state === 'dead')) this.start();
      }, { passive: true });

      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });
    }

    _onDirIntent(x, y) {
      if (this.state === 'playing') this._queueDir(x, y);
      else if (this.state === 'menu' || this.state === 'dead') { this.start(); this._queueDir(x, y); }
    }
    _onPrimaryAction() {
      if (this.state === 'menu' || this.state === 'dead') this.start();
      else this.togglePause();
    }

    // ---------------------------------------------------------------- layout
    resize() {
      const hud = document.getElementById('hud');
      const hint = document.getElementById('hint');
      const pad = 30;
      const chrome = (hud ? hud.offsetHeight : 0) + (hint ? hint.offsetHeight : 0) + 44;
      const availW = window.innerWidth - pad;
      const availH = window.innerHeight - chrome - pad;
      let size = Math.min(availW, availH);
      size = clamp(size, CONFIG.minStageSize, CONFIG.maxStageSize);

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

  const boot = () => { window.__serpent = new Game(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
