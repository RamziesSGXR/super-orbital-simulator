# Super Orbital Simulator

Build and run a space station for the war effort. A browser game for the **Super Earth Special Forces** community, in the same look as [Orbital Fury](https://orbitalfury.com/).

> **Prototype 0.2.** A test of the theme, the style and the smallest loop: building a station from parts in 3D, and watching it run. There is no game over and nothing is saved yet.

It's Cities: Skylines for a Helldivers space station, with an Age of Empires 2 upgrade path. You start with Station Command in an empty 3D blueprint space, snap parts onto it, and run it at a profit while the war flows past the airlocks. Rings, cores, pylons, discs, drums, trusses, nodes, modules and solar wings are all in the kit, so you can build the station you have in your head.

## Play

Run a local web server in this folder (`npm start`, then open <http://localhost:8080>), or play the hosted copy once GitHub Pages is on. Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

- **RUN A STATION** starts you with Station Command and 2,000 CR. **SANDBOX** gives you every part, no costs and a big build zone.
- **Build:** pick a part from the grid at the bottom left (or its hotkey), and the free ports glow yellow. Hover one to see the part in place, then click to build it. `R` turns it 45°. Right-click or `Esc` puts the part down.
- **Look around:** drag to orbit, right-drag to pan, scroll or pinch to zoom. Click the minimap to look somewhere.
- **Select:** click a part to see what it does and what's in it. `F` focuses on it and `X` demolishes it (half the cost back). Only parts with nothing attached can come down.
- **Views** (bottom right, or `1`-`4`):
  - **Blueprint** is a green technical drawing in 3D, with the X, Y and Z planes.
  - **Hull** shows the station as it would look, over the planet.
  - **Life Signs** is an x-ray: the hull fades and every person aboard glows through the walls.
  - **Cutaway** slices away the quarter of the station facing you, to show the decks inside. It works with every view.
- **The loop:** Docking Ports bring ships. Freighters unload crates, and blue haulers walk each one through the station to a Cargo Module, where it pays 15 CR. Shuttles bring colonists for Habs and Rings, and the colonists pay tax (set it in **MENU**). Reactors and Solar Arrays keep the power up. Reach the **Garrison Permit** (12 residents, 30 crates traded, 20 power) to grow the build zone and unlock rings, promenades, drums and pylons.

**Layout matters.** Haulers walk through the station, so a docking port far from the cargo means slow unloading and ships giving up. `npm run sim` and `npm run sim:far` run the same station with the port beside the cargo and at the far end of a truss: 197 crates against 95 in twelve minutes, 0 ships lost against 23, and the permit at 2.3 minutes against not at all.

## The part kit

| Part | Goes | Does |
| --- | --- | --- |
| Core Segment | in the spine | A section of spine with four side ports |
| Reactor Core | in the spine | +16 power |
| Comms Spire | caps a spine | Ships come 20% more often |
| Habitat Ring | in the spine | A torus on four spokes, beds for 24 |
| Docking Ring | in the spine | A wide outer ring on six spokes, beds for 12 and 2 more haulers |
| Promenade Disc | in the spine | +8 morale |
| Habitat Drum | in the spine | Beds for 16 |
| Arboretum Dome | caps anything | +5 morale |
| Docking Port | on a side | A berth for freighters (6 crates) and shuttles |
| Docking Pylon | on a side | A tall arm with a berth for heavy freighters (8 crates) |
| Truss | on a side | Cheap reach, with four ports |
| Node | on a side | Five more ports, for branching arms |
| Cargo Module | on a side | Where crates go, plus 2 more haulers |
| Hab Module | on a side | Beds for 6 |
| Solar Array | on a side | +6 power |

Any part can go on any free port. Parts may overlap and nest on purpose, so a ring can sit inside a ring.

## How it's built

Plain JavaScript modules, no framework and no build step. The 3D is three.js, vendored as one minified file in `js/vendor/`. Every part and ship is built in code from simple shapes (cylinders, rings, lathed profiles, boxes): there are no model, image or sound files. The look (palette, type, panels, buttons, scanlines) is carried over from Orbital Fury.

```
index.html          the page, the title card and the menu
css/style.css       the Orbital Fury theme plus the Age of Empires-style HUD
js/config.js        every tuning number and the part kit (ports, costs, power, jobs)
js/math3.js         small vector and quaternion helpers for the simulation
js/sim.js           the simulation: parts joined at ports, walking, ships, economy, morale, milestone (no DOM, no 3D)
js/parts.js         every part and ship, drawn in code, plus the grid icons
js/view.js          the 3D view: blueprint space, the four views, cutaway, life signs, picking
js/audio.js         synthesised sound
js/main.js          the loop, input, HUD and minimap
js/vendor/three.js  three.js (MIT), see js/vendor/THREE-LICENSE
test/headless.mjs   runs a station without a browser and prints the economy
test/ui.mjs         plays it through the real page on a desktop and a phone held sideways
tools/vendor.mjs    rebuilds js/vendor/three.js
tools/bundle.mjs    builds dist/super-orbital-simulator.html, the whole game in one file
```

Tests: `npm run sim` needs only Node. For the browser test, `npm install`, `npm start` in one terminal and `npm run ui` in another. `?seed=N` fixes the random seed, and `?run` or `?sandbox` skips the title.

Prototype 0.1, the flat cross-section version, is the first commit in the history.

## Credits and disclaimer

- **Created and vibe coded by** Robert Troumbley (RamziesSGXR), head admin of the Super Earth Special Forces (SESF) community.
- **Art is drawn in code** and **sound is synthesised** in the browser. There are no image, model or sound files in the game.
- **three.js** (MIT License, three.js authors) draws the 3D. See `js/vendor/THREE-LICENSE`.
- **Inspired by** Helldivers 2 (Arrowhead Game Studios, published by Sony Interactive Entertainment).
- **Unofficial fan project.** Not affiliated with, endorsed by or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers, Super Earth, Super Destroyer, SEAF and the other names, phrases, factions and settings from the Helldivers games belong to their owners and are used only to refer to them. Free, no ads, collects nothing, provided as is with no warranty.
- **Build and test tools** (not part of the game): esbuild (MIT) and Playwright (Apache 2.0).
