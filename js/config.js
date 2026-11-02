// Every tuning number for Super Orbital Simulator lives here. Change them here, never in game logic.
// Distances are in station units (about 10 m). Money is in credits (CR); rates are per minute of game time.
//
// PARTS snap together at PORTS. A port is [x, y, z, dx, dy, dz, kind] in the part's own frame: where it is and which way it faces.
// Port 0 is the part's BASE, the port it attaches with. Spine parts ('S' base) stack along their own axis (local Y); arm parts
// ('L' base) stick out along their local +X. Any part can go on any free port: the kit is meant to be free.
// Parts sit in GROUPS (like a corvette builder's categories) and unlock by TIER on the upgrade path.
// Many parts have SLOTS inside: rooms you build out in the cutaway. A part's job comes from its rooms, not from the part.
const ring4 = (r, y = 0, a0 = 0) => [0, 1, 2, 3].map((i) => { const a = a0 + i * Math.PI / 2; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });
const ring6 = (r, y = 0) => [0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });
const spine = (h) => [[0, -h / 2, 0, 0, -1, 0, 'S'], [0, h / 2, 0, 0, 1, 0, 'S']];
const arm = (len) => [[0, 0, 0, -1, 0, 0, 'L'], [len, 0, 0, 1, 0, 0, 'L']];
const fill = (n, room) => Array(n).fill(room);

