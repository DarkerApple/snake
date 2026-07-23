# 🐍 Serpent

A polished, mobile-friendly **Snake** game built with vanilla JavaScript and
HTML5 Canvas — no build step, no dependencies. This is the **base** for a
planned RPG snake game, structured so gameplay systems can be layered on top.

![Serpent](https://img.shields.io/badge/vanilla-JS-yellow) ![No build](https://img.shields.io/badge/build-none-brightgreen)

## Play

Open `index.html` in any modern browser — desktop or mobile.

```bash
# or serve it locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

- **Story campaign & bosses** — a serpent's quest across three illustrated
  chapters. Eat your way to each chapter's goal, then face a boss: eat crimson
  energy orbs to drain its HP while dodging the lethal void it spawns.
- **Equipment slots** — a dedicated **Equipment** screen with Charm / Armor /
  Relic / Skin slots. Own gear from the shop, then equip what fits your run;
  only equipped gear is active.
- **Fruit & loot** — twelve hand-drawn fruit models (apple, orange, blueberry,
  lemon, cherry, banana, pear, peach, grapes, strawberry, kiwi, watermelon),
  four on the board at once, spawned by rarity. Rarer fruit grants more XP.
- **XP → levels → coins** — eating fruit fills the XP bar; leveling up awards
  coins to a **persistent wallet** and speeds the snake up a notch.
- **Shop & buffs** — spend coins on a **Totem of Undying** (auto-revive) and
  equippable gear and skins. Everything you own persists between sessions.
- **Clean, minimal look** — flat dark board (tinted per biome), a solid
  single-color serpent with an expressive head, faint grid, particle bursts,
  and a light screen shake on death.
- **Smooth motion** — logic runs on a fixed grid tick while rendering
  interpolates between cells, so the snake glides instead of stepping.
- **Mobile-first** — responsive square board, swipe-to-steer, tap-to-start,
  haptic feedback, safe-area insets, and no page scroll/zoom fighting.
- **Desktop controls** — Arrow keys / WASD to move, `Space`/`Enter` to
  start & pause, `P`/`Esc` to pause.
- **Juice** — procedural WebAudio sound effects (mutable, no asset files) and
  a persisted best level.
- **Game states** — menu, playing, paused, game over, with auto-pause when
  the tab loses focus.

## Progression

| Fruit | XP | Rarity |
| ----- | -- | ------ |
| Apple, Orange, Blueberry, Lemon | 1 | common |
| Cherry, Banana, Pear, Peach | 2 | uncommon |
| Grapes, Strawberry, Kiwi | 3 | rare |
| Watermelon | 4 | jackpot |

Filling the XP bar levels you up; each level up pays out `5 + level × 2` coins
(×1.5 with the Lucky Coin) into a wallet that persists across runs
(`localStorage`).

## Campaign

**Play** starts the story campaign. Each chapter has a short intro, a journey
(eat the chapter's fruit goal), then a boss fight:

| Chapter | Boss | HP |
| ------- | ---- | -- |
| 1 · The Waking Grove | Gloomvine, the Choking Root | 8 |
| 2 · The Sunken Orchard | Rotharion, the Spoiled | 12 |
| 3 · The Obsidian Nest | Vorathrax, the Elder Wyrm | 16 |

During a boss fight, eat the **crimson orbs** to deal damage and dodge the
**void hazards** (they flash a warning, then turn lethal). Clearing a boss pays
coins and reveals the next chapter. A run restarts at Chapter 1 on death, but
coins, gear and progress persist — gear up and try again.

## Shop & Equipment

Open the **Shop** (menu / game over) to spend coins, and **Equipment** to slot
what you own. Only equipped gear is active.

| Slot | Items |
| ---- | ----- |
| Buff (stacks) | 🧿 Totem of Undying — auto-revive on death |
| Charm | 🔮 Scholar's Charm (+1 XP), 🍀 Lucky Coin (+50% coins), 📜 Sage Sigil (+2 XP) |
| Armor | 🛡️ Guardian Scale (1 free revive/run), 🪖 Aegis Plate (2 free revives/run) |
| Relic | 👁️ Hunter's Eye (+1 coin/fruit), 🌀 Swift Sigil (start 15% slower) |
| Skin | Emerald (free), Ember, Frost, Amethyst, Gold |

On death the game auto-spends a free Armor revive first, then a Totem if you
have one: the snake is rebuilt at the center with a brief invulnerability
window instead of ending the run.

## Controls

| Action | Desktop | Mobile |
| ------ | ------- | ------ |
| Move   | Arrow keys / WASD | Swipe |
| Start / Restart | Space / Enter / any arrow | Tap |
| Pause  | Space / P / Esc | Pause button |
| Mute   | Sound button | Sound button |

## Project structure

```
index.html   — markup, HUD, overlay shell, fonts & meta
styles.css   — theme, layout, responsive + safe-area handling
game.js      — engine: config, audio, particles, and the Game state machine
```

### Built to extend

`game.js` keeps tunables in `CONFIG` / `PALETTE` / `FRUITS` / `GEAR` /
`CHAPTERS` / `BOSS_CFG` and separates concerns (`AudioFX`, `ParticleField`,
`Game`). Adding content is data-driven: a new fruit is an entry in `FRUITS`
with a draw function, a new chapter/boss is an entry in `CHAPTERS`, and new
gear is an entry in `GEAR` with a `slot` and `effects`. Natural next steps:
more boss attack patterns, power-ups that drop mid-run, and a coin-sink
progression map.

## License

MIT
