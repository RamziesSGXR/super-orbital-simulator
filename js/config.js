// Every tuning number for Super Orbital Simulator lives here. Change them here, never in game logic.
// THE MINISTRY STANDARD PATTERN. One station unit is 9 m (C.scale.m) and a person is 1.8 m (C.scale.person). Rooms are furnished
// in metres from real things at real sizes (rooms.js): a bed is 2 m, a door 1.2 m by 2.1 m, a wall 2.5 m, a worktop 0.9 m.
// Decks are about 9 m apart: the space between is tanks, ducts and the gravity plates. Gravity is made by the deck plates, and it
// points the same way everywhere: toward the keel (−Y), where the planet is. So every deck is level, however a part is attached.
// Only LOOSE parts (arrays, dishes, guns, racks: nothing to stand on) may be turned any way round.
// Distances are in station units. Money is in credits (CR); rates are per minute of game time.
//
// PARTS snap together at PORTS. A port is [x, y, z, dx, dy, dz, kind] in the part's own frame: where it is and which way it faces.
// Port 0 is the part's BASE, the port it attaches with. Spine parts ('S' base) stack along their own axis (local Y); arm parts
// ('L' base) stick out along their local +X. Any part can go on any free port: the kit is meant to be free.
// Parts sit in GROUPS (like a corvette builder's categories) and unlock by TIER on the upgrade path.
// Many parts have SLOTS inside: rooms you build out in the cutaway. A part's job comes from its rooms, not from the part.
// THE STANDARD SILL. Every side port opens onto a deck exactly 0.4 below the port's centre (3.6 m), on both sides of the join, so
// floors meet level wherever two parts are joined and an airlock is all that stands between them. A port in a roof or a floor
// is reached by a lift tube instead. WALK (below, C.ways) says how people move through each part.
const ring4 = (r, y = 0, a0 = 0) => [0, 1, 2, 3].map((i) => { const a = a0 + i * Math.PI / 2; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });
const ring6 = (r, y = 0) => [0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });
const spine = (h) => [[0, -h / 2, 0, 0, -1, 0, 'S'], [0, h / 2, 0, 0, 1, 0, 'S']];
const arm = (len) => [[0, 0, 0, -1, 0, 0, 'L'], [len, 0, 0, 1, 0, 0, 'L']];
const fill = (n, room) => Array(n).fill(room);
const deg = (xs) => xs.map((x) => x * Math.PI / 180);

