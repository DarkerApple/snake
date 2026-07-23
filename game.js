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
    foodCount: 4,         // fruits on the board at once
    maxStageSize: 560,
    minStageSize: 220,
  };

  const PALETTE = {
    boardTop: '#0c1120',
    boardBottom: '#090d18',
    grid: 'rgba(255, 255, 255, 0.022)',
    snakeBody: '#37cf82',
    snakeHead: '#57e29a',
    snakeGlow: 'rgba(55, 207, 130, 0.28)',
    eye: '#0a0e1a',
    eyeShine: '#ffffff',
    coin: '#ffce4a',
  };

  // Fruit catalogue. `xp` is reward; `weight` is spawn frequency (rarity).
  const FRUITS = [
    { id: 'apple',      xp: 1, weight: 24, color: '#ff5a5f', draw: drawApple },
    { id: 'orange',     xp: 1, weight: 20, color: '#ffa53b', draw: drawOrange },
    { id: 'blueberry',  xp: 1, weight: 16, color: '#6ea8ff', draw: drawBlueberry },
    { id: 'lemon',      xp: 1, weight: 13, color: '#ffe14d', draw: drawLemon },
    { id: 'cherry',     xp: 2, weight: 11, color: '#e84a5f', draw: drawCherry },
    { id: 'banana',     xp: 2, weight: 10, color: '#ffd23b', draw: drawBanana },
    { id: 'pear',       xp: 2, weight: 9,  color: '#b7e26b', draw: drawPear },
    { id: 'peach',      xp: 2, weight: 8,  color: '#ffb3a0', draw: drawPeach },
    { id: 'grapes',     xp: 3, weight: 6,  color: '#a77bff', draw: drawGrapes },
    { id: 'strawberry', xp: 3, weight: 5,  color: '#ff4d6d', draw: drawStrawberry },
    { id: 'kiwi',       xp: 3, weight: 4,  color: '#8bbf3c', draw: drawKiwi },
    { id: 'watermelon', xp: 4, weight: 3,  color: '#ff5d73', draw: drawWatermelon },
  ];
  const FRUIT_WEIGHT = FRUITS.reduce((s, f) => s + f.weight, 0);

  // ------------------------------------------------------------ shop / gear
  // Consumables you can stock up on (auto-used).
  const CONSUMABLES = [
    { id: 'totem', name: 'Totem of Undying', icon: '🧿', price: 50,
      desc: 'Auto-revives you once when you die. Stacks — buy as many as you like.' },
  ];

  // Equipment slots. Owned gear is equipped into a slot; only equipped gear is active.
  const SLOTS = [
    { id: 'charm', name: 'Charm', icon: '🔮' },
    { id: 'armor', name: 'Armor', icon: '🛡️' },
    { id: 'relic', name: 'Relic', icon: '💠' },
    { id: 'skin',  name: 'Skin',  icon: '🎨' },
  ];

  // Gear (bought once, then equipped into its slot). `effects` are applied while equipped.
  const GEAR = [
    { id: 'scholar',  slot: 'charm', name: "Scholar's Charm", icon: '🔮', price: 120,
      desc: '+1 XP from every fruit.', effects: { xpPerFruit: 1 } },
    { id: 'lucky',    slot: 'charm', name: 'Lucky Coin', icon: '🍀', price: 150,
      desc: '+50% coins from level ups.', effects: { coinMult: 1.5 } },
    { id: 'sage',     slot: 'charm', name: 'Sage Sigil', icon: '📜', price: 260,
      desc: '+2 XP from every fruit.', effects: { xpPerFruit: 2 } },
    { id: 'guardian', slot: 'armor', name: 'Guardian Scale', icon: '🛡️', price: 280,
      desc: 'Survive one fatal hit per run.', effects: { freeRevives: 1 } },
    { id: 'aegis',    slot: 'armor', name: 'Aegis Plate', icon: '🪖', price: 520,
      desc: 'Survive two fatal hits per run.', effects: { freeRevives: 2 } },
    { id: 'hunter',   slot: 'relic', name: "Hunter's Eye", icon: '👁️', price: 200,
      desc: '+1 coin for every fruit eaten.', effects: { coinPerFruit: 1 } },
    { id: 'swift',    slot: 'relic', name: 'Swift Sigil', icon: '🌀', price: 180,
      desc: 'Start each run 15% slower — easier to steer.', effects: { speedMult: 1.15 } },
  ];
  const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

  // Snake skins (bought once, then equippable). Emerald is free/owned by default.
  const SKINS = [
    { id: 'emerald',  slot: 'skin', name: 'Emerald',  price: 0,   body: '#37cf82', head: '#57e29a', glow: 'rgba(55, 207, 130, 0.28)' },
    { id: 'ember',    slot: 'skin', name: 'Ember',    price: 90,  body: '#ff7a3c', head: '#ffb057', glow: 'rgba(255, 122, 60, 0.30)' },
    { id: 'frost',    slot: 'skin', name: 'Frost',    price: 90,  body: '#3cc7ff', head: '#8fe4ff', glow: 'rgba(60, 199, 255, 0.30)' },
    { id: 'amethyst', slot: 'skin', name: 'Amethyst', price: 130, body: '#a86bff', head: '#c9a3ff', glow: 'rgba(168, 107, 255, 0.30)' },
    { id: 'gold',     slot: 'skin', name: 'Gold',     price: 220, body: '#f6c945', head: '#ffe08a', glow: 'rgba(246, 201, 69, 0.35)' },
  ];
  const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
  const EQUIP_BY_ID = Object.fromEntries([...GEAR, ...SKINS].map((i) => [i.id, i]));
  const SHOP_BY_ID = Object.fromEntries([...CONSUMABLES, ...GEAR, ...SKINS].map((i) => [i.id, i]));

  // --------------------------------------------------------------- campaign
  // Story chapters. Each: a journey (eat fruitGoal fruit) then a boss fight.
  const CHAPTERS = [
    {
      title: 'The Waking Grove',
      tint: 'rgba(40, 96, 62, 0.18)',
      intro: 'You stir beneath the roots — ancient, and starving. The Grove has grown wild in your long sleep. Feed. Grow strong. Then find the thing that woke you.',
      fruitGoal: 6,
      boss: { name: 'Gloomvine', title: 'the Choking Root', hp: 8, color: '#4caf6a' },
      outro: 'Gloomvine withers to husk. Light pours through the shattered canopy — and on the wind, the sweet reek of rot.',
    },
    {
      title: 'The Sunken Orchard',
      tint: 'rgba(122, 82, 30, 0.18)',
      intro: 'The orchard drowned an age ago. Its fruit is sweetest here, its guardians most sour. Something vast turns over in the mud below.',
      fruitGoal: 8,
      boss: { name: 'Rotharion', title: 'the Spoiled', hp: 12, color: '#c76b32' },
      outro: 'Rotharion bursts in a spray of pulp and flies. Beyond the orchard wall waits the Nest — and the Elder that coils within it.',
    },
    {
      title: 'The Obsidian Nest',
      tint: 'rgba(78, 40, 112, 0.20)',
      intro: "At the black heart of the world coils Vorathrax, the wyrm who devoured your kin. This is why you woke, little serpent. End it.",
      fruitGoal: 10,
      boss: { name: 'Vorathrax', title: 'the Elder Wyrm', hp: 16, color: '#8b4bd6' },
      outro: 'Vorathrax falls still, at last. The Nest is silent. You are the last of the old serpents — and the first of a new age.',
    },
  ];
  const FINAL_TEXT = 'The world is quiet, and it is yours. Coil beneath the roots, and dream of what comes next…';

  // Boss-fight tuning.
  const BOSS_CFG = {
    orbTarget: 2,        // energy orbs kept on the board
    hazardBaseMs: 2200,  // time between hazards at full boss HP
    hazardWarnMs: 750,   // telegraph time before a hazard turns lethal
    hazardActiveMs: 2600,// how long a lethal hazard lingers
    orbCoins: 3,         // coins per orb hit
    clearCoins: 40,      // base coin reward per boss (scales by chapter)
  };

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
  function drawLemon(ctx, x, y, r) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c936';
    ctx.beginPath(); ctx.arc(x - r * 1.02, y, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 1.02, y, r * 0.13, 0, Math.PI * 2); ctx.fill();
    highlight(ctx, x, y - r * 0.05, r * 0.9);
  }
  function drawPear(ctx, x, y, r) {
    ctx.strokeStyle = '#6b4b2a'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x + r * 0.05, y - r * 1.2); ctx.stroke();
    ctx.fillStyle = '#5cc46a';
    ctx.beginPath(); ctx.ellipse(x + r * 0.42, y - r * 1.0, r * 0.3, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b7e26b';
    ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - r * 0.45, r * 0.5, 0, Math.PI * 2); ctx.fill();
    highlight(ctx, x - r * 0.2, y + r * 0.1, r * 0.7);
  }
  function drawPeach(ctx, x, y, r) {
    ctx.fillStyle = '#5cc46a';
    ctx.beginPath(); ctx.ellipse(x + r * 0.3, y - r * 0.9, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
    fillCircle(ctx, x - r * 0.18, y, r * 0.9, '#ffb3a0');
    fillCircle(ctx, x + r * 0.18, y, r * 0.9, '#ff9e8a');
    ctx.strokeStyle = 'rgba(200, 90, 70, 0.4)'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.7); ctx.quadraticCurveTo(x + r * 0.15, y, x, y + r * 0.75); ctx.stroke();
    highlight(ctx, x - r * 0.2, y - r * 0.2, r * 0.85);
  }
  function drawKiwi(ctx, x, y, r) {
    fillCircle(ctx, x, y, r, '#8a6a44');
    fillCircle(ctx, x, y, r * 0.88, '#8bbf3c');
    fillCircle(ctx, x, y, r * 0.3, '#eaf3cf');
    ctx.fillStyle = '#243318';
    for (let i = 0; i < 10; i++) {
      const a = i * (Math.PI * 2 / 10);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    highlight(ctx, x, y, r * 0.9);
  }
  function drawWatermelon(ctx, x, y, r) {
    const TLx = x - r * 0.95, TRx = x + r * 0.95, topY = y - r * 0.5;
    const Bx = x, By = y + r * 1.0, ctrlUp = y - r * 0.85;
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.moveTo(TLx, topY);
    ctx.quadraticCurveTo(Bx, ctrlUp, TRx, topY);
    ctx.lineTo(Bx, By);
    ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3fa34d'; ctx.lineWidth = r * 0.2;
    ctx.beginPath(); ctx.moveTo(TLx, topY); ctx.quadraticCurveTo(Bx, ctrlUp, TRx, topY); ctx.stroke();
    ctx.strokeStyle = '#eaf7d0'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.moveTo(TLx + r * 0.06, topY + r * 0.03); ctx.quadraticCurveTo(Bx, ctrlUp + r * 0.14, TRx - r * 0.06, topY + r * 0.03); ctx.stroke();
    ctx.fillStyle = '#33240f';
    const seeds = [[-0.28, -0.02], [0.24, -0.08], [0, 0.22], [-0.14, 0.48], [0.2, 0.42]];
    for (const [dx, dy] of seeds) { ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, r * 0.06, r * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
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
    buy() { this.resume(); this._tone(700, 0.07, 'square', 0.035, 900, 0); this._tone(1050, 0.1, 'square', 0.035, null, 0.07); }
    hit() { this.resume(); this._tone(220, 0.09, 'square', 0.05, 120); }
    revive() {
      this.resume();
      this._tone(660, 0.1, 'sine', 0.05, 990, 0);
      this._tone(880, 0.12, 'sine', 0.05, 1320, 0.09);
      this._tone(1180, 0.2, 'triangle', 0.05, null, 0.18);
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
      this.totemsEl = document.getElementById('totems');
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

      // persistent wallet, inventory, equipment + progress
      this.coins = this._loadNum('serpent.coins');
      this.bestLevel = this._loadNum('serpent.bestLevel') || 1;
      this.chaptersCleared = this._loadNum('serpent.chapters');
      this.totems = this._loadNum('serpent.totems');
      this.owned = this._loadOwned();               // Set of owned gear/skin ids
      this.equipped = this._loadEquipped();         // { charm, armor, relic, skin }
      this.skin = SKIN_BY_ID[this.equipped.skin] || SKIN_BY_ID.emerald;
      this.shopOpen = false;
      this.equipOpen = false;
      this.invulnUntil = 0;

      // campaign state (initialised per run in reset)
      this.chapterIndex = 0;
      this.phase = 'journey';
      this.orbs = [];
      this.hazards = [];
      this.boss = null;
      this.story = null;

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
    _loadStr(key, def) { try { return localStorage.getItem(key) || def; } catch { return def; } }
    _save(key, val) { try { localStorage.setItem(key, String(val)); } catch { /* ignore */ } }
    _loadOwned() {
      const set = new Set(['emerald']);
      try {
        const raw = JSON.parse(localStorage.getItem('serpent.owned') || '[]');
        if (Array.isArray(raw)) raw.forEach((id) => set.add(id));
      } catch { /* ignore */ }
      return set;
    }
    _saveOwned() { this._save('serpent.owned', JSON.stringify([...this.owned])); }
    _loadEquipped() {
      const eq = { charm: null, armor: null, relic: null, skin: 'emerald' };
      try {
        const raw = JSON.parse(localStorage.getItem('serpent.equipped') || 'null');
        if (raw && typeof raw === 'object') Object.assign(eq, raw);
      } catch { /* ignore */ }
      // migrate the older standalone skin key if present
      if (eq.skin === 'emerald') eq.skin = this._loadStr('serpent.skin', 'emerald');
      // validate against what's actually owned
      const own = this.owned || new Set(['emerald']);
      for (const s of ['charm', 'armor', 'relic']) {
        const g = GEAR_BY_ID[eq[s]];
        if (!g || g.slot !== s || !own.has(eq[s])) eq[s] = null;
      }
      if (!SKIN_BY_ID[eq.skin] || !own.has(eq.skin)) eq.skin = 'emerald';
      return eq;
    }
    _saveEquipped() { this._save('serpent.equipped', JSON.stringify(this.equipped)); }

    // sum/product of an effect across all equipped gear (skin has no effects)
    _equippedGear() { return ['charm', 'armor', 'relic'].map((s) => GEAR_BY_ID[this.equipped[s]]).filter(Boolean); }
    _effectSum(key) { return this._equippedGear().reduce((a, g) => a + (g.effects[key] || 0), 0); }
    _effectMul(key) { return this._equippedGear().reduce((a, g) => a * (g.effects[key] || 1), 1); }

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
      this.speedMult = this._effectMul('speedMult');
      this.tickMs = CONFIG.baseTickMs * this.speedMult;

      // revive resources for this run (from equipped armor/relics)
      this.freeRevives = this._effectSum('freeRevives');
      this.revivesUsed = 0;
      this.invulnUntil = 0;

      // campaign — a fresh run starts at chapter 1
      this.chapterIndex = 0;
      this.phase = 'journey';
      this.chapterFruit = 0;
      this.orbs = [];
      this.hazards = [];
      this.boss = null;
      this.story = null;
      this.nextHazardAt = 0;

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
      this.shopOpen = false;
      this.equipOpen = false;
      if (this.state === 'menu' || this.state === 'dead' || this.state === 'story') {
        this.reset();
        this.audio.start();
        this._beginChapter(0);
      }
    }
    togglePause() {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') { this.state = 'playing'; this.lastFrame = nowMs(); }
      else return;
      this._renderOverlay();
    }
    _die() {
      // Guardian Scale (free, once per run) first, then Totems of Undying.
      if (this.freeRevives > 0) { this.freeRevives -= 1; this._revive(); return; }
      if (this.totems > 0) { this.totems -= 1; this._save('serpent.totems', this.totems); this._revive(); return; }

      this.state = 'dead';
      this.shake = 1;
      const head = this.snake[0];
      const hx = (head.x + 0.5) * this.cell, hy = (head.y + 0.5) * this.cell;
      this.particles.burst(hx, hy, this.skin.head, 16, 210);
      this.particles.burst(hx, hy, '#ff6b6b', 10, 150);
      this.audio.death();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      this._newBest = this.level > this.bestLevel;
      if (this._newBest) { this.bestLevel = this.level; this._save('serpent.bestLevel', this.bestLevel); }
      this._syncHud();
      this._renderOverlay();
    }

    _revive() {
      this.revivesUsed += 1;
      // rebuild the snake as a short, safe horizontal segment at the centre
      const L = Math.min(this.snake.length, CONFIG.cols - 2);
      const y = Math.floor(CONFIG.rows / 2);
      const startX = Math.floor((CONFIG.cols - L) / 2);
      this.snake = [];
      for (let k = 0; k < L; k++) this.snake.push({ x: startX + (L - 1 - k), y });
      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.dir = { x: 1, y: 0 };
      this.pending = [];
      this.grow = 0;
      this.acc = 0;
      this.interp = 0;
      this.invulnUntil = this.time + 1200; // brief grace period

      // clear any fruit now under the rebuilt body, then top up
      const occ = new Set(this.snake.map((s) => s.x + ',' + s.y));
      this.foods = this.foods.filter((f) => !occ.has(f.x + ',' + f.y));
      this._refillFood();

      const hx = (this.snake[0].x + 0.5) * this.cell, hy = (this.snake[0].y + 0.5) * this.cell;
      this.particles.burst(hx, hy, PALETTE.coin, 22, 240);
      this.particles.burst(hx, hy, '#ffffff', 12, 160);
      this.shake = 0.55;
      this.audio.revive();
      if (navigator.vibrate) navigator.vibrate([15, 30, 15, 30, 15]);
      this._syncHud();
    }

    // -------------------------------------------------------- boss mechanics
    _activeHazardAt(x, y) {
      return this.hazards.some((h) => h.x === x && h.y === y && this.time >= h.activeAt && this.time < h.expireAt);
    }
    _occupiedSet() {
      const s = new Set(this.snake.map((c) => c.x + ',' + c.y));
      for (const f of this.foods) s.add(f.x + ',' + f.y);
      for (const o of this.orbs) s.add(o.x + ',' + o.y);
      for (const h of this.hazards) s.add(h.x + ',' + h.y);
      return s;
    }
    _randFreeCell(avoidHead) {
      const occ = this._occupiedSet();
      const head = this.snake[0];
      const free = [];
      for (let y = 0; y < CONFIG.rows; y++)
        for (let x = 0; x < CONFIG.cols; x++) {
          if (occ.has(x + ',' + y)) continue;
          if (avoidHead && head && Math.abs(x - head.x) + Math.abs(y - head.y) <= 2) continue;
          free.push({ x, y });
        }
      return free.length ? free[randInt(free.length)] : null;
    }
    _updateBoss() {
      // top up energy orbs
      let guard = 0;
      while (this.orbs.length < BOSS_CFG.orbTarget && guard++ < 40) {
        const cell = this._randFreeCell();
        if (!cell) break;
        this.orbs.push({ x: cell.x, y: cell.y, born: this.time });
      }
      // retire expired hazards
      this.hazards = this.hazards.filter((h) => this.time < h.expireAt);
      // spawn hazards on a cadence that quickens as the boss weakens
      if (this.time >= this.nextHazardAt) {
        const cell = this._randFreeCell(true);
        if (cell) {
          this.hazards.push({
            x: cell.x, y: cell.y,
            activeAt: this.time + BOSS_CFG.hazardWarnMs,
            expireAt: this.time + BOSS_CFG.hazardWarnMs + BOSS_CFG.hazardActiveMs,
          });
        }
        const frac = this.boss ? this.boss.hp / this.boss.maxHp : 1;
        this.nextHazardAt = this.time + BOSS_CFG.hazardBaseMs * (0.5 + 0.5 * frac);
      }
    }

    // --------------------------------------------------------- campaign flow
    _showStory(title, body, onContinue, flavor, cta) {
      this.state = 'story';
      this.story = { title, body, onContinue, flavor: flavor || '', cta: cta || 'Continue' };
      this._renderOverlay();
    }
    _continueStory() {
      const fn = this.story && this.story.onContinue;
      this.story = null;
      if (fn) fn();
    }
    _beginChapter(i) {
      this.chapterIndex = i;
      const ch = CHAPTERS[i];
      this.phase = 'journey';
      this.chapterFruit = 0;
      this.orbs = [];
      this.hazards = [];
      this.boss = null;
      this.foods = [];
      this._refillFood();
      this._showStory(`Chapter ${i + 1}`, ch.intro, () => this._resumePlay(), ch.title, 'Begin');
    }
    _resumePlay() {
      this.state = 'playing';
      this.acc = 0;
      this.lastFrame = nowMs();
      this._renderOverlay();
    }
    _triggerBoss() {
      const ch = CHAPTERS[this.chapterIndex];
      this._showStory(
        ch.boss.name,
        `${ch.boss.name}, ${ch.boss.title}, rises to bar your path.\nEat the crimson orbs to wound it — and stay clear of the void it spits.`,
        () => this._enterBoss(), 'Boss Fight', 'Fight'
      );
    }
    _enterBoss() {
      const ch = CHAPTERS[this.chapterIndex];
      this.phase = 'boss';
      this.boss = { hp: ch.boss.hp, maxHp: ch.boss.hp, name: ch.boss.name, title: ch.boss.title, color: ch.boss.color, flash: -9999 };
      this.foods = [];
      this.orbs = [];
      this.hazards = [];
      this.nextHazardAt = this.time + 1600;
      this._resumePlay();
    }
    _bossDefeated() {
      const ch = CHAPTERS[this.chapterIndex];
      this.orbs = [];
      this.hazards = [];
      this.phase = 'journey';
      const reward = BOSS_CFG.clearCoins + this.chapterIndex * 30;
      this.coins += reward; this.coinsThisRun += reward; this._save('serpent.coins', this.coins);
      if (this.chapterIndex + 1 > this.chaptersCleared) {
        this.chaptersCleared = this.chapterIndex + 1;
        this._save('serpent.chapters', this.chaptersCleared);
      }
      const head = this.snake[0];
      this.particles.burst((head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell, PALETTE.coin, 26, 250);
      this.particles.burst((head.x + 0.5) * this.cell, (head.y + 0.5) * this.cell, ch.boss.color, 16, 180);
      this.audio.levelUp();
      if (navigator.vibrate) navigator.vibrate([15, 40, 15, 40, 30]);
      this.shake = 0.7;
      this._syncHud();
      const next = this.chapterIndex + 1;
      this._showStory('Victory', `${ch.outro}\n\n+${reward} coins earned.`,
        () => {
          if (next < CHAPTERS.length) this._beginChapter(next);
          else this._showStory('The End', FINAL_TEXT, () => this._toMenu(), 'Campaign Cleared', 'Return');
        },
        'Victory', next < CHAPTERS.length ? 'Onward' : 'Continue'
      );
    }
    _toMenu() {
      this.reset();
      this.state = 'menu';
      this.shopOpen = false;
      this.equipOpen = false;
      this._renderOverlay();
      this._syncHud();
    }
    _roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
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
      const invuln = this.time < this.invulnUntil;

      // walls
      if (nx < 0 || ny < 0 || nx >= CONFIG.cols || ny >= CONFIG.rows) { this._die(); return; }
      // lethal boss hazard
      if (!invuln && this._activeHazardAt(nx, ny)) { this._die(); return; }

      const foodIndex = this.phase === 'journey' ? this.foods.findIndex((f) => f.x === nx && f.y === ny) : -1;
      const orbIndex = this.phase === 'boss' ? this.orbs.findIndex((o) => o.x === nx && o.y === ny) : -1;
      const willEat = foodIndex >= 0 || orbIndex >= 0;

      const body = (willEat || this.grow > 0) ? this.snake : this.snake.slice(0, this.snake.length - 1);
      if (!invuln && body.some((c) => c.x === nx && c.y === ny)) { this._die(); return; }

      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.snake.unshift({ x: nx, y: ny });
      if (this.grow > 0) this.grow--; else this.snake.pop();

      const px = (nx + 0.5) * this.cell, py = (ny + 0.5) * this.cell;

      if (foodIndex >= 0) {
        const eaten = this.foods.splice(foodIndex, 1)[0];
        this.grow += 1;
        this.eaten += 1;
        this.chapterFruit += 1;
        this.coins += this._effectSum('coinPerFruit');
        this.coinsThisRun += this._effectSum('coinPerFruit');
        this.particles.burst(px, py, eaten.fruit.color, 12, 160);
        this.audio.eat();
        if (navigator.vibrate) navigator.vibrate(14);
        this._gainXp(eaten.fruit.xp + this._effectSum('xpPerFruit'));
        this._save('serpent.coins', this.coins);
        if (this.chapterFruit >= CHAPTERS[this.chapterIndex].fruitGoal) this._triggerBoss();
        else this._refillFood();
        this._syncHud();
      } else if (orbIndex >= 0 && this.boss) {
        this.orbs.splice(orbIndex, 1);
        this.grow += 1;
        const gain = BOSS_CFG.orbCoins + this._effectSum('coinPerFruit');
        this.coins += gain; this.coinsThisRun += gain; this._save('serpent.coins', this.coins);
        this.boss.hp -= 1;
        this.boss.flash = this.time;
        this.particles.burst(px, py, '#ff6b6b', 14, 190);
        this.audio.hit();
        if (navigator.vibrate) navigator.vibrate(18);
        this._syncHud();
        if (this.boss.hp <= 0) this._bossDefeated();
      }
    }

    _gainXp(amount) {
      this.xp += amount;
      let need = this._xpNeed(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level += 1;
        let reward = Math.floor((5 + this.level * 2) * this._effectMul('coinMult'));
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
      this.tickMs = Math.max(CONFIG.minTickMs, CONFIG.baseTickMs - (this.level - 1) * CONFIG.speedPerLevel) * this.speedMult;
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

      if (this.state === 'playing' && this.phase === 'boss') this._updateBoss();

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
      if (this.phase === 'boss' && this.boss) this._drawBossBackdrop(ctx, w, h);
      this._drawHazards(ctx);
      if (this.phase === 'boss') this._drawOrbs(ctx);
      else this._drawFoods(ctx);
      this._drawSnake(ctx);
      this.particles.draw(ctx);

      if (this.state === 'playing') {
        if (this.phase === 'boss' && this.boss) this._drawBossBar(ctx, w);
        else this._drawChapterBanner(ctx, w);
      }
    }

    _drawBoard(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, PALETTE.boardTop);
      g.addColorStop(1, PALETTE.boardBottom);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);
      const ch = CHAPTERS[this.chapterIndex];
      if (ch && ch.tint) { ctx.fillStyle = ch.tint; ctx.fillRect(-20, -20, w + 40, h + 40); }
    }

    _drawOrbs(ctx) {
      const c = this.cell;
      for (const o of this.orbs) {
        const cx = (o.x + 0.5) * c;
        const pulse = 0.5 + 0.5 * Math.sin((this.time - o.born) * 0.01);
        const cy = (o.y + 0.5) * c;
        const r = c * 0.3 * (1 + 0.15 * pulse);
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
        halo.addColorStop(0, 'rgba(255, 70, 85, 0.6)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2); ctx.fill();
        const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        body.addColorStop(0, '#ffd6d6'); body.addColorStop(0.5, '#ff5566'); body.addColorStop(1, '#bf2536');
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    _drawHazards(ctx) {
      const c = this.cell;
      for (const h of this.hazards) {
        const x = h.x * c, y = h.y * c;
        if (this.time < h.activeAt) {
          const p = 0.5 + 0.5 * Math.sin(this.time * 0.02);
          ctx.save();
          ctx.strokeStyle = `rgba(170, 70, 230, ${0.4 + 0.4 * p})`;
          ctx.lineWidth = 2;
          this._roundRect(ctx, x + 3, y + 3, c - 6, c - 6, c * 0.2); ctx.stroke();
          ctx.fillStyle = `rgba(150, 60, 210, ${0.06 + 0.08 * p})`;
          this._roundRect(ctx, x + 3, y + 3, c - 6, c - 6, c * 0.2); ctx.fill();
          ctx.restore();
        } else {
          const fade = clamp((h.expireAt - this.time) / 400, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.55 + 0.35 * fade;
          const g = ctx.createRadialGradient(x + c / 2, y + c / 2, 0, x + c / 2, y + c / 2, c * 0.6);
          g.addColorStop(0, '#43105a'); g.addColorStop(0.7, '#7a1fb0'); g.addColorStop(1, 'rgba(120,30,180,0.25)');
          ctx.fillStyle = g;
          this._roundRect(ctx, x + 2, y + 2, c - 4, c - 4, c * 0.22); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + c * 0.32, y + c * 0.32); ctx.lineTo(x + c * 0.68, y + c * 0.68);
          ctx.moveTo(x + c * 0.68, y + c * 0.32); ctx.lineTo(x + c * 0.32, y + c * 0.68);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    _drawBossBackdrop(ctx, w, h) {
      const b = this.boss;
      const cx = w / 2, cy = h * 0.3, R = w * 0.26;
      const hit = this.time - b.flash < 160;
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = hit ? '#ff5a5a' : b.color;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = hit ? 'rgba(255,150,150,0.5)' : 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.52, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hit ? '#ff3030' : '#0c1020';
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.13, R * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    _drawBossBar(ctx, w) {
      const b = this.boss, pad = 12, barH = 9, y = 10;
      const bw = w - pad * 2;
      ctx.save();
      ctx.font = '700 13px Outfit, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(b.name, pad, y + 7);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`${Math.max(0, b.hp)} / ${b.maxHp}`, w - pad, y + 7);
      const ty = y + 19;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this._roundRect(ctx, pad, ty, bw, barH, barH / 2); ctx.fill();
      const frac = clamp(b.hp / b.maxHp, 0, 1);
      if (frac > 0) {
        const g = ctx.createLinearGradient(pad, 0, pad + bw, 0);
        g.addColorStop(0, '#ff7a7a'); g.addColorStop(1, '#ff2d55');
        ctx.fillStyle = g;
        this._roundRect(ctx, pad, ty, Math.max(barH, bw * frac), barH, barH / 2); ctx.fill();
      }
      ctx.restore();
    }

    _drawChapterBanner(ctx, w) {
      const ch = CHAPTERS[this.chapterIndex]; if (!ch) return;
      const label = `Ch.${this.chapterIndex + 1} · ${ch.title}`;
      const prog = `${Math.min(this.chapterFruit, ch.fruitGoal)}/${ch.fruitGoal}`;
      ctx.save();
      ctx.font = '600 12px Outfit, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      const pw = ctx.measureText(prog).width;
      const pillW = tw + pw + 42, pillH = 24, cx = w / 2, y = 16;
      ctx.fillStyle = 'rgba(8,12,22,0.6)';
      this._roundRect(ctx, cx - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(label, cx - pillW / 2 + 13, y);
      ctx.fillStyle = PALETTE.coin;
      ctx.textAlign = 'right';
      ctx.fillText(prog, cx + pillW / 2 - 13, y);
      ctx.restore();
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
      const head = pts[0];
      const invuln = this.time < this.invulnUntil;

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // flat, clean body — a single solid tube with a soft glow
      ctx.save();
      ctx.shadowColor = invuln ? 'rgba(255, 206, 74, 0.7)' : this.skin.glow;
      ctx.shadowBlur = invuln ? c * 0.7 : c * 0.25;
      ctx.strokeStyle = invuln ? '#ffe08a' : this.skin.body;
      ctx.lineWidth = c * 0.72;
      this._tracePath(ctx, pts);
      ctx.stroke();
      ctx.restore();

      this._drawHead(ctx, head, invuln);
    }

    _tracePath(ctx, pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) { ctx.lineTo(pts[0].x + 0.01, pts[0].y); return; }
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }

    _drawHead(ctx, head, invuln) {
      const c = this.cell, d = this.dir, r = c * 0.4;
      ctx.fillStyle = invuln ? '#ffe08a' : this.skin.head;
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
      if (this.totemsEl) {
        const n = this.totems + this.freeRevives;
        this.totemsEl.textContent = n > 0 ? '🧿 ' + n : '';
        this.totemsEl.style.display = n > 0 ? '' : 'none';
      }
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

      if (this.shopOpen) { this._renderShop(o); return; }
      if (this.equipOpen) { this._renderEquip(o); return; }
      if (this.state === 'story') { this._renderStory(o); return; }

      if (this.state === 'menu') {
        const cleared = this.chaptersCleared > 0
          ? `<p class="subtitle">Chapters cleared: <b>${Math.min(this.chaptersCleared, CHAPTERS.length)}/${CHAPTERS.length}</b></p>` : '';
        o.innerHTML = `
          <h2 class="title">Serpent</h2>
          <p class="subtitle">A serpent's quest across ${CHAPTERS.length} chapters. Eat, grow, gear up — and slay what waits at the end of each.</p>
          <div class="wallet"><span class="coin-ic"></span>${this.coins}</div>
          <div class="btn-row">
            <button class="btn" data-action="start">Play</button>
            <button class="btn ghost" data-action="equip">Equip</button>
            <button class="btn ghost" data-action="shop">Shop</button>
          </div>
          ${cleared}
          <div class="keys"><span class="key">↑ ↓ ← →</span><span class="key">WASD</span><span class="key">Swipe</span></div>`;
      } else if (this.state === 'paused') {
        o.innerHTML = `
          <h2 class="title">Paused</h2>
          <div class="btn-row">
            <button class="btn" data-action="resume">Resume</button>
            <button class="btn ghost" data-action="equip">Equip</button>
          </div>
          <div class="keys"><span class="key">Space</span><span class="key">to resume</span></div>`;
      } else if (this.state === 'dead') {
        o.innerHTML = `
          <h2 class="title">You Fell</h2>
          <div class="final">
            <div class="fcol"><div class="fs-label">Chapter</div><div class="fs-num">${this.chapterIndex + 1}</div></div>
            <div class="fcol"><div class="fs-label">Level</div><div class="fs-num">${this.level}</div></div>
            <div class="fcol coins-col"><div class="fs-label">Coins +</div><div class="fs-num">${this.coinsThisRun}</div></div>
          </div>
          ${this.revivesUsed > 0 ? `<div class="revived">Revived ×${this.revivesUsed} 🧿</div>` : ''}
          <div class="wallet"><span class="coin-ic"></span>${this.coins} total</div>
          <div class="btn-row">
            <button class="btn" data-action="start">Retry</button>
            <button class="btn ghost" data-action="equip">Equip</button>
            <button class="btn ghost" data-action="shop">Shop</button>
          </div>`;
      }
    }

    _renderStory(o) {
      const s = this.story; if (!s) return;
      const body = s.body.split('\n').map((p) => (p.trim() ? `<p>${p.trim()}</p>` : '')).join('');
      o.innerHTML = `
        <div class="story">
          ${s.flavor ? `<div class="story-eyebrow">${s.flavor}</div>` : ''}
          <h2 class="story-title">${s.title}</h2>
          <div class="story-body">${body}</div>
          <button class="btn" data-action="story">${s.cta}</button>
        </div>`;
    }

    _renderEquip(o) {
      const slotBlock = (slot) => {
        const equippedId = this.equipped[slot.id];
        const eqItem = EQUIP_BY_ID[equippedId];
        const opts = (slot.id === 'skin' ? SKINS : GEAR.filter((g) => g.slot === slot.id))
          .filter((it) => this.owned.has(it.id));
        const chips = [];
        if (slot.id !== 'skin') {
          chips.push(`<button class="chip${!equippedId ? ' on' : ''}" data-action="eq:${slot.id}:none">None</button>`);
        }
        for (const it of opts) {
          const on = equippedId === it.id;
          const swatch = slot.id === 'skin'
            ? `<span class="chip-dot" style="background:${it.head}"></span>`
            : `<span class="chip-emoji">${it.icon}</span>`;
          chips.push(`<button class="chip${on ? ' on' : ''}" data-action="eq:${slot.id}:${it.id}">${swatch}${it.name}</button>`);
        }
        if (opts.length === 0 && slot.id !== 'skin') chips.push('<span class="chip muted">None owned — visit the Shop</span>');
        return `
          <div class="eq-slot">
            <div class="eq-slot-head">
              <span class="eq-slot-name">${slot.icon} ${slot.name}</span>
              <span class="eq-equipped">${eqItem ? eqItem.name : '—'}</span>
            </div>
            <div class="eq-chips">${chips.join('')}</div>
            ${eqItem && eqItem.desc ? `<div class="eq-desc">${eqItem.desc}</div>` : ''}
          </div>`;
      };
      o.innerHTML = `
        <div class="shop">
          <div class="shop-head">
            <button class="back" data-action="closeEquip" aria-label="Back">‹</button>
            <h2 class="shop-title">Equipment</h2>
            <div class="wallet"><span class="coin-ic"></span>${this.coins}</div>
          </div>
          <div class="shop-list">${SLOTS.map(slotBlock).join('')}</div>
        </div>`;
    }

    _equipSlot(slot, id) {
      if (id === 'none') { this.equipped[slot] = null; }
      else {
        if (!this.owned.has(id)) return;
        const it = EQUIP_BY_ID[id];
        if (!it || it.slot !== slot) return;
        this.equipped[slot] = id;
        if (slot === 'skin') this.skin = SKIN_BY_ID[id];
      }
      this._saveEquipped();
      this.audio.buy();
      if (navigator.vibrate) navigator.vibrate(8);
      this._syncHud();
      this._renderOverlay();
    }

    // ------------------------------------------------------------------ shop
    _renderShop(o) {
      const section = (title, items, kind) => `
        <div class="shop-section">
          <div class="shop-section-title">${title}</div>
          ${items.map((it) => this._shopRow(it, kind)).join('')}
        </div>`;
      o.innerHTML = `
        <div class="shop">
          <div class="shop-head">
            <button class="back" data-action="closeShop" aria-label="Back">‹</button>
            <h2 class="shop-title">Shop</h2>
            <div class="wallet"><span class="coin-ic"></span>${this.coins}</div>
          </div>
          <div class="shop-list">
            ${section('Buffs', CONSUMABLES, 'consumable')}
            ${section('Gear', GEAR, 'gear')}
            ${section('Skins', SKINS, 'skin')}
          </div>
        </div>`;
    }

    _shopRow(it, kind) {
      const affordable = this.coins >= it.price;
      const priceBtn = (action) =>
        `<button class="si-btn${affordable ? '' : ' disabled'}" data-action="${action}"><span class="coin-ic"></span>${it.price}</button>`;
      let right = '';
      if (kind === 'consumable') {
        right = `${this.totems > 0 ? `<span class="si-have">×${this.totems}</span>` : ''}${priceBtn('buy:' + it.id)}`;
      } else if (kind === 'gear') {
        right = this.owned.has(it.id) ? `<span class="si-tag owned">Owned</span>` : priceBtn('buy:' + it.id);
      } else { // skin
        if (this.equipped.skin === it.id) right = `<span class="si-tag equipped">Equipped</span>`;
        else if (this.owned.has(it.id)) right = `<button class="si-btn equip" data-action="eq:skin:${it.id}">Equip</button>`;
        else right = priceBtn('buy:' + it.id);
      }
      const icon = kind === 'skin'
        ? `<span class="si-skin" style="background:${it.head};box-shadow:inset 0 0 0 3px ${it.body}"></span>`
        : `<span class="si-emoji">${it.icon}</span>`;
      const desc = kind === 'skin' ? (it.price === 0 ? 'Starter skin' : 'Snake skin') : it.desc;
      return `
        <div class="shop-item">
          <div class="si-icon">${icon}</div>
          <div class="si-info"><div class="si-name">${it.name}</div><div class="si-desc">${desc}</div></div>
          <div class="si-buy">${right}</div>
        </div>`;
    }

    _buy(id) {
      const it = SHOP_BY_ID[id];
      if (!it) return;
      const isConsumable = CONSUMABLES.some((c) => c.id === id);
      if (!isConsumable && this.owned.has(id)) return;
      if (this.coins < it.price) return; // can't afford
      this.coins -= it.price;
      this._save('serpent.coins', this.coins);
      if (isConsumable) {
        this.totems += 1;
        this._save('serpent.totems', this.totems);
      } else {
        this.owned.add(id);
        this._saveOwned();
        // auto-equip: skins always; gear only when its slot is empty
        if (it.slot === 'skin') { this.equipped.skin = id; this.skin = SKIN_BY_ID[id]; this._saveEquipped(); }
        else if (!this.equipped[it.slot]) { this.equipped[it.slot] = id; this._saveEquipped(); }
      }
      this.audio.buy();
      if (navigator.vibrate) navigator.vibrate(12);
      this._syncHud();
      this._renderOverlay();
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
        else if (k === 'p' || k === 'escape') {
          if (this.shopOpen) { this.shopOpen = false; this._renderOverlay(); }
          else if (this.equipOpen) { this.equipOpen = false; this._renderOverlay(); }
          else if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        }
      }, { passive: false });

      this.overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const a = btn.getAttribute('data-action');
        if (a === 'start') this.start();
        else if (a === 'resume') this.togglePause();
        else if (a === 'story') this._continueStory();
        else if (a === 'shop') { this.shopOpen = true; this._renderOverlay(); }
        else if (a === 'closeShop') { this.shopOpen = false; this._renderOverlay(); }
        else if (a === 'equip') { this.equipOpen = true; this._renderOverlay(); }
        else if (a === 'closeEquip') { this.equipOpen = false; this._renderOverlay(); }
        else if (a.startsWith('buy:')) this._buy(a.slice(4));
        else if (a.startsWith('eq:')) { const parts = a.split(':'); this._equipSlot(parts[1], parts[2]); }
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
        if (moved >= SWIPE) return;
        if (e.target.closest('[data-action]')) return; // let the click handler run it
        if (this.state === 'story') this._continueStory();
        else if (!this.shopOpen && !this.equipOpen && (this.state === 'menu' || this.state === 'dead')) this.start();
      }, { passive: true });

      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.togglePause();
      });
    }

    _onDirIntent(x, y) {
      if (this.shopOpen || this.equipOpen || this.state === 'story') return;
      if (this.state === 'playing') this._queueDir(x, y);
      else if (this.state === 'menu' || this.state === 'dead') { this.start(); }
    }
    _onPrimaryAction() {
      if (this.shopOpen) { this.shopOpen = false; this._renderOverlay(); return; }
      if (this.equipOpen) { this.equipOpen = false; this._renderOverlay(); return; }
      if (this.state === 'story') { this._continueStory(); return; }
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
