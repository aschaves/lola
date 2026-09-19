# Lola

A small platformer about Lola, the family dog, first written in Java in 2011 and rebuilt for the browser in 2026.

Lola runs through three places from the family's life, collecting treats and dodging bath time, until she finds the person waiting for her at the end of each level:

1. **Home Sweet Home** – the kitchen
2. **A Day at the Praça** – the playground
3. **Titia's House** – Titia Rafaela's pink house

## Play

Open `game/index.html` in any modern browser. No install, no build step.

If your browser refuses to load images from a local file, serve the folder instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/game/
```

### Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrow keys or A / D | Left stick or d-pad | ◀ ▶ buttons |
| Jump (hold for higher) | Space, Up or W | A / B | ▲ button |
| Pause | Esc or P | Start | II button |

Jump on top of the pets and family members to get past them. Bonbons and heart chocolates also switch the drum track of the music on and off, just like in the original game.

The game starts in Portuguese; English can be chosen in Options. Language, sound settings and unlocked levels are remembered in the browser.

## Project layout

```
game/                 The 2026 browser version
  index.html          Page and menus
  css/style.css       Menu styling
  js/data/            Level layouts (verbatim from 2011), legends, music notes, sound data, UI text
  js/engine/          Image loading, animation, input, sound (Web Audio)
  js/game/            Entities, level simulation, rendering
  js/main.js          Game flow: loading, title, play, pause, level complete, game over, end
  assets/img/         The family photos and artwork, copied from the original and renamed
reference/            The original 2011 Java project, kept untouched
```

## What changed from the 2011 version

- Java / AWT full-screen app replaced by an HTML5 canvas game with no dependencies.
- The three original maps are used as they were; the unused cat sprite now patrols two platforms in the praça.
- The person waiting at the end of level 1 is the family member with hearts, and the priest waits in the praça, following where their pictures lived in the original asset folders (the 2011 map files had them the other way round).
- Modern feel: acceleration, variable jump height, coyote time, jump buffering, squash-and-stretch, particles, a smooth camera and a HUD.
- Three lives per level, a level-complete card that finally shows the "family member holding Lola" photos that were in the original assets but never displayed, a score with time and all-treats bonuses, level select with progress saved.
- The original MIDI theme and the two WAV effects were converted and are played through Web Audio; the drum-track toggle from the original is kept.
- Keyboard, gamepad and touch controls; English and Portuguese text.

## Developer notes

Everything is plain HTML, CSS and JavaScript; edit and reload. Level layouts are text in `game/js/data/maps.js` and the meaning of each character is in `game/js/data/levels.js`, so new levels only need a new entry there plus the images.

Two URL flags help when testing: `?nopause` disables the automatic pause when the tab loses focus, and `?debug` exposes `window.LolaDebug` (game state, `loadLevel(i)`, `teleport(col)`).
