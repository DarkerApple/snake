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

- **Smooth motion** — logic runs on a fixed grid tick, but rendering
  interpolates between cells so the snake glides instead of stepping.
- **Aesthetic** — neon gradient serpent with a glowing body, an expressive
  head, a pulsing golden food orb, ambient background depth, particle bursts,
  and screen shake on death.
- **Mobile-first** — responsive square board, swipe-to-steer, tap-to-start,
  haptic feedback, safe-area insets, and no page scroll/zoom fighting.
- **Desktop controls** — Arrow keys / WASD to move, `Space`/`Enter` to
  start & pause, `P`/`Esc` to pause.
- **Juice** — procedural WebAudio sound effects (mutable, no asset files),
  progressive speed-up, and a persisted high score (`localStorage`).
- **Game states** — menu, playing, paused, game over, with auto-pause when
  the tab loses focus.

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

`game.js` keeps tunables in `CONFIG` / `PALETTE` and separates concerns
(`AudioFX`, `ParticleField`, `Game`). Natural next steps for the RPG layer:
XP/leveling, collectible loot with rarities, obstacles/enemies, power-ups,
biomes/themes, and a progression map — all of which can hook into the existing
tick, render, and food-spawn pipeline.

## License

MIT