export const C = {
  version: '0.3.0',

  groups: [
    { id: 'structure', name: 'STRUCTURE' }, { id: 'habitation', name: 'HABITATION' }, { id: 'docking', name: 'DOCKING' },
    { id: 'industry', name: 'INDUSTRY' }, { id: 'power', name: 'POWER' }, { id: 'defence', name: 'DEFENCE' }, { id: 'comms', name: 'COMMS' },
  ],

  parts: {
    command:  { name: 'Station Command', group: 'structure', cost: 0, up: 0, pw: -6, build: 0, fixed: true, homes: { hauler: 3 }, center: [0, 0, 0], r: 2,
      about: 'The heart of the station. Everything connects back to it.', rooms: ['ops', 'quarters', 'workshop'],
      ports: [[0, -1.7, 0, 0, -1, 0, 'S'], [0, 1.7, 0, 0, 1, 0, 'S'], ...ring4(1.2, -0.5)] },
    // ---- structure
    core:     { name: 'Core Segment', group: 'structure', tier: 0, cost: 60, up: 1, pw: 1, build: 3, center: [0, 0, 0], r: 1.6, rooms: fill(2, 'empty'),
      about: 'A section of spine with four side ports and two decks inside.', ports: [...spine(3), ...ring4(1.2)] },
    longcore: { name: 'Long Spine', group: 'structure', tier: 1, cost: 110, up: 2, pw: 1, build: 5, center: [0, 0, 0], r: 3.2, rooms: fill(4, 'empty'),
      about: 'A tall spine with eight side ports and four decks.', ports: [...spine(6), ...ring4(1.2, -1.5), ...ring4(1.2, 1.5, Math.PI / 4)] },
    junction: { name: 'Hub Junction', group: 'structure', tier: 0, cost: 70, up: 1, pw: 1, build: 3, center: [0, 0, 0], r: 1.8, rooms: fill(1, 'empty'),
      about: 'A short, wide spine piece with six side ports, for stars of arms.', ports: [...spine(1.6), ...ring6(1.6)] },
    truss:    { name: 'Truss', group: 'structure', tier: 0, cost: 25, up: 0, pw: 0, build: 2, center: [2.5, 0, 0], r: 2.6,
      about: 'A lattice beam with a crawlway. Cheap reach for arrays and modules.', ports: [...arm(5), [2.5, 0, 0.5, 0, 0, 1, 'L'], [2.5, 0, -0.5, 0, 0, -1, 'L']] },
    node:     { name: 'Node', group: 'structure', tier: 0, cost: 50, up: 1, pw: 0, build: 3, center: [0.9, 0, 0], r: 1,
      about: 'A docking adapter with five more ports, for branching arms.',
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.8, 0, 0, 1, 0, 0, 'L'], [0.9, 0.9, 0, 0, 1, 0, 'L'], [0.9, -0.9, 0, 0, -1, 0, 'L'], [0.9, 0, 0.9, 0, 0, 1, 'L'], [0.9, 0, -0.9, 0, 0, -1, 'L']] },
    tube:     { name: 'Connector Tube', group: 'structure', tier: 0, cost: 20, up: 0, pw: 0, build: 2, center: [2, 0, 0], r: 2,
      about: 'A slim pressurised walkway between two parts.', ports: arm(4) },
    // ---- habitation
    hab:      { name: 'Hab Module', group: 'habitation', tier: 0, cost: 90, up: 2, pw: 1, build: 4, center: [2.4, 0, 0], r: 2.6, rooms: fill(3, 'quarters'),
      about: 'A pressurised module with three rooms, quarters to start.', ports: [...arm(4.8), [2.4, 0, 1, 0, 0, 1, 'L'], [2.4, 0, -1, 0, 0, -1, 'L']] },
    ring:     { name: 'Habitat Ring', group: 'habitation', tier: 1, cost: 420, up: 8, pw: 4, build: 10, center: [0, 0, 0], r: 8, rooms: fill(12, 'quarters'),
      about: 'A torus on four spokes with twelve rooms round it. Its rim takes more parts.', ports: [...spine(1.4), ...ring4(7.95, 0, Math.PI / 4)] },
    drum:     { name: 'Habitat Drum', group: 'habitation', tier: 1, cost: 340, up: 6, pw: 3, build: 8, center: [0, 0, 0], r: 4.8, rooms: fill(8, 'quarters'),
      about: 'A deep drum round the spine: two decks of four rooms.', ports: [...spine(2.6), ...ring4(4.7)] },
    disc:     { name: 'Promenade Disc', group: 'habitation', tier: 1, cost: 300, up: 6, pw: 3, build: 8, center: [0, 0, 0], r: 5.6,
      rooms: ['market', 'mess', 'market', 'bar', 'market', 'mess', 'market', 'bar'],
      about: 'Shops, mess halls and a lounge round the spine: eight rooms.', ports: [...spine(1.6), ...ring6(5.6)] },
    tower:    { name: 'Hab Tower', group: 'habitation', tier: 1, cost: 300, up: 5, pw: 3, build: 8, center: [0, 0, 0], r: 3.6, rooms: fill(6, 'quarters'),
      about: 'A hexagonal tower of six decks, with a port on every face.', ports: [...spine(7), ...ring6(1.56)] },
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
      about: 'A wide outer ring on six spokes: quarters and cargo stores, and six rim ports for docks.', ports: [...spine(1.2), ...ring6(12.7)] },
    hangar:   { name: 'Hangar', group: 'docking', tier: 2, cost: 360, up: 6, pw: 3, build: 9, bay: true, center: [3, 0, 0], r: 3.6, rooms: ['shuttlebay', 'workshop', 'cargostore'],
      berth: [6.2, 0, 0, 1, 0, 0], ships: ['shuttle'], berthRoom: 'shuttlebay',
      about: 'A big bay with a door at the end. Build a Shuttle Bay inside and shuttles land in it.', ports: [[0, 0, 0, -1, 0, 0, 'L'], [3, 1.5, 0, 0, 1, 0, 'L'], [3, 0, 2, 0, 0, 1, 'L'], [3, 0, -2, 0, 0, -1, 'L']] },
    drydock:  { name: 'Drydock', group: 'docking', tier: 2, cost: 420, up: 6, pw: 4, build: 10, bay: true, center: [1, 0, 0], r: 6, rooms: ['workshop', 'workshop'],
      berth: [4.5, 0, 0, 1, 0, 0], ships: ['warship'], berthRoom: 'workshop',
      about: 'An open frame where damaged warships come in for repairs, by engineers on EVA. Needs a Workshop inside.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- industry
    cargo:    { name: 'Cargo Module', group: 'industry', tier: 0, cost: 90, up: 2, pw: 1, build: 4, center: [2.4, 0, 0], r: 2.6, rooms: fill(3, 'cargostore'),
      about: 'A module of cargo stores: haulers bring crates here.', ports: [...arm(4.8), [2.4, 0, 1, 0, 0, 1, 'L'], [2.4, 0, -1, 0, 0, -1, 'L']] },
    rack:     { name: 'Cargo Rack', group: 'industry', tier: 0, cost: 60, up: 1, pw: 0, build: 3, cargo: true, homes: { hauler: 1 }, center: [2, 0, 0], r: 2.2,
      about: 'An open frame of containers. Takes crates, and houses one hauler.', ports: [...arm(4), [2, 1.1, 0, 0, 1, 0, 'L'], [2, -1.1, 0, 0, -1, 0, 'L']] },
    tanks:    { name: 'Fuel Tanks', group: 'industry', tier: 1, cost: 140, up: 2, pw: 0, build: 5, fuel: 5, center: [2, 0, 0], r: 2.2,
      about: 'Three tanks of fuel. Every ship that docks buys some: +5 CR a ship (up to 3).', ports: arm(4.2) },
    refinery: { name: 'Refinery', group: 'industry', tier: 2, cost: 300, up: 5, pw: 4, build: 8, refine: 4, center: [2, 0, 0], r: 2.6, rooms: ['workshop', 'cargostore'],
      about: 'Processes cargo: +4 CR on every crate delivered (up to 2 refineries).', ports: [...arm(4), [2, 1.2, 0, 0, 1, 0, 'L']] },
    // ---- power
    reactor:  { name: 'Reactor Core', group: 'power', tier: 0, cost: 160, up: 6, pw: -16, build: 6, center: [0, 0, 0], r: 2.4, rooms: ['workshop'],
      about: 'Supplies 16 power. Goes in the spine.', ports: [[0, -1.75, 0, 0, -1, 0, 'S'], [0, 1.75, 0, 0, 1, 0, 'S'], ...ring4(2.2)] },
    solar:    { name: 'Solar Array', group: 'power', tier: 0, cost: 70, up: 1, pw: -6, build: 3, center: [0.6, 0, 0], r: 6,
      about: 'Two wings of cells: supplies 6 power. R turns the wings.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    radiator: { name: 'Radiator', group: 'power', tier: 1, cost: 90, up: 1, pw: -4, build: 3, center: [1.6, 0, 0], r: 4,
      about: 'Heat fins that let the reactors run harder: +4 power.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- defence
    turret:   { name: 'Flak Turret', group: 'defence', tier: 2, cost: 200, up: 3, pw: 2, build: 5, defence: 4, center: [0.6, 0, 0], r: 1.4,
      about: 'Twin guns on a turning mount. Defence +4.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    shield:   { name: 'Shield Emitter', group: 'defence', tier: 2, cost: 260, up: 4, pw: 4, build: 6, defence: 6, center: [1.2, 0, 0], r: 1.8,
      about: 'Projects a shield over the station. Defence +6.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    // ---- comms
    spire:    { name: 'Comms Spire', group: 'comms', tier: 0, cost: 50, up: 1, pw: 1, build: 3, traffic: 0.2, center: [0, 0, 0], r: 2.5,
      about: 'Caps the spine. Ships come 20% more often (up to 2).', ports: [[0, -2, 0, 0, -1, 0, 'S']] },
    dish:     { name: 'Dish Antenna', group: 'comms', tier: 1, cost: 110, up: 2, pw: 1, build: 4, traffic: 0.15, center: [1, 0, 0], r: 2,
      about: 'A long-range dish. Ships come 15% more often (up to 2).', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    billboard:{ name: 'Propaganda Screen', group: 'comms', tier: 1, cost: 90, up: 1, pw: 1, build: 3, leisure: 3, center: [0.8, 0, 0], r: 2.4,
      about: 'A giant screen of Super Earth slogans, for passing ships and residents. Morale +3.', ports: [[0, 0, 0, -1, 0, 0, 'L']] },
  },

  // Rooms: what a slot inside a part does. bay: only in a Hangar or Drydock. tier: when it unlocks.
  rooms: {
    empty:      { name: 'Empty', short: '', cost: 0, up: 0, col: '#1d2a22' },
    quarters:   { name: 'Quarters', short: 'QTRS', tier: 0, cost: 20, up: 1, beds: 2, col: '#8a6a44', about: 'Beds for 2 residents.' },
    bunks:      { name: 'Bunk Room', short: 'BUNK', tier: 1, cost: 30, up: 1, beds: 4, leisure: -1, col: '#7a5a3a', about: 'Beds for 4, cramped. Morale −1.' },
    mess:       { name: 'Mess Hall', short: 'MESS', tier: 0, cost: 30, up: 1, leisure: 2, col: '#9a7a3a', about: 'Hot meals. Morale +2.' },
    lounge:     { name: 'Observation Lounge', short: 'VIEW', tier: 0, cost: 40, up: 1, leisure: 2, col: '#4a7a8a', about: 'A view of the war. Morale +2.' },
    hydro:      { name: 'Hydroponics', short: 'HYDRO', tier: 0, cost: 40, up: 0, leisure: 1, food: 1, col: '#3a8a4a', about: 'Grows food: upkeep −1, morale +1.' },
    workshop:   { name: 'Workshop', short: 'SHOP', tier: 0, cost: 40, up: 1, homes: { engineer: 2 }, col: '#a08a2a', about: 'Places for 2 engineers.' },
    cargostore: { name: 'Cargo Store', short: 'CRGO', tier: 0, cost: 30, up: 1, cargo: true, homes: { hauler: 1 }, col: '#a06a2a', about: 'Haulers bring crates here. Places for 1 hauler.' },
    ops:        { name: 'Ops Center', short: 'OPS', tier: 0, cost: 60, up: 1, traffic: 0.1, col: '#2a6a9a', about: 'Traffic control consoles: ships 10% more often (up to 3).' },
    market:     { name: 'Market', short: 'MKT', tier: 1, cost: 60, up: 1, income: 6, leisure: 1, col: '#9a5a7a', about: '+6 CR a minute while anyone lives aboard. Morale +1.' },
    bar:        { name: 'Liberty Lounge', short: 'BAR', tier: 1, cost: 60, up: 1, income: 4, leisure: 3, col: '#8a4a9a', about: '+4 CR a minute. Morale +3.' },
    medbay:     { name: 'Medbay', short: 'MED', tier: 1, cost: 60, up: 1, homes: { medic: 2 }, leisure: 1, col: '#3a9a8a', about: 'Places for 2 medics. Morale +1.' },
    secoffice:  { name: 'Security Office', short: 'SEC', tier: 1, cost: 60, up: 1, homes: { officer: 2 }, col: '#9a3a3a', about: 'Places for 2 Democracy Officers, who inspect ships nearby.' },
    truth:      { name: 'Truth Office', short: 'TRUTH', tier: 1, cost: 50, up: 1, leisure: 1, broadcast: 1, col: '#9a8a1a', about: 'Morale +1, and the Ministry of Truth\'s broadcasts carry further.' },
    shuttlebay: { name: 'Shuttle Bay', short: 'BAY', tier: 2, cost: 80, up: 2, bay: true, col: '#5a6a8a', about: 'Shuttles land inside the hangar.' },
    fighterbay: { name: 'Fighter Bay', short: 'FTR', tier: 2, cost: 120, up: 3, bay: true, defence: 5, col: '#6a4a4a', about: 'A flight of patrol fighters. Defence +5.' },
  },
  roomOrder: ['quarters', 'bunks', 'mess', 'lounge', 'hydro', 'workshop', 'cargostore', 'ops', 'market', 'bar', 'medbay', 'secoffice', 'truth', 'shuttlebay', 'fighterbay', 'empty'],

  // The divisions you fund and give standing orders to, from the Commander's comms panel.
  div: {
    supply:      { name: 'Ministry of Supply', short: 'SUPPLY', staff: 'hauler', wage: 6, col: '#4db8ff', budget: 30,
      orders: { shift: [['normal', 'Normal shifts'], ['double', 'Double shifts: haulers 40% faster, morale −5']] } },
    maintenance: { name: 'Department of Patriotic Maintenance', short: 'MAINT', staff: 'engineer', wage: 8, col: '#ffc340', budget: 16,
      orders: { plan: [['reactive', 'Fix what breaks'], ['preventive', 'Preventive: half the faults, upkeep +20%']] } },
    security:    { name: 'Democracy Officers', short: 'SECURITY', staff: 'officer', wage: 8, col: '#ff5a4a', budget: 16,
      orders: { checks: [['spot', 'Spot checks: catch half the smugglers'], ['every', 'Inspect every ship: catch them all, unloading waits 4 s']] } },
    medical:     { name: 'Medical Corps', short: 'MEDICAL', staff: 'medic', wage: 8, col: '#9dffb8', budget: 16,
      orders: { care: [['free', 'Free care: morale +4, costs 10 CR/min'], ['fees', 'Fees: +2 CR/min per medic, morale −2']] } },
    traffic:     { name: 'Traffic Control', short: 'TRAFFIC', col: '#e6e6e6',
      orders: { mix: [['all', 'All traffic'], ['freight', 'Freighters only'], ['colonists', 'Colonists only']], rate: [['low', 'Light'], ['normal', 'Normal'], ['high', 'Heavy']] } },
    truth:       { name: 'Ministry of Truth', short: 'TRUTH', col: '#ffe600', budget: 20,
      orders: { broadcast: [['patriotic', 'Patriotic hour: morale + budget/10 (up to 8)'], ['recruitment', 'Recruitment drive: shuttles 50% more often'], ['silence', 'Silence: no broadcast, no cost']] } },
  },
  divOrder: ['supply', 'maintenance', 'security', 'medical', 'traffic', 'truth'],
  budgetMax: 120,

  start: { credits: 2500, tax: 10 },
  sandbox: { credits: 999999 },
  demolish: { sec: 3, refund: 0.5 },

  walk: { speed: 2.4, pickSec: 1.0, dropSec: 0.5, repairSec: 6, inspectSec: 4 },
  ships: { freighterSec: 38, shuttleSec: 42, warshipSec: 95, shuttleMorale: 35, colonists: 4, approachSec: 14, departSec: 11,
    waitSec: 60, queueMax: 3, smuggler: 0.15, repairSec: 30, repairFee: 150, rate: { low: 0.6, normal: 1, high: 1.5 } },
  econ: { crateFee: 15, dockFee: 10, fine: 80, taxPerPct: 0.6 },
  morale: { base: 70, taxFree: 10, taxPenalty: 2.5, taxBonus: 1, power: 25, leaveBelow: 30, leaveSec: 10, leisureMax: 25, contraband: 10, unrestDecaySec: 60, faulty: 3 },
  faults: { meanSec: 480 },
  securityReach: 16,

  // The upgrade path: each tier grows the build zone and unlocks parts and rooms of its tier. Nothing is forced.
  tiers: [
    { id: 'outpost', name: 'OUTPOST', radius: 16, about: 'A command module and a permit to grow. Trade, house colonists and keep the lights on.' },
    { id: 'garrison', name: 'GARRISON', radius: 40, needs: { residents: 12, crates: 30, power: 20 },
      about: 'Recognised by the Ministry. Rings, drums, pylons and the promenade, with markets, bars, medbays and security offices inside.' },
    { id: 'fortress', name: 'FORTRESS', radius: 70, needs: { residents: 60, crates: 300, power: 60, rooms: ['secoffice', 'medbay'] },
      about: 'A fortified waypoint for the fleet. Hangars and shuttle bays, drydocks for warships, refineries, flak and shields.' },
    { id: 'citadel', name: 'CITADEL', radius: 120, needs: { residents: 150, crates: 1200, morale: 70 },
      about: 'A beacon of managed democracy, with the largest build zone the Ministry grants.' },
  ],
};
