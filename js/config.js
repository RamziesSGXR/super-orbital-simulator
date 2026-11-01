// Every tuning number for Super Orbital Simulator lives here. Change them here, never in game logic.
// Distances are in station units (about 10 m). Money is in credits (CR); rates are per minute of game time.
//
// Parts snap together at PORTS. A port is [x, y, z, dx, dy, dz, kind] in the part's own frame: where it is and which way it faces.
// Port 0 is the part's BASE: the port it attaches with. Spine parts ('S' base) stack along their own axis (local Y);
// arm parts ('L' base) stick out along their local +X. Any part can go on any free port: the kit is meant to be free.
const ring4 = (r, y = 0, a0 = 0) => [0, 1, 2, 3].map((i) => { const a = a0 + i * Math.PI / 2; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });
const ring6 = (r, y = 0) => [0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return [Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 'L']; });

export const C = {
  version: '0.2.0',

  parts: {
    command:  { name: 'Station Command', short: 'CMD', cat: 'spine', cost: 0, up: 0, pw: -6, build: 0, fixed: true, haulers: 3,
      about: 'The heart of the station. Everything connects back to it.', center: [0, 0, 0], r: 2,
      ports: [[0, -1.7, 0, 0, -1, 0, 'S'], [0, 1.7, 0, 0, 1, 0, 'S'], ...ring4(1.2, -0.5)] },
    core:     { name: 'Core Segment', short: 'CORE', cat: 'spine', key: 'q', cost: 60, up: 1, pw: 1, build: 3,
      about: 'A section of spine. Stack them up or down, and hang arms off its sides.', center: [0, 0, 0], r: 1.6,
      ports: [[0, -1.5, 0, 0, -1, 0, 'S'], [0, 1.5, 0, 0, 1, 0, 'S'], ...ring4(1.2)] },
    reactor:  { name: 'Reactor Core', short: 'REACT', cat: 'spine', key: 'w', cost: 160, up: 6, pw: -16, build: 6,
      about: 'Supplies 16 power. Goes in the spine.', center: [0, 0, 0], r: 2.4,
      ports: [[0, -1.75, 0, 0, -1, 0, 'S'], [0, 1.75, 0, 0, 1, 0, 'S'], ...ring4(2.2)] },
    spire:    { name: 'Comms Spire', short: 'SPIRE', cat: 'spine', key: 'e', cost: 50, up: 1, pw: 1, build: 3, traffic: 0.2,
      about: 'Caps the spine. Each spire brings ships 20% more often (up to 2).', center: [0, 0, 0], r: 2.5,
      ports: [[0, -2, 0, 0, -1, 0, 'S']] },
    ring:     { name: 'Habitat Ring', short: 'RING', cat: 'hab', key: 'r', cost: 420, up: 8, pw: 4, build: 10, beds: 24, locked: 'garrison',
      about: 'A torus on four spokes: beds for 24. Its rim takes docking ports and pylons.', center: [0, 0, 0], r: 8,
      ports: [[0, -0.7, 0, 0, -1, 0, 'S'], [0, 0.7, 0, 0, 1, 0, 'S'], ...ring4(7.95, 0, Math.PI / 4)] },
    bigring:  { name: 'Docking Ring', short: 'DRING', cat: 'hab', key: 'i', cost: 380, up: 6, pw: 3, build: 10, beds: 12, haulers: 2, locked: 'garrison',
      about: 'A wide, thin outer ring on six spokes: quarters for 12 and a walkway for 2 more haulers. Hang docks off its rim.', center: [0, 0, 0], r: 12.5,
      ports: [[0, -0.6, 0, 0, -1, 0, 'S'], [0, 0.6, 0, 0, 1, 0, 'S'], ...ring6(12.7)] },
    disc:     { name: 'Promenade Disc', short: 'PROM', cat: 'hab', key: 't', cost: 300, up: 6, pw: 3, build: 8, promenade: 8, locked: 'garrison',
      about: 'Shops and a canteen round the spine: +8 morale each (up to 2).', center: [0, 0, 0], r: 5.6,
      ports: [[0, -0.8, 0, 0, -1, 0, 'S'], [0, 0.8, 0, 0, 1, 0, 'S'], ...ring6(5.6)] },
    drum:     { name: 'Habitat Drum', short: 'DRUM', cat: 'hab', key: 'y', cost: 340, up: 6, pw: 3, build: 8, beds: 16, locked: 'garrison',
      about: 'A deep drum round the spine: beds for 16.', center: [0, 0, 0], r: 4.8,
      ports: [[0, -1.3, 0, 0, -1, 0, 'S'], [0, 1.3, 0, 0, 1, 0, 'S'], ...ring4(4.7)] },
    dome:     { name: 'Arboretum Dome', short: 'DOME', cat: 'hab', key: 'u', cost: 120, up: 2, pw: 1, build: 5, garden: 5,
      about: 'Trees under glass: +5 morale each (up to 2). Caps a spine or an arm.', center: [0, 0.8, 0], r: 2.3,
      ports: [[0, -0.2, 0, 0, -1, 0, 'S']] },
    dockport: { name: 'Docking Port', short: 'DOCK', cat: 'dock', key: 'a', cost: 100, up: 3, pw: 2, build: 4, berth: [2.7, 0, 0, 1, 0, 0], crates: 6,
      about: 'A berth for one ship: freighters (6 crates) and colonist shuttles.', center: [1.1, 0, 0], r: 1.6,
      ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    pylon:    { name: 'Docking Pylon', short: 'PYLON', cat: 'dock', key: 's', cost: 150, up: 4, pw: 2, build: 6, berth: [5, 4.9, 0, 0, 1, 0], crates: 8, locked: 'garrison',
      about: 'A tall arm with a berth at its tip for heavy freighters (8 crates).', center: [2.5, 0, 0], r: 4,
      ports: [[0, 0, 0, -1, 0, 0, 'L']] },
    truss:    { name: 'Truss', short: 'TRUSS', cat: 'arm', key: 'd', cost: 25, up: 0, pw: 0, build: 2,
      about: 'A lattice beam with a crawlway. Cheap reach for solar arrays and modules.', center: [2.5, 0, 0], r: 2.6,
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [5, 0, 0, 1, 0, 0, 'L'], [2.5, 0, 0.5, 0, 0, 1, 'L'], [2.5, 0, -0.5, 0, 0, -1, 'L']] },
    node:     { name: 'Node', short: 'NODE', cat: 'arm', key: 'f', cost: 50, up: 1, pw: 0, build: 3,
      about: 'A docking adapter with five more ports, for branching arms.', center: [0.9, 0, 0], r: 1,
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [1.8, 0, 0, 1, 0, 0, 'L'], [0.9, 0.9, 0, 0, 1, 0, 'L'], [0.9, -0.9, 0, 0, -1, 0, 'L'], [0.9, 0, 0.9, 0, 0, 1, 'L'], [0.9, 0, -0.9, 0, 0, -1, 'L']] },
    cargo:    { name: 'Cargo Module', short: 'CARGO', cat: 'arm', key: 'g', cost: 90, up: 2, pw: 1, build: 4, cargo: true, haulers: 2,
      about: 'Haulers carry crates here: +15 CR each. Brings 2 more haulers.', center: [2.4, 0, 0], r: 2.6,
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [4.8, 0, 0, 1, 0, 0, 'L'], [2.4, 0, 1, 0, 0, 1, 'L'], [2.4, 0, -1, 0, 0, -1, 'L']] },
    hab:      { name: 'Hab Module', short: 'HAB', cat: 'arm', key: 'h', cost: 90, up: 2, pw: 1, build: 4, beds: 6,
      about: 'A pressurised module with bunks for 6.', center: [2.4, 0, 0], r: 2.6,
      ports: [[0, 0, 0, -1, 0, 0, 'L'], [4.8, 0, 0, 1, 0, 0, 'L'], [2.4, 0, 1, 0, 0, 1, 'L'], [2.4, 0, -1, 0, 0, -1, 'L']] },
    solar:    { name: 'Solar Array', short: 'SOLAR', cat: 'arm', key: 'j', cost: 70, up: 1, pw: -6, build: 3,
      about: 'Two wings of cells: supplies 6 power. R turns the wings.', center: [0.6, 0, 0], r: 6,
      ports: [[0, 0, 0, -1, 0, 0, 'L']] },
  },
  // The command grid, in the order it is drawn (5 across, 3 down).
  grid: ['core', 'reactor', 'spire', 'ring', 'bigring', 'disc', 'drum', 'dome', 'dockport', 'pylon', 'truss', 'node', 'cargo', 'hab', 'solar'],

  start: { credits: 2000, tax: 10, radius: 16 },
  sandbox: { credits: 999999, radius: 60 },
  demolish: { sec: 3, refund: 0.5 },

  walk: { speed: 2.4, pickSec: 1.0, dropSec: 0.5 },
  ships: { freighterSec: 26, shuttleSec: 30, shuttleMorale: 35, colonists: 4, approachSec: 7, departSec: 6, waitSec: 40, queueMax: 3 },
  econ: { crateFee: 15, dockFee: 10, taxPerPct: 0.6 },
  morale: { base: 70, taxFree: 10, taxPenalty: 2.5, taxBonus: 1, power: 25, leaveBelow: 30, leaveSec: 10, promenadeMax: 2, gardenMax: 2 },

  milestones: [
    { id: 'garrison', name: 'GARRISON PERMIT', residents: 12, crates: 30, power: 20, radius: 40,
      unlocks: 'A bigger build zone, rings, promenades, drums and pylons' },
  ],
};
