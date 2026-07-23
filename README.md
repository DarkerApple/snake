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

- **Fruit & loot** — seven hand-drawn fruit models (apple, orange, blueberry,
  cherry, banana, grapes, strawberry), several on the board at once, spawned
  by rarity. Rarer fruit grants more XP.
- **XP → levels → coins** — eating fruit fills the XP bar; leveling up awards
  coins to a **persistent wallet** and speeds the snake up a notch.
- **Clean, minimal look** — flat dark board, soft gradient serpent with an
  expressive head, subtle grid, particle bursts, and a light screen shake on
  death.
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
| Apple, Orange, Blueberry | 1 | common |
| Cherry, Banana | 2 | uncommon |
| Grapes, Strawberry | 3 | rare |

Filling the XP bar levels you up; each level up pays out `5 + level × 2` coins
into a wallet that persists across runs (`localStorage`) — ready to feed a
future RPG shop.

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

### Built to extend (toward the RPG)

`game.js` keeps tunables in `CONFIG` / `PALETTE` / `FRUITS` and separates
concerns (`AudioFX`, `ParticleField`, `Game`). The XP/level/coin loop and the
rarity-weighted fruit catalogue are already in place. Natural next steps for
the RPG layer: a coin shop, obstacles/enemies, power-ups, biomes/themes, and a
progression map — all of which can hook into the existing tick, render, and
food-spawn pipeline.

## License

MIT
