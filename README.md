# Super Orbital Simulator

Build and run a space station for the war effort. A browser game for the **Super Earth Special Forces** community, in the same look as [Orbital Fury](https://orbitalfury.com/).

> **Prototype 0.4.** Your divisions are now factions with names, moods and wishes. They ask you for rooms, work faster when the station suits them, and the score is the station's capability. Hull is the default view, and `H` hides everything. There is no game over and nothing is saved yet.

It's Cities: Skylines for a Helldivers space station, with an Age of Empires 2 upgrade path. You start with Station Command in an empty 3D blueprint space, snap parts onto it, build out their insides room by room, and keep its people working while the war flows past the airlocks. Rings, spines, pylons, discs, drums, towers, hangars, drydocks, trusses and solar wings are all in the kit, so you can build the station you have in your head.

## ▶ [Play Super Orbital Simulator](https://ramziessgxr.github.io/super-orbital-simulator/)

It runs in your browser on a computer, or on a phone or tablet held sideways. There is nothing to install. Turn the sound on.

**Quick start:** press **ECONOMY**. Open the **DOCK** group at the bottom left, press `Q` for a Docking Port, move the pointer near Station Command and click when the little blue dot lights up. Add a Cargo Module from **INDUS** and a Hab Module from **HAB** the same way, and the first ships and colonists arrive within a minute. Want to just build? Press **FREE PLAY** instead.

## How to play

- **Two modes.**
  - **Economy** is the game: Station Command and 2,500 CR to build with. Keep the factions happy, raise the station's capability and climb the upgrade path.
  - **Free Play** is for building: every part and room, no costs and the biggest build zone. Its controls (`K`) call in freighters, shuttles and damaged warships, add 10 colonists, break a part, clear every ship and switch automatic traffic off, and it runs at up to 16×. A live readout shows what the station is doing.
- **Build:** parts come in seven groups, like a corvette builder: Structure, Habitation, Docking, Industry, Power, Defence and Comms. Click a group (or `Tab` through them) and pick a part (`Q W E T Y A S D`). Small see-through blue dots show the free ports near the pointer (on a phone, every free port shows faintly). Hover one to see the part in place, then click to build it. `R` turns it 45°. `P` turns the dots off; parts still snap to the nearest port. Right-click or `Esc` puts the part down.
- **Build inside:** select a part and press **EDIT INSIDE** (`I`). Its hull turns to glass, everything else fades, and its rooms show in 3D with a name on each. Pick a room from the palette and click rooms in the part to build it there, tycoon style. A part does what its rooms do, so a ring doesn't have to be quarters all the way round: make it quarters, a mess hall, a market, a medbay and a security office. Shuttle Bays and Fighter Bays only fit in a Hangar or a Drydock. On a phone, tap a room number and then a room.
- **Look around:** drag to orbit, right-drag to pan, scroll or pinch to zoom. Click the minimap to look somewhere. `H` hides the whole interface (panels, tips, toasts and all) for a clean look at your station; tap the station to bring the SHOW UI button back for a moment.
- **Select:** click a part to see what it does, its rooms and who lives there. `F` focuses on it and `X` demolishes it (half the cost back). Only parts with nothing attached can come down.
- **Views** (bottom right, or `1`-`4`):
  - **Blueprint** is a green technical drawing in 3D, with the X, Y and Z planes.
  - **Hull** shows the station as it would look, under its sun, over a planet (a Mars-type, ice, highland, desert, jungle or barren world, different every game) with a moon or two. The stars, sun and moons stay put however you move the camera.
  - **Life Signs** is an x-ray: the hull fades and everyone inside glows through the walls. People outside on EVA show as white dots.
  - **Cutaway** slices away the quarter of the station facing you, to show the rooms inside. It works with every view.
- **Factions:** Supply, Maintenance, Security and Medical are also the station's factions, and each has an ideal station. Supply wants Cargo Stores close to the docks, Maintenance wants Workshops near everything that breaks, Security wants an office close to every bay, Medical wants a Medbay close to the beds. Each has a mood from 0 to 100 worked out from your layout: happy factions work up to 25% faster, unhappy ones up to 25% slower and complain on the comms. Nothing ends the game.
- **Requests:** every minute or two a faction that is missing something asks for a room, with **APPROVE** and **DENY** right in the message (or on its page in the Commander's channel). Approving builds it in a free space near the problem and marks it with the faction's colour (you see the flag in Cutaway and when editing inside). Denying or ignoring costs goodwill. The COMMANDER button counts what is waiting.
- **Named people:** everyone aboard has a name. Click a life sign (Life Signs or Cutaway view) or a name in a faction's crew list to see who they are and what they are doing.
- **People:** you never manage them one by one. Haulers carry crates, engineers fix faults, officers inspect ships and medics run the medbays. When something is being built or repaired, engineers in suits go out on EVA and you can watch them work on the hull.
- **Station comms** come in at the bottom right, above the minimap, in a window you can close (`C`; it counts what you missed). Every message comes in on a channel (Traffic Control, the Ministry of Truth, Patriotic Maintenance, ship captains and more) with its own colour, signal and sign-off.
- **The Commander's channel** (`O`): one tab for each division you can talk to.

  | Division | Budget pays for | Standing orders |
  | --- | --- | --- |
  | Ministry of Supply | haulers | normal or double shifts |
  | Patriotic Maintenance | engineers | fix what breaks, or preventive maintenance |
  | Democracy Officers | officers | spot checks, or inspect every ship |
  | Medical Corps | medics | free care, or fees |
  | Traffic Control | (no budget) | which ships, and how many |
  | Ministry of Truth | broadcasts | the Patriotic Hour, a Recruitment Drive, or silence |

  Each division reports in its own voice, and acknowledges your orders on the radio. Staff need places to work: Cargo Stores for haulers, Workshops for engineers, Security Offices and Medbays.
- **Capability** (CAP in the top bar) is what the station adds to the war effort: crates traded, ships served, residents, defence, warships repaired and staff on duty, all scaled by how happy the factions are. It is the score, and it opens the upgrade path.
- **The upgrade path** (`U`, or click the tier at the top): Outpost, Garrison, Fortress, Citadel. Each tier grows the build zone and unlocks parts and rooms, and the panel shows what the next one needs and what it brings.

  | Tier | Build zone | Needs | Unlocks |
  | --- | --- | --- | --- |
  | Outpost | 16 | | the basics |
  | Garrison | 40 | 12 residents, 80 capability, 20 power | the Long Spine, rings, drums, discs, towers, pylons, the Docking Ring, fuel tanks, radiators, dishes and propaganda screens; bunk rooms, markets, bars, medbays, security and truth offices |
  | Fortress | 70 | 60 residents, 300 capability, 60 power, a Security Office and a Medbay | hangars, drydocks, refineries, turrets, shields, shuttle and fighter bays |
  | Citadel | 120 | 150 residents, 1,000 capability, morale 70 | the biggest zone the Ministry grants |
- **The loop:** Docking Ports bring ships. Freighters unload crates, and blue haulers walk each one through the station to a Cargo Store, where it pays 15 CR. Shuttles bring colonists for Quarters, and the colonists pay tax (set it in **MENU**). Markets and bars earn, mess halls and lounges keep morale up, and reactors and solar arrays keep the power on.

**Layout matters.** Haulers walk through the station, so a docking port far from the cargo means slow unloading, ships giving up and an unhappy Supply faction. `npm run sim` and `npm run sim:far` run the same station with the port beside the cargo and at the far end of a truss, and print capability and each faction's mood every minute. The near station reaches Garrison in about 4 minutes; the far one never does in twelve.

## The part kit

| Group | Parts |
| --- | --- |
| Structure | Core Segment, Long Spine, Hub Junction, Truss, Node, Connector Tube |
| Habitation | Hab Module, Habitat Ring, Habitat Drum, Promenade Disc, Hab Tower, Arboretum Dome, Observation Blister |
| Docking | Docking Port, Docking Pylon, Docking Ring, Hangar, Drydock |
| Industry | Cargo Module, Cargo Rack, Fuel Tanks, Refinery |
| Power | Reactor Core, Solar Array, Radiator |
| Defence | Flak Turret, Shield Emitter |
| Comms | Comms Spire, Dish Antenna, Propaganda Screen |

**Rooms:** Quarters, Bunk Room, Mess Hall, Observation Lounge, Hydroponics, Workshop, Cargo Store, Ops Center, Market, Liberty Lounge, Medbay, Security Office, Truth Office, Shuttle Bay and Fighter Bay.

Any part can go on any free port. Parts may overlap and nest on purpose, so a ring can sit inside a ring.

## How it's built

Plain JavaScript modules, no framework and no build step. The 3D is three.js, vendored as one minified file in `js/vendor/`. Every part, room, ship, suit and planet is built in code from simple shapes and noise: there are no model, image or sound files. The look (palette, type, panels, buttons, scanlines) and the way planets are painted are carried over from Orbital Fury.

```
index.html          the page, the title card and the menu
css/style.css       the Orbital Fury theme plus the Age of Empires-style HUD
js/config.js        every tuning number: parts, rooms, divisions, orders and tiers
js/math3.js         small vector and quaternion helpers for the simulation
js/sim.js           the simulation: parts and rooms, walking, staff, ships, faults, economy, morale, tiers (no DOM, no 3D)
js/parts.js         every part, room, ship and suit, drawn in code, plus the grid icons
js/planets.js       planets and moons, painted with noise the way Orbital Fury paints Mars
js/noise.js         value noise, from Orbital Fury
js/view.js          the 3D view: blueprint space, the four views, rooms, EVA, the sky, picking
js/audio.js         synthesised sound
js/main.js          the loop, input, HUD, comms, the Commander's channel, the upgrade path and the minimap
js/vendor/three.js  three.js (MIT), see js/vendor/THREE-LICENSE
test/headless.mjs   runs a station without a browser and prints the economy, capability and faction moods (add `approve` as a fifth argument to say yes to every request)
test/ui.mjs         plays it through the real page on a desktop and a phone held sideways
test/fit.mjs        opens the interface at seven screen sizes and reports anything cut off, spilling out of its box or overlapping
tools/vendor.mjs    rebuilds js/vendor/three.js
tools/bundle.mjs    builds dist/super-orbital-simulator.html, the whole game in one file
```

**Running your own copy.** Serve this folder with any local web server (`npm start`, then open <http://localhost:8080>). Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

Tests: `npm run sim` needs only Node. For the browser test, `npm install`, `npm start` in one terminal and `npm run ui` in another. `?seed=N` fixes the random seed (and so the planet), and `?economy` or `?free` skips the title.

Prototype 0.1, the flat cross-section version, is the first commit in the history; 0.2 was the first 3D version.

## Give feedback

This is an early prototype, and feedback is how it gets better. Join the **[SESF Helldivers Discord](https://discord.com/invite/qruRY4nkEz)** and tell us what you played on, what you built, what was fun, and what was confusing or broken. Screenshots of your stations are very welcome (`H` hides the interface).

## Credits and disclaimer

- **Created and vibe coded by** Robert Troumbley (RamziesSGXR), head admin of the Super Earth Special Forces (SESF) community.
- **Art is drawn in code** and **sound is synthesised** in the browser. There are no image, model or sound files in the game.
- **three.js** (MIT License, three.js authors) draws the 3D. See `js/vendor/THREE-LICENSE`.
- **Inspired by** Helldivers 2 (Arrowhead Game Studios, published by Sony Interactive Entertainment).
- **Unofficial fan project.** Not affiliated with, endorsed by or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers, Super Earth, Super Destroyer, SEAF and the other names, phrases, factions and settings from the Helldivers games belong to their owners and are used only to refer to them. Free, no ads, collects nothing, provided as is with no warranty.
- **Build and test tools** (not part of the game): esbuild (MIT) and Playwright (Apache 2.0).
