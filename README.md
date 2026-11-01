# Super Orbital Simulator

Build and run a space fort for the war effort. A browser game for the **Super Earth Special Forces** community, in the same look as [Orbital Fury](https://orbitalfury.com/).

> **Prototype 0.1.** A test of the theme, the style and the smallest loop. There is no game over and nothing is saved yet.

It's Cities: Skylines inside a Helldivers space fort, with an Age of Empires 2 upgrade path. You are handed a hull, you build it out, and you run it at a profit while the war flows past the airlocks.

## Play

Open `index.html` through a local web server (`npm start`, then <http://localhost:8080>), or play the hosted copy once GitHub Pages is on. Opening the file straight from disk won't work because browsers block ES modules on `file://`.

1. Pick a module at the bottom (or press `1`-`9`), then click inside the yellow **permitted section**. Drag to lay corridors and lifts.
2. **Docking bays** must touch open space: the top deck, the bottom deck, or the hull's ends.
3. Everything must connect to **Station Command**. People walk along decks and only change deck in a **lift**.
4. Freighters dock and **haulers** (blue) carry their six crates to a **cargo hold**: every crate pays 15 CR. **Shuttles** bring colonists for your **quarters**, who pay the Liberty Contribution.
5. **Budget** (`B`): set the tax and fund the three divisions. You set the money; the simulation decides the people.
   - **Ministry of Supply** (blue): haulers.
   - **Department of Patriotic Maintenance** (gold): engineers, who walk out and fix faults on their own.
   - **Democracy Officers** (red): catch smugglers at bays near a Security Post.
6. Reach the **Garrison Permit** (12 residents, 30 crates traded, an Engineering Bay running) to open the whole hull and unlock the Canteen and Security Post.

`X` demolishes (a quarter of the cost back), `Space` pauses, `Esc` puts the tool down, and the speed button runs the station at 1×, 2× or 4×.

**What layout changes.** Haulers walk, so a bay far from cargo means slower unloading, ships left waiting and trade lost. Run `npm run sim` and `npm run sim:far` to see the same station with the bay next to the cargo and at the far end: about 135 crates against 97 in twelve minutes, and the permit at 2.7 minutes against 8.1.

## How it's built

Plain JavaScript modules and Canvas 2D, no framework and no build step. The look (palette, type, panels, buttons, scanlines) is carried over from Orbital Fury.

```
index.html          the page, the title card and the budget panel
css/style.css       the Orbital Fury theme plus the station HUD
js/config.js        every tuning number
js/sim.js           the simulation: hull, modules, walking, ships, divisions, economy, morale, milestone (no DOM)
js/render.js        the blueprint cross-section, drawn in code
js/audio.js         synthesised sound
js/main.js          the loop, input and HUD
test/headless.mjs   runs the station without a browser and prints the economy
test/ui.mjs         plays it through the real page on a desktop and a phone held sideways
tools/bundle.mjs    builds dist/super-orbital-simulator.html, the whole game in one file
```

Tests: `npm run sim` needs only Node. `npm install` then `npm start` in one terminal and `npm run ui` in another runs the browser test. `?seed=N` fixes the random seed and `?skip` skips the title.

## Credits and disclaimer

- **Created and vibe coded by** Robert Troumbley (RamziesSGXR), head admin of the Super Earth Special Forces (SESF) community.
- **Art is drawn in code** and **sound is synthesised** in the browser. There are no image or sound files, fonts or code libraries made by anyone else in the game.
- **Inspired by** Helldivers 2 (Arrowhead Game Studios, published by Sony Interactive Entertainment).
- **Unofficial fan project.** Not affiliated with, endorsed by or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers, Super Earth, Super Destroyer, SEAF and the other names, phrases, factions and settings from the Helldivers games belong to their owners and are used only to refer to them. Free, no ads, collects nothing, provided as is with no warranty.
- **Build and test tools** (not part of the game): esbuild (MIT) and Playwright (Apache 2.0).