export const C = {
  version: '0.11.7',

  groups: [
    { id: 'structure', name: 'STRUCTURE' }, { id: 'platform', name: 'FIRE SUPPORT' }, { id: 'habitation', name: 'HABITATION' }, { id: 'docking', name: 'DOCKING' },
    { id: 'industry', name: 'INDUSTRY' }, { id: 'power', name: 'POWER' }, { id: 'defence', name: 'DEFENCE' }, { id: 'comms', name: 'COMMS' },
  ],

  parts: {
    command:  { name: 'Station Command', group: 'structure', cost: 0, up: 0, pw: -6, build: 0, fixed: true, homes: { hauler: 3 }, center: [0, 0, 0], r: 2,
      about: 'The heart of the station. Everything connects back to it.', rooms: ['ops', 'quarters', 'workshop'],
      ports: [[0, -1.7, 0, 0, -1, 0, 'S'], [0, 1.7, 0, 0, 1, 0, 'S'], ...ring4(1.2, -0.58)] },
    // ---- structure
    core:     { name: 'Core Segment', group: 'structure', tier: 0, cost: 60, up: 1, pw: 1, build: 3, center: [0, 0, 0], r: 1.6, rooms: fill(2, 'empty'),
      about: 'A section of spine with four side ports and two decks inside.', ports: [...spine(3), ...ring4(1.2, -0.33)] },
    longcore: { name: 'Long Spine', group: 'structure', tier: 1, cost: 110, up: 2, pw: 1, build: 5, center: [0, 0, 0], r: 3.2, rooms: fill(4, 'empty'),
      about: 'A tall spine with eight side ports and four decks.', ports: [...spine(6), ...ring4(1.2, -1.83), ...ring4(1.2, 1.17, Math.PI / 4)] },
    junction: { name: 'Hub Junction', group: 'structure', tier: 0, cost: 70, up: 1, pw: 1, build: 3, center: [0, 0, 0], r: 1.8, rooms: fill(1, 'empty'),
      about: 'A short, wide spine piece with six side ports, for stars of arms.', ports: [...spine(1.6), ...ring6(1.6)] },
    truss:    { name: 'Truss', group: 'structure', tier: 0, cost: 25, up: 0, pw: 0, build: 2, center: [2.5, 0, 0], r: 2.6,
      about: 'A lattice beam with a crawlway. Cheap reach for arrays and modules.', ports: [...arm(5), [2.5, 0, 0.5, 0, 0, 1, 'L'], [2.5, 0, -0.5, 0, 0, -1, 'L']] },
    node:     { name: 'Node', group: 'structure', tier: 0, cost: 50, up: 1, pw: 0, build: 3, center: [0.9, 0, 0], r: 1,
      about: 'A docking adapter with five more ports, for branching arms.',
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.8, 0, 0, 1, 0, 0, 'L'], [0.9, 0.9, 0, 0, 1, 0, 'L'], [0.9, -0.9, 0, 0, -1, 0, 'L'], [0.9, 0, 0.9, 0, 0, 1, 'L'], [0.9, 0, -0.9, 0, 0, -1, 'L']] },
    tube:     { name: 'Connector Tube', group: 'structure', tier: 0, cost: 20, up: 0, pw: 0, build: 2, center: [2, 0, 0], r: 2,
      about: 'A slim pressurised walkway between two parts.', ports: arm(4) },
    // ---- the fire support platform: the decks that face the planet. Each belongs to one SYSTEM of the Orbital Fury armory.
    // keel: its guns point down at the planet, so it cannot go on a port that faces up.
    gunmount: { name: 'Ship Gun', group: 'platform', tier: 0, cost: 220, up: 3, pw: 3, build: 6, sys: 'gun', keel: true, center: [1.7, 0, 0], r: 2.4, rooms: ['guncrew', 'magazine'],
      about: 'The ship gun on its mount, with its crew room and ammo bay. Answers calls for gun fire.', ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.7, 0.8, 0.35, 0, 1, 0, 'L']] },
    battery:  { name: 'Orbital Battery', group: 'platform', tier: 0, cost: 280, up: 4, pw: 4, build: 8, sys: 'orbital', keel: true, center: [2.3, 0, 0], r: 3, rooms: ['guncrew', 'magazine', 'magazine'],
      about: 'One orbital cannon and its magazines. Each battery is one strike slot, up to five.', ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.5, 0.8, 0.35, 0, 1, 0, 'L'], [1.725, 0, 1, 0, 0, 1, 'L'], [1.725, 0, -1, 0, 0, -1, 'L']] },
    dronebay: { name: 'Drone Bay', group: 'platform', tier: 1, cost: 200, up: 2, pw: 2, build: 5, sys: 'uav', keel: true, center: [1.5, 0, 0], r: 2, rooms: ['dronerack', 'ops'],
      about: 'Launches the UAV that scans the ground for the gunner.', ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.5, 0.8, 0.35, 0, 1, 0, 'L']] },
    relay:    { name: 'Target Relay', group: 'platform', tier: 1, cost: 150, up: 2, pw: 2, build: 4, sys: 'uav', keel: true, center: [1, -0.6, 0], r: 1.8,
      about: 'A dish aimed at the ground. Widens the strike zone: the UAV system counts as better equipped.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    barracks: { name: 'SEAF Barracks', group: 'platform', tier: 1, cost: 320, up: 4, pw: 2, build: 7, sys: 'seaf', center: [2.6, 0, 0], r: 2.8, rooms: ['barrack', 'barrack', 'armoury'],
      about: 'Bunks and an armoury for the SEAF troopers who drop to the surface.', ports: [...arm(5.2), [1.85, 0, 1.1, 0, 0, 1, 'L'], [1.85, 0, -1.1, 0, 0, -1, 'L']] },
    eaglehangar: { name: 'Eagle Hangar', group: 'platform', tier: 2, cost: 440, up: 6, pw: 3, build: 9, sys: 'eagle', bay: true, center: [3.5, 0, 0], r: 4.2, rooms: ['eaglepad', 'eaglepad', 'ordnance'],
      about: 'Two rearming pads for Eagles, and the ordnance store that feeds them.', ports: [[0, -0.98, 0, -1, 0, 0, 'L'], [3.5, 1.5, 1.73, 0, 1, 0, 'L'], [2.65, -0.98, 2.4, 0, 0, 1, 'L'], [2.65, -0.98, -2.4, 0, 0, -1, 'L']] },
    pelicanbay: { name: 'Pelican Bay', group: 'platform', tier: 2, cost: 400, up: 5, pw: 3, build: 9, sys: 'seaf', bay: true, center: [4, 0, 0], r: 4.6, rooms: ['pelicanpad', 'armoury', 'barrack'],
      about: 'A launch bay for the Pelicans that carry SEAF down and bring them home.', ports: [[0, -1.18, 0, -1, 0, 0, 'L'], [4, 1.7, 1.88, 0, 1, 0, 'L'], [2.85, -1.18, 2.7, 0, 0, 1, 'L'], [2.85, -1.18, -2.7, 0, 0, -1, 'L']] },
    fabshop:  { name: 'Fabrication Shop', group: 'platform', tier: 2, cost: 300, up: 4, pw: 4, build: 7, sys: 'fab', center: [2.2, 0, 0], r: 2.6, rooms: ['fab', 'cargostore'],
      about: 'Packs the crates of wire, bastions and turrets that drop to the troops.', ports: [...arm(4.4), [2.2, 0.9, 0.45, 0, 1, 0, 'L']] },
    lance:    { name: 'Democracy Lance', group: 'platform', tier: 3, cost: 1500, up: 12, pw: 12, build: 16, sys: 'classified', keel: true, center: [3, -1.5, 0], r: 5, rooms: ['guncrew', 'magazine', 'magazine'],
      about: 'CLASSIFIED. One great weapon, by permission of the Ministry.', ports: [[0, 0, 0, -1, 0, 0, 'L'], [2, 0.9, 0.53, 0, 1, 0, 'L']] },
    // ---- habitation
    hab:      { name: 'Hab Module', group: 'habitation', tier: 0, cost: 90, up: 2, pw: 1, build: 4, center: [2.4, 0, 0], r: 2.6, rooms: fill(3, 'quarters'),
      about: 'A pressurised module with three rooms, quarters to start.', ports: [...arm(4.8), [1.8, 0, 1, 0, 0, 1, 'L'], [1.8, 0, -1, 0, 0, -1, 'L']] },
    ring:     { name: 'Habitat Ring', group: 'habitation', tier: 1, cost: 420, up: 8, pw: 4, build: 10, center: [0, 0, 0], r: 8, rooms: fill(12, 'quarters'),
      about: 'A torus on four spokes with twelve rooms round it. Its rim takes more parts.', ports: [...spine(1.4), ...ring4(7.95)] },
    drum:     { name: 'Habitat Drum', group: 'habitation', tier: 1, cost: 340, up: 6, pw: 3, build: 8, center: [0, 0, 0], r: 4.8, rooms: fill(8, 'quarters'),
      about: 'A deep drum round the spine: two decks of four rooms.', ports: [...spine(2.6), ...ring4(4.7, -0.33)] },
    disc:     { name: 'Promenade Disc', group: 'habitation', tier: 1, cost: 300, up: 6, pw: 3, build: 8, center: [0, 0, 0], r: 5.6,
      rooms: ['market', 'mess', 'market', 'bar', 'market', 'mess', 'market', 'bar'],
      about: 'Shops, mess halls and a lounge round the spine: eight rooms.', ports: [...spine(1.6), ...ring6(5.6)] },
    tower:    { name: 'Hab Tower', group: 'habitation', tier: 1, cost: 300, up: 5, pw: 3, build: 8, center: [0, 0, 0], r: 3.6, rooms: fill(6, 'quarters'),
      about: 'A hexagonal tower of six decks, with a port on every face.', ports: [...spine(7), ...ring6(1.56, -0.18)] },
    dome:     { name: 'Arboretum Dome', group: 'habitation', tier: 0, cost: 120, up: 2, pw: 1, build: 5, center: [0, 0.8, 0], r: 2.3, rooms: ['hydro'],
      about: 'Trees under glass. Caps a spine or an arm.', ports: [[0, -0.2, 0, 0, -1, 0, 'S']] },
    blister:  { name: 'Observation Blister', group: 'habitation', tier: 0, cost: 80, up: 1, pw: 1, build: 3, center: [1.4, 0, 0], r: 1.5, rooms: ['lounge'],
      about: 'A glass bubble on an arm, with a room to watch the war go by.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- docking
    dockport: { name: 'Docking Port', group: 'docking', tier: 0, cost: 100, up: 3, pw: 2, build: 4, berth: [2.7, 0, 0, 1, 0, 0], ships: ['freighter', 'shuttle'], crates: 6, center: [1.1, 0, 0], r: 1.6,
      about: 'A berth for one ship: freighters (6 crates) and colonist shuttles.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    pylon:    { name: 'Docking Pylon', group: 'docking', tier: 1, cost: 150, up: 4, pw: 2, build: 6, berth: [5, 4.9, 0, 0, 1, 0], ships: ['freighter', 'shuttle'], crates: 8, center: [2.5, 0, 0], r: 4,
      about: 'A tall arm with a berth at its tip for heavy freighters (8 crates).', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    bigring:  { name: 'Docking Ring', group: 'docking', tier: 1, cost: 380, up: 6, pw: 3, build: 10, center: [0, 0, 0], r: 12.5, rooms: ['quarters', 'cargostore', 'quarters', 'cargostore', 'quarters', 'cargostore', 'quarters', 'cargostore', 'quarters', 'cargostore', 'quarters', 'cargostore'],
      about: 'A wide outer ring on six spokes: quarters and cargo stores, and six rim ports for docks.', ports: [...spine(1.2), ...ring6(13.0)] },
    hangar:   { name: 'Hangar', group: 'docking', tier: 2, cost: 360, up: 6, pw: 3, build: 9, bay: true, center: [4, 0, 0], r: 4.6, rooms: ['shuttlebay', 'workshop', 'cargostore'],
      berth: [8.2, 0, 0, 1, 0, 0], ships: ['shuttle'], berthRoom: 'shuttlebay',
      about: 'A big bay with a door at the end. Build a Shuttle Bay inside and shuttles land in it.', ports: [[0, -1.18, 0, -1, 0, 0, 'L'], [4, 1.7, 1.88, 0, 1, 0, 'L'], [2.85, -1.18, 2.7, 0, 0, 1, 'L'], [2.85, -1.18, -2.7, 0, 0, -1, 'L']] },
    drydock:  { name: 'Drydock', group: 'docking', tier: 2, cost: 420, up: 6, pw: 4, build: 10, bay: true, center: [1, 0, 0], r: 8, rooms: ['workshop', 'workshop'],
      berth: [6, 0, 0, 1, 0, 0], ships: ['warship'], berthRoom: 'workshop',
      about: 'An open frame where damaged warships come in for repairs, by engineers on EVA. Needs a Workshop inside.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- industry
    cargo:    { name: 'Cargo Module', group: 'industry', tier: 0, cost: 90, up: 2, pw: 1, build: 4, center: [2.4, 0, 0], r: 2.6, rooms: fill(3, 'cargostore'),
      about: 'A module of cargo stores: haulers bring crates here.', ports: [...arm(4.8), [1.8, 0, 1, 0, 0, 1, 'L'], [1.8, 0, -1, 0, 0, -1, 'L']] },
    rack:     { loose: true, name: 'Cargo Rack', group: 'industry', tier: 0, cost: 60, up: 1, pw: 0, build: 3, cargo: true, homes: { hauler: 1 }, center: [2, 0, 0], r: 2.2,
      about: 'An open frame of containers. Takes crates, and houses one hauler.', ports: [...arm(4), [2, 1.1, 0, 0, 1, 0, 'L'], [2, -1.1, 0, 0, -1, 0, 'L']] },
    tanks:    { loose: true, name: 'Fuel Tanks', group: 'industry', tier: 1, cost: 140, up: 2, pw: 0, build: 5, fuel: 5, center: [2, 0, 0], r: 2.2,
      about: 'Three tanks of fuel. Every ship that docks buys some: +5 CR a ship (up to 3).', ports: arm(4.2) },
    refinery: { name: 'Refinery', group: 'industry', tier: 2, cost: 300, up: 5, pw: 4, build: 8, refine: 4, center: [2, 0, 0], r: 2.6, rooms: ['workshop', 'cargostore'],
      about: 'Processes cargo: +4 CR on every crate delivered (up to 2 refineries).', ports: [...arm(4), [2, 1.2, 0.35, 0, 1, 0, 'L']] },
    // ---- power
    reactor:  { name: 'Reactor Core', group: 'power', tier: 0, cost: 160, up: 6, pw: -16, build: 6, center: [0, 0, 0], r: 2.4, rooms: ['workshop'],
      about: 'Supplies 16 power. Goes in the spine.', ports: [[0, -1.75, 0, 0, -1, 0, 'S'], [0, 1.75, 0, 0, 1, 0, 'S'], ...ring4(2.2)] },
    solar:    { loose: true, name: 'Solar Array', group: 'power', tier: 0, cost: 70, up: 1, pw: -6, build: 3, center: [0.6, 0, 0], r: 6,
      about: 'Two wings of cells: supplies 6 power. R turns the wings.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    radiator: { loose: true, name: 'Radiator', group: 'power', tier: 1, cost: 90, up: 1, pw: -4, build: 3, center: [1.6, 0, 0], r: 4,
      about: 'Heat fins that let the reactors run harder: +4 power.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- defence
    turret:   { loose: true, name: 'Flak Turret', group: 'defence', tier: 1, cost: 200, up: 3, pw: 2, build: 5, defence: 4, center: [0.6, 0, 0], r: 1.4,
      about: 'Twin guns on a turning mount. Defence +4.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    shield:   { loose: true, name: 'Shield Emitter', group: 'defence', tier: 2, cost: 260, up: 4, pw: 4, build: 6, defence: 6, center: [1.2, 0, 0], r: 1.8,
      about: 'Projects a shield over the station. Defence +6.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- comms
    spire:    { name: 'Comms Spire', group: 'comms', tier: 0, cost: 50, up: 1, pw: 1, build: 3, traffic: 0.2, center: [0, 0, 0], r: 2.5,
      about: 'Caps the spine. Ships come 20% more often (up to 2).', ports: [[0, -2, 0, 0, -1, 0, 'S']] },
    dish:     { loose: true, name: 'Dish Antenna', group: 'comms', tier: 1, cost: 110, up: 2, pw: 1, build: 4, traffic: 0.15, center: [1, 0, 0], r: 2,
      about: 'A long-range dish. Ships come 15% more often (up to 2).', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    billboard:{ loose: true, name: 'Propaganda Screen', group: 'comms', tier: 1, cost: 90, up: 1, pw: 1, build: 3, leisure: 3, center: [0.8, 0, 0], r: 2.4,
      about: 'A giant screen of Super Earth slogans, for passing ships and residents. Morale +3.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
  },

  // WAYS: how people move through each part (parts.js calls this table WALK).
  //   shaft: a lift up the middle, one stop on every deck, and a gallery round each deck at radius g, just inside the hull.
  //   hall:  a hallway along the part at floor height y, to one side at z. fx: how far in from an end port its entry lies.
  //   ring:  a hallway round the part at radius R; spokes are the angles of the hallways in to the lift at the hub.
  // hw: half the hallway's width, where it is not the standard 0.19 (1.7 m either side of the centre line). h0: where the hull is
  // full width, if the hallway would otherwise start in the narrow collar before it.
  ways: {
    command: { k: 'shaft', g: 1.06 }, core: { k: 'shaft', g: 1.06 }, longcore: { k: 'shaft', g: 1.06 }, junction: { k: 'shaft', g: 1.42 }, tower: { k: 'shaft', g: 1.4 }, dome: { k: 'shaft' },
    reactor: { k: 'ring', R: 0.86, y: -0.4, spokes: deg([225]), hub: 0.56, hw: 0.12 },
    hab: { k: 'hall', y: -0.4, z: 0.6, fx: 0.65 }, cargo: { k: 'hall', y: -0.4, z: 0.6, fx: 0.65 },
    ring: { k: 'ring', R: 6.45, y: -0.4, spokes: deg([0, 90, 180, 270]) }, bigring: { k: 'ring', R: 11.72, y: -0.4, spokes: deg([30, 90, 150, 210, 270, 330]), hw: 0.15 },
    drum: { k: 'ring', R: 3.38, spokes: deg([0, 90, 180, 270]) }, disc: { k: 'ring', R: 4.55, y: -0.4, spokes: deg([0, 45, 90, 135, 180, 225, 270, 315]) },
    blister: { k: 'hall', y: -0.4, z: 0 }, dockport: { k: 'hall', y: -0.4, z: 0 }, tube: { k: 'hall', y: -0.4, z: 0 }, truss: { k: 'hall', y: -0.4, z: 0 }, node: { k: 'hall', y: -0.4, z: 0, tz: -0.3 },
    hangar: { k: 'hall', y: -1.58, z: 2.15, fx: 0.22 }, pelicanbay: { k: 'hall', y: -1.58, z: 2.15, fx: 0.22 }, eaglehangar: { k: 'hall', y: -1.38, z: 2.0, fx: 0.22 },
    drydock: { k: 'hall', y: -0.4, z: 0.75, fx: 0.12, hw: 0.15 }, refinery: { k: 'hall', y: -0.4, z: 0.62, fx: 0.4 },
    gunmount: { k: 'hall', y: -0.4, z: 0.62, fx: 0.34, h0: 0.24 }, battery: { k: 'hall', y: -0.4, z: 0.62, fx: 0.34, h0: 0.24 }, dronebay: { k: 'hall', y: -0.4, z: 0.62, fx: 0.34, h0: 0.24 },
    barracks: { k: 'hall', y: -0.4, z: 0.72, fx: 0.28 }, fabshop: { k: 'hall', y: -0.4, z: 0.72, fx: 0.27 }, lance: { k: 'hall', y: -0.4, z: 0.8, fx: 0.36, h0: 0.24 },
  },

  // Rooms: what a slot inside a part does. bay: only in a Hangar or Drydock. tier: when it unlocks.
  rooms: {
    empty:      { name: 'Empty', short: '', cost: 0, up: 0, col: '#1d2a22' },
    quarters:   { name: 'Quarters', short: 'QTRS', tier: 0, cost: 20, up: 1, beds: 2, col: '#8a6a44', about: 'Beds for 2 residents.' },
    bunks:      { name: 'Bunk Room', short: 'BUNK', tier: 1, cost: 30, up: 1, beds: 4, leisure: -1, col: '#7a5a3a', about: 'Beds for 4, cramped. Morale −1.' },
    mess:       { name: 'Mess Hall', short: 'MESS', tier: 0, cost: 30, up: 1, leisure: 2, col: '#9a7a3a', about: 'Hot meals. Morale +2.' },
    lounge:     { name: 'Observation Lounge', short: 'VIEW', tier: 0, cost: 40, up: 1, leisure: 2, col: '#4a7a8a', about: 'A view of the war. Morale +2.' },
    gym:        { name: 'Recreation Deck', short: 'REC', tier: 0, cost: 40, up: 1, leisure: 2, col: '#5a8a6a', about: 'Weights, games and somewhere to sit. Morale +2.' },
    hydro:      { name: 'Hydroponics', short: 'HYDRO', tier: 0, cost: 40, up: 0, leisure: 1, food: 1, col: '#3a8a4a', about: 'Grows food: upkeep −1, morale +1.' },
    workshop:   { name: 'Workshop', short: 'SHOP', tier: 0, cost: 40, up: 1, homes: { engineer: 2 }, col: '#a08a2a', about: 'Places for 2 engineers.' },
    cargostore: { name: 'Cargo Store', short: 'CRGO', tier: 0, cost: 30, up: 1, cargo: true, homes: { hauler: 1 }, col: '#a06a2a', about: 'Haulers bring crates here. Places for 1 hauler.' },
    ops:        { name: 'Ops Center', short: 'OPS', tier: 0, cost: 60, up: 1, traffic: 0.1, col: '#2a6a9a', about: 'Traffic control consoles: ships 10% more often (up to 3).' },
    market:     { name: 'Market', short: 'MKT', tier: 1, cost: 60, up: 1, income: 6, leisure: 1, col: '#9a5a7a', about: '+6 CR a minute while anyone lives aboard. Morale +1.' },
    bar:        { name: 'Liberty Lounge', short: 'BAR', tier: 1, cost: 60, up: 1, income: 4, leisure: 3, col: '#8a4a9a', about: '+4 CR a minute. Morale +3.' },
    medbay:     { name: 'Medbay', short: 'MED', tier: 1, cost: 60, up: 1, homes: { medic: 2 }, leisure: 1, col: '#3a9a8a', about: 'Places for 2 medics. Morale +1.' },
    customs:    { name: 'Customs Scanner', short: 'SCAN', tier: 0, cost: 50, up: 1, col: '#7a5a3a', about: 'Scans the cargo of every freighter docking within reach and stops 6 smuggled loads in 10. No staff needed.' },
    secoffice:  { name: 'Security Office', short: 'SEC', tier: 1, cost: 60, up: 1, homes: { officer: 2 }, col: '#9a3a3a', about: 'Places for 2 Democracy Officers, who inspect ships nearby.' },
    truth:      { name: 'Truth Office', short: 'TRUTH', tier: 1, cost: 50, up: 1, leisure: 1, broadcast: 1, col: '#9a8a1a', about: 'Morale +1, and the Ministry of Truth\'s broadcasts carry further.' },
    shuttlebay: { name: 'Shuttle Bay', short: 'BAY', tier: 2, cost: 80, up: 2, bay: true, col: '#5a6a8a', about: 'Shuttles land inside the hangar.' },
    brass:      { name: 'Brass Suite', short: 'BRASS', tier: 1, cost: 90, up: 2, homes: { aide: 1 }, col: '#b89a3a', about: 'A suite for visiting top brass, kept spotless. Places for 1 aide.' },
    lab:        { name: 'Laboratory', short: 'LAB', tier: 1, cost: 80, up: 1, homes: { scientist: 2 }, col: '#3a6a9a', about: 'Places for 2 scientists, whose research adds to capability.' },
    guncrew:    { name: 'Gun Crew Room', short: 'GUN', tier: 0, cost: 50, up: 1, homes: { gunner: 2 }, col: '#6a4a3a', about: 'Fire control consoles. Places for 2 gunners.' },
    magazine:   { name: 'Magazine', short: 'MAG', tier: 0, cost: 40, up: 1, mag: 6, col: '#5a4a2a', about: 'Shells in racks behind blast doors. Holds a reserve of 6 shells. Nobody likes to sleep next to one.' },
    barrack:    { name: 'Barrack Room', short: 'SEAF', tier: 1, cost: 40, up: 1, homes: { gunner: 3 }, col: '#4a5a3a', about: 'Bunks and lockers for 3 SEAF troopers.' },
    armoury:    { name: 'Armoury', short: 'ARMS', tier: 1, cost: 50, up: 1, col: '#5a5a4a', about: 'Rifles in racks, for the SEAF.' },
    dronerack:  { name: 'Drone Rack', short: 'UAV', tier: 1, cost: 60, up: 1, homes: { gunner: 1 }, col: '#3a5a6a', about: 'UAVs on their launch rails. A place for 1 operator.' },
    eaglepad:   { name: 'Eagle Pad', short: 'EAGLE', tier: 2, cost: 120, up: 2, bay: true, homes: { gunner: 2 }, col: '#4a5a6a', about: 'One Eagle and its deck crew: a pilot and a loader.' },
    ordnance:   { name: 'Ordnance Store', short: 'ORD', tier: 2, cost: 60, up: 1, mag: 6, col: '#6a5a2a', about: 'Bombs on trolleys for the Eagles. Holds a reserve of 6 shells.' },
    pelicanpad: { name: 'Pelican Pad', short: 'PELI', tier: 2, cost: 100, up: 2, bay: true, homes: { gunner: 2 }, col: '#4a6a5a', about: 'One Pelican on its pad, with its two pilots.' },
    fab:        { name: 'Fabricator', short: 'FAB', tier: 2, cost: 90, up: 2, homes: { gunner: 1 }, col: '#6a6a3a', about: 'Prints and packs drop crates. A place for 1 packer.' },
    fighterbay: { name: 'Fighter Bay', short: 'FTR', tier: 2, cost: 120, up: 3, bay: true, defence: 5, col: '#6a4a4a', about: 'A flight of patrol fighters. Defence +5.' },
  },
  roomOrder: ['quarters', 'bunks', 'mess', 'lounge', 'gym', 'hydro', 'workshop', 'cargostore', 'ops', 'market', 'bar', 'medbay', 'customs', 'secoffice', 'truth', 'brass', 'lab', 'guncrew', 'magazine', 'barrack', 'armoury', 'dronerack', 'eaglepad', 'ordnance', 'pelicanpad', 'fab', 'shuttlebay', 'fighterbay', 'empty'],

  // The divisions you fund and give standing orders to, from the Commander's comms panel.
  div: {
    supply:      { name: 'Ministry of Supply', short: 'SUPPLY', staff: 'hauler', uses: 'coffee', per: 2, allot: 10, col: '#4db8ff',
      orders: { shift: [['normal', 'Normal shifts'], ['double', 'Double shifts: haulers 40% faster, morale −5']],
        rations: [['normal', 'Standard rations'], ['double', 'Double rations: morale +6, rations go twice as fast'], ['short', 'Short rations: half the rations, morale −8']] } },
    maintenance: { name: 'Department of Patriotic Maintenance', short: 'MAINT', staff: 'engineer', uses: 'parts', per: 3, allot: 6, col: '#ffc340',
      orders: { plan: [['reactive', 'Fix what breaks'], ['preventive', 'Preventive: half the faults, upkeep +20%']] } },
    security:    { name: 'Democracy Officers', short: 'SECURITY', staff: 'officer', uses: 'ammo', per: 3, allot: 6, col: '#ff5a4a',
      orders: { checks: [['spot', 'Spot checks: catch half the smugglers'], ['every', 'Inspect every ship: catch them all, unloading waits 4 s']] } },
    medical:     { name: 'Medical Corps', short: 'MEDICAL', staff: 'medic', uses: 'medkits', per: 3, allot: 6, col: '#9dffb8',
      orders: { care: [['free', 'Free care: morale +4, costs 10 CR/min'], ['fees', 'Fees: +2 CR/min per medic, morale −2']] } },
    command:     { name: 'Command Staff', short: 'COMMAND', staff: 'aide', uses: 'luxuries', per: 4, allot: 4, col: '#f5d547', orders: {} },
    science:     { name: 'Science Directorate', short: 'SCIENCE', staff: 'scientist', uses: 'instruments', per: 3, allot: 6, col: '#b48cff', orders: {} },
    gunnery:     { name: 'Fire Support Command', short: 'GUNNERY', staff: 'gunner', uses: 'shells', per: 2, allot: 6, col: '#ff9a3a', orders: {} },
    traffic:     { name: 'Traffic Control', short: 'TRAFFIC', col: '#e6e6e6',
      orders: { mix: [['all', 'All traffic'], ['freight', 'Freighters only'], ['colonists', 'Colonists only']], rate: [['low', 'Light'], ['normal', 'Normal'], ['high', 'Heavy']] } },
    truth:       { name: 'Ministry of Truth', short: 'TRUTH', col: '#ffe600',
      orders: { broadcast: [['patriotic', 'Patriotic hour: morale up to +8, more with Truth Offices'], ['recruitment', 'Recruitment drive: shuttles 50% more often'], ['silence', 'Silence: no broadcast']] } },
  },
  divOrder: ['supply', 'maintenance', 'security', 'medical', 'command', 'science', 'gunnery', 'traffic', 'truth'],
  // Supplies come in on freighters, one unit a crate, and each faction draws its weekly allotment from the stores a day at a time.
  supplies: {
    coffee: { name: 'Coffee', unit: 'tins' }, parts: { name: 'Spare parts', unit: 'crates' }, ammo: { name: 'Ammunition', unit: 'boxes' },
    medkits: { name: 'Medkits', unit: 'kits' }, luxuries: { name: 'Fine rations', unit: 'hampers' }, instruments: { name: 'Instruments', unit: 'cases' },
    rations: { name: 'Rations', unit: 'packs' }, shells: { name: 'Shells', unit: 'shells' },
  },
  supply: { start: 12, allotMax: 40, rationPerResident: 0.5, repairParts: 1 },
  // A station day and week, in seconds of play at 1× speed.
  time: { daySec: 40, week: 7 },
  allotMax: 40,

  // The four staffed divisions are also the station's factions. Each one wants the station laid out its way, and how well it is
  // (plus what you approve) decides how happy it is. Happy factions work faster; unhappy ones work slower and complain.
  // `room` is what they ask you to build, `need` says what they judge the layout by.
  factions: {
    gunnery:     { who: 'Gunnery', room: 'guncrew', wants: 'A ready platform: every gun crewed and fed with shells, magazines close by, and nothing in repair.', ask: 'a Gun Crew Room' },
    supply:      { who: 'Supply', room: 'cargostore', wants: 'Cargo Stores close to the docking ports, so crates do not walk far.', ask: 'a Cargo Store' },
    maintenance: { who: 'Maintenance', room: 'workshop', wants: 'Workshops near everything that can break, and few open faults.', ask: 'a Workshop' },
    security:    { who: 'Security', room: 'secoffice', wants: 'A Security Office close to every docking bay, guns on the hull, and few smugglers getting through.', ask: 'a Security Office' },
    medical:     { who: 'Medical', room: 'medbay', wants: 'A Medbay close to where people sleep.', ask: 'a Medbay' },
    command:     { who: 'Command', room: 'brass', wants: 'A Brass Suite close to Station Command, everything clean and working, and full stores.', ask: 'a Brass Suite' },
    science:     { who: 'Science', room: 'lab', wants: 'Laboratories close to the antennas, domes and observation rooms.', ask: 'a Laboratory' },
  },
  faction: { start: 60, easeSec: 0.9, evalSec: 1.5, low: 35, high: 85, speedMin: 0.75, speedMax: 1.25, requestSec: [70, 120], ttl: 100,
    farUnits: 10, approve: 12, deny: -8, ignore: -4, favorDecay: 0.05, cooldown: 140, praiseCooldown: 400, pending: 3,
    autoCost: 60, autoShare: 0.25, meddle: -6, short: 25, dilemmaSec: [150, 240] },
  // Raiders test the station now and then, from Garrison on. Defence (turrets, shields, fighters, officers) against their strength.
  raid: { firstSec: 420, everySec: [380, 560], warnSec: 25, fightSec: 18, base: 3, perTier: 5, perHit: 4, maxHits: 4, win: 15 },
  // The fire support platform. Each SYSTEM is one line of the Orbital Fury armory; `w` is its weight in the readiness figure and
  // `max` is how many parts of it count. Calls come up from the war below: a ready system answers them, and each answer is capability.
  platform: {
    sys: {
      gun:        { name: 'Ship gun', w: 2, max: 1, call: 'gun fire', shells: 1, weight: 3 },
      orbital:    { name: 'Orbital strikes', w: 3, max: 5, call: 'an orbital strike', shells: 1, weight: 4 },
      uav:        { name: 'UAV scan', w: 1, max: 2, call: 'a UAV scan', shells: 0, weight: 2 },
      eagle:      { name: 'Eagles', w: 2, max: 2, call: 'an Eagle run', shells: 1, weight: 2 },
      seaf:       { name: 'SEAF drops', w: 2, max: 3, call: 'a SEAF drop', shells: 0, weight: 2 },
      fab:        { name: 'Buildables', w: 1, max: 1, call: 'a crate of defences', shells: 0, weight: 1 },
      classified: { name: 'Classified', w: 3, max: 1, call: 'the Democracy Lance', shells: 2, weight: 1 },
    },
    order: ['gun', 'orbital', 'uav', 'eagle', 'seaf', 'fab', 'classified'],
    callSec: [24, 44], firstSec: 50, missSayGap: 90, shortReady: 0.35, bedsNear: 7,
    squads: ['Tibit Tigers', 'Liberty Hounds', 'Ballot Boxers', 'Midnight Knights', 'Phantom Nine', 'Sweet Liberty Four', 'Iron Voters', 'Quiet Resolve'],
  },
  // Capability is what the station adds to the war effort. It is the score, and it opens the upgrade path.
  capability: { crate: 0.5, ship: 1.5, resident: 2, defence: 3, repair: 12, staff: 1, research: 1, raid: 15, call: 2, platform: 12 },
  researchPerMin: 1.5,

  // Ship sizes against the standard (a Pelican is about 25 m, an Eagle 15 m, a freighter 45 m, a destroyer 115 m), and how far off the berth each sits.
  shipScale: { shuttle: 1.1, freighter: 1.2, warship: 1.6, eagle: 0.68 }, shipOff: { shuttle: 1.7, freighter: 3.1, warship: 3 },
  // THE SCALE. One station unit is `m` metres and a person is `person` metres tall. Rooms are furnished in metres (rooms.js), so
  // changing these two numbers rescales the people and every fitting against the station; the hull itself does not change.
  scale: { m: 9, person: 1.8 },
  // Propaganda Screens: what each one shows. Picked per screen on its card. `own` shows the commander's own lines (st.screenLines).
  screens: {
    programs: [['slogans', 'SLOGANS'], ['news', 'WAR NEWS'], ['recruit', 'RECRUITMENT'], ['station', 'THIS STATION'], ['own', 'YOUR OWN']],
    slogans: ['LIBERTY', 'SUPER EARTH', 'REPORT FOR GRATITUDE', 'A HAPPY STATION IS A COMPLIANT STATION', 'DEMOCRACY NEVER SLEEPS', 'HAVE YOU PAID YOUR LIBERTY CONTRIBUTION?', 'FREEDOM IS EARNED IN ORBIT', 'EVERY CRATE A BULLET FOR LIBERTY'],
    recruit: ['THE HELLDIVERS NEED YOU', 'ENLIST TODAY', 'SERVE WITH THE SEAF', 'BE A HERO OF SUPER EARTH', 'YOUR DEMOCRACY NEEDS DEFENDING', 'ASK A DEMOCRACY OFFICER HOW TO ENLIST'],
    news: ['ENEMY OFFENSIVE REPELLED ON THE SOUTHERN FRONT', 'NEW ORBITAL BATTERIES COME ONLINE', 'HELLDIVERS LIBERATE ANOTHER COLONY', 'GROUND FORCES REPORT RECORD MORALE', 'MINISTRY: VICTORY IS IMMINENT', 'SUPPLY LINES SECURE ACROSS THE SECTOR'],
    own: ['WELCOME ABOARD', 'KEEP THE STATION CLEAN', 'GLORY TO SUPER EARTH'],
    maxLines: 8, maxChars: 110,
  },

  // Station livery: the colours, hull plating, interior fit-out and emblem the commander picks.
  livery: {
    schemes: {
      ministry: { name: 'Ministry Grey', hull: '#8c9690', trim: '#f5d547', accent: '#22262a' },
      sesf:     { name: 'SESF Black', hull: '#2b2e33', trim: '#f5d547', accent: '#8a8f96' },
      arctic:   { name: 'Arctic White', hull: '#dfe5e6', trim: '#3d7fc4', accent: '#8a959c' },
      fleet:    { name: 'Fleet Blue', hull: '#3a4f6a', trim: '#7fe9e0', accent: '#1c2636' },
      rust:     { name: 'Frontier Rust', hull: '#8a5a44', trim: '#e8d9b0', accent: '#3a2a24' },
      olive:    { name: 'SEAF Olive', hull: '#5d6a4a', trim: '#e0a83a', accent: '#2a3024' },
    },
    plating: { panels: 'Panelled', plates: 'Armour plate', smooth: 'Smooth', worn: 'Weathered', hazard: 'Hazard stripes' },
    interior: { ministry: { name: 'Ministry', wall: '#b9ab8e', floor: '#8a7a62', lane: '#ffe9a0' }, naval: { name: 'Naval', wall: '#8f9aa6', floor: '#5c6670', lane: '#9fe8ff' }, civic: { name: 'Civic', wall: '#e6e8e2', floor: '#9aa79a', lane: '#b8ffd0' }, brass: { name: 'Brass', wall: '#6a4a3a', floor: '#3c2e28', lane: '#ffc66a' } },
    lights: { warm: '#fff1b0', cool: '#cfeaff', amber: '#ffb648', green: '#b8ffca' },
    emblems: { crest: 'Your crest', wings: 'Wings', star: 'Star', shield: 'Shield', laurel: 'Laurel', none: 'None' },
    def: { name: '', scheme: 'ministry', hull: '#8c9690', trim: '#f5d547', accent: '#22262a', plating: 'panels', interior: 'ministry', lights: 'warm', emblem: 'crest' },
  },

  // YOUR FACTION, founded with the station as in FOB Super Commander: its name, the station's name, a motto, two colours, a crest
  // and how its troopers dress. The primary colour paints the nameplate and the dark bands of the hull, the accent its trim.
  // (C.faction is the factions aboard.)
  founding: {
    def: {
      name: 'Super Earth Special Forces', station: 'Orbital Station', motto: 'Liberty, delivered.', primary: '#22262a', secondary: '#ffe600',
      logo: { shape: 'shield', symbol: 'eagle', bg: '#1b2a1a', fg: '#ffe600', rim: '#ffe600', text: 'SESF', pattern: 'none', pc: '#ffe600' },
      look: { uniform: '#5d6a4a', helmet: '#4c5a3c', armband: '#ffe600', crest: true },
    },
    stations: ['Liberty', 'Vigil', 'Resolve', 'Anvil', 'Dawn', 'Mercy', 'Ballot', 'Granite', 'Providence', 'Steadfast', 'Meridian', 'Equity'],
    kinds: ['Station', 'Outpost', 'Platform', 'Bastion', 'Spire', 'Haven'],
  },

  // A new part may not run through another: more than `cells` of its solid cells inside another part's is a clash. Cells within
  // joinR of the port it joins its host by do not count: parts are drawn to sit into each other there (a gun's pedestal, a dome
  // against a curved end).
  clash: { cells: 6, joinR: 2.5 },

  start: { credits: 2500, tax: 10 },
  sandbox: { credits: 999999 },
  demolish: { sec: 3, refund: 0.5 },

  walk: { speed: 2.4, pickSec: 1.0, dropSec: 0.5, repairSec: 6, inspectSec: 4 },
  ships: { freighterSec: 38, shuttleSec: 42, warshipSec: 95, shuttleMorale: 35, colonists: 4, approachSec: 14, departSec: 11,
    waitSec: 60, queueMax: 3, smuggler: 0.15, repairSec: 30, repairFee: 150, rate: { low: 0.6, normal: 1, high: 1.5 } },
  econ: { crateFee: 8, dockFee: 6, fine: 80, taxPerPct: 0.6 },
  // The market (market.js). base: crates a minute the sector wants moved through a station of each tier, at middling reputation.
  // rep: reputation 0 to 1 (rep0 at the start); it scales demand from repLo to repHi. served/lost/turned: what each ship does to it.
  // runs: supply runs the Ministry adds, per kind of supply the station is short of. elastic: how hard the price answers supply
  // against demand, between priceLo and priceHi. occSec: how long the average of busy berths runs over.
  market: { base: [9, 16, 26, 38], rep0: 0.5, repLo: 0.6, repHi: 1.4, served: 0.006, lost: -0.06, turned: -0.04, runPer: 3, runsMax: 9,
    cratesPerShip: 6.5, windowSec: 240, elastic: 0.6, priceLo: 0.55, priceHi: 1.6, occSec: 240 },
  // ration: what the rations order does to morale and to how fast rations go. festival: a Liberty Day, a one-off lift that fades.
  morale: { ration: { normal: [0, 1], double: [6, 2], short: [-8, 0.5] }, festival: { cost: 150, gain: 12, days: 3, every: 7 }, magazine: 4, base: 70, taxFree: 10, taxPenalty: 2.5, taxBonus: 1, power: 25, leaveBelow: 30, leaveSec: 10, leisureMax: 25, contraband: 10, unrestDecaySec: 60, unrestMax: 30, amnesty: { cost: 80, every: 3 }, scanner: 0.6, faulty: 3 },
  faults: { meanSec: 480 },
  securityReach: 16,

  // The upgrade path: each tier grows the build zone and unlocks parts and rooms of its tier. Nothing is forced.
  tiers: [
    { id: 'outpost', name: 'OUTPOST', radius: 16, about: 'A command module, a ship gun and a permit to grow. Trade, house colonists and keep the gun ready.' },
    { id: 'garrison', name: 'GARRISON', radius: 40, needs: { residents: 12, cap: 80, power: 20, ready: 30 },
      about: 'Recognised by the Ministry. Rings, drums, pylons and the promenade; drone bays and SEAF barracks; with markets, bars, medbays and security offices inside.' },
    { id: 'fortress', name: 'FORTRESS', radius: 70, needs: { residents: 60, cap: 300, power: 60, ready: 50, rooms: ['secoffice', 'medbay'] },
      about: 'A fortified waypoint for the fleet. Eagle hangars, Pelican bays and fabrication shops; hangars and shuttle bays, drydocks for warships, refineries, flak and shields.' },
    { id: 'citadel', name: 'CITADEL', radius: 120, needs: { residents: 150, cap: 1000, morale: 70, ready: 65 },
      about: 'A beacon of managed democracy, with the largest build zone the Ministry grants and its Classified weapons.' },
  ],
};
