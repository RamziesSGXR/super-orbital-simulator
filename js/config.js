// Every tuning number for Super Orbital Simulator lives here. Change them here, never in game logic.
// Money is in credits (CR). Rates are per minute of game time unless the name says otherwise.
export const C = {
  version: '0.1.0',

  // The hull for this test: a side-on cross-section of a derelict destroyer, 32 frames long and 6 decks high.
  // Each row lists the first and last frame (column) inside the hull on that deck. Deck 1 is the top one.
  hull: {
    name: 'Hulk of the SES Patient Fury',
    cols: 32,
    rows: [[8, 21], [5, 25], [3, 28], [3, 28], [5, 25], [8, 21]],
    // The permitted section at the start. The Garrison milestone opens the whole hull.
    permit: { c0: 8, c1: 21 },
    command: { col: 14, row: 2 },
  },

  start: { credits: 1500, tax: 10, budget: { logistics: 24, engineering: 16, security: 16 } },

  // w: width in frames. cost: to build. up: upkeep per minute. pw: power drawn (negative = supplies).
  // build: seconds to build. locked: needs a milestone. exterior: must touch open space.
  mods: {
    corridor:    { name: 'Corridor',        key: '1', w: 1, cost: 10,  up: 0, pw: 0,   build: 2 },
    lift:        { name: 'Lift',            key: '2', w: 1, cost: 40,  up: 2, pw: 1,   build: 4 },
    dock:        { name: 'Docking Bay',     key: '3', w: 2, cost: 120, up: 6, pw: 2,   build: 8, exterior: true },
    cargo:       { name: 'Cargo Hold',      key: '4', w: 2, cost: 80,  up: 3, pw: 1,   build: 6 },
    quarters:    { name: 'Quarters',        key: '5', w: 2, cost: 90,  up: 3, pw: 1,   build: 6, beds: 6 },
    reactor:     { name: 'Reactor',         key: '6', w: 2, cost: 150, up: 8, pw: -14, build: 10 },
    engineering: { name: 'Engineering Bay', key: '7', w: 1, cost: 90,  up: 3, pw: 1,   build: 6, staff: 3 },
    canteen:     { name: 'Canteen',         key: '8', w: 2, cost: 100, up: 6, pw: 2,   build: 8, locked: 'garrison' },
    security:    { name: 'Security Post',   key: '9', w: 1, cost: 90,  up: 2, pw: 1,   build: 6, staff: 3, locked: 'garrison' },
    command:     { name: 'Station Command', key: '',  w: 2, cost: 0,   up: 0, pw: -6,  build: 0, fixed: true, staff: 3 },
  },
  palette: ['corridor', 'lift', 'dock', 'cargo', 'quarters', 'reactor', 'engineering', 'canteen', 'security'],

  demolish: { sec: 4, refund: 0.25 },

  // Divisions: the budget (CR per minute) buys staff at this wage, up to the places their modules have.
  div: {
    logistics:   { name: 'Ministry of Supply',                    short: 'LOGISTICS',   wage: 6, home: 'command',     extra: { cargo: 2 } },
    engineering: { name: 'Department of Patriotic Maintenance',   short: 'ENGINEERING', wage: 8, home: 'engineering' },
    security:    { name: 'Democracy Officers',                    short: 'SECURITY',    wage: 8, home: 'security' },
  },
  budgetMax: 100,

  walk: { speed: 1.8, lift: 1.2, pickSec: 1.0, dropSec: 0.5, repairSec: 5 },

  ships: {
    freighterSec: 30,        // one freighter every this many seconds with one bay; each extra bay adds half as much traffic again
    shuttleSec: 35,          // colonist shuttles while there are empty beds and morale is at least shuttleMorale
    shuttleMorale: 35,
    crates: 6, colonists: 4,
    smugglerChance: 0.18,
    waitSec: 45, queueMax: 3,
    speed: 4,                // cells per second in open space
  },

  econ: {
    crateFee: 15, dockFee: 10, fine: 80,
    taxPerPct: 0.6,          // CR per resident per minute for each percent of tax
  },

  morale: {
    base: 70, taxFree: 10, taxPenalty: 2.5, taxBonus: 1,
    canteen: 15, canteenReach: 12,
    contraband: 10, unrestDecaySec: 60,
    faultyQuarters: 6, power: 25,
    leaveBelow: 30, leaveSec: 10,
  },

  faults: { meanSec: 420 },
  securityReach: 10,          // a security post covers bays within this many cells of walking

  milestones: [
    { id: 'garrison', name: 'GARRISON PERMIT', residents: 12, crates: 30, needs: ['engineering'],
      unlocks: 'The whole hull, the Canteen and the Security Post' },
  ],
};
