# Super Orbital Simulator

Run a space station and the people aboard it. A browser game for the **Super Earth Special Forces** community, in the same look as [Orbital Fury](https://orbitalfury.com/).

> **Prototype 0.11.3: supply and demand.** Freighters come for the trade, not for the berths: how many depends on the station's standing, its reputation and what it is short of. The price of a crate rises and falls with supply against demand. Every berth shows a light: green free, amber in use, red when it cannot take ships.

**Your station. Its people. What happens to them.** It is a space station simulator: think Deep Space Nine in the Helldivers universe, with you as the station's commander. You start with Station Command in empty space, snap parts onto it and set their rooms. Then the people move in, and the station becomes theirs as much as yours.

## ▶ [Play Super Orbital Simulator](https://ramziessgxr.github.io/super-orbital-simulator/)

It runs in your browser on a computer, or on a phone or tablet held sideways. There is nothing to install. Turn the sound on.

**Quick start:** press **NEW STATION**. Open **FIRE** and put a Ship Gun on a side port. Open the **DOCK** group at the bottom left, press `Q` for a Docking Port, move the pointer near Station Command and click when the little dot lights up. Add a Cargo Module from **INDUS** and a Hab Module from **HAB** the same way. Ships and colonists arrive within a minute, and soon after that the first thing lands on your desk.

## What's new in 0.11.3

Asked for: some docking spaces don't work; the more berths you have, the more ships show up; there should be supply and demand.

**Why it happened.** A freighter came every 38 seconds divided by (1 + half the number of berths beyond the first), so nine berths brought one every 7.6 seconds. Ships always took the first free berth in the list, so the newest berths were hardly used. Berths that were shut, broken down or missing their room showed nothing in the world.

- **Freighters come for the trade.** The sector sends a number of crates a minute (the DEMAND), set by the station's tier, its REPUTATION, any Spire or Operations Centre, and supply runs when the stores are short. Traffic Control asks for more or fewer. The number of berths no longer changes it: with 2 berths or 8, the same station sees 34 ships in 20 minutes.
- **Reputation.** Each freighter served on time raises it a little. One kept waiting, turned away or left half unloaded lowers it more. It runs demand from ×0.6 to ×1.4. Too few berths for the trade means lost ships, a falling reputation and less trade: a busy station with one berth fell to 0.24 and lost 5 ships; with four it kept 1.00 and lost none.
- **Price.** A crate's fee is multiplied by the market price, ×0.55 to ×1.6, which answers crates taken in against the demand. Opening the lanes (high traffic) brought 54% more crates but only 26% more money, because each was worth less. Thinning it brought fewer crates worth ×1.43 each.
- **Every berth is used.** A ship goes to the free berth that has stood idle longest.
- **Berth lights.** Green: free. Amber: a ship is at it or coming in. Red, blinking: it cannot take ships. A shut berth also shows a red line along its approach to where it is blocked. The berth's card says why: shut (and by what), broken down, or needs a Shuttle Bay or Workshop fitted inside.
- **The accounts** have a TRADE section: why freighters come, line by line; crates taken in and the market price; berths, how many are busy on average, and how many are more than the trade needs (each still costs upkeep). Hovering SHIPS on the top bar shows it.
- **Asks:** spare berths the trade does not need; freighters waiting and reputation falling; a hangar or drydock with no room fitted.
- New check: `node test/market.mjs [minutes] [seed]`.

Not done yet: there is one market for the whole sector, not one per kind of goods. Shuttles and warships still come on their own timers (shuttles only while there are free beds). Reputation is not saved in 0.11.2 saves; an older save starts at middling reputation.

## What's new in 0.11.2

Four things were asked for.

**1. A breakdown of where the credits and other resources go, on hover, on click and in the Commander's channel.**

- **Hover** any readout on the top bar (capability, credits, power, people, morale, readiness, ships) for where it comes from and where it goes. **Click** it for the full page.
- **ACCOUNTS** is the first page of the Commander's channel. Credits coming in and going out, line by line, with upkeep grouped by kind of part and room, biggest first. The stores: what is in them, what a week uses, how long it lasts and who uses it. Power made and used. People, beds and staff on duty. Morale. Capability.
- It says plainly if the station is gaining or losing, and how many days the credits will last. Parts that stand empty or broken are counted with what they cost.
- A check (`node test/ledger.mjs`) runs a station for twelve minutes and compares the accounts with what the credits actually did: 1.7% apart.

**2. Being asked for what the station needs to grow, so there is no credit spiral for no reason.**

- **ASKED OF YOU** heads the accounts and the overview: what the station needs next, most pressing first, each with who asks and how to do it. It covers losing credits, short power, empty stores, falling morale, a faction with nobody on duty, a shut berth, and every item the next tier still needs.
- An urgent ask is said on the radio once, while there is still time to act, and again only if it is still true days later. One growth ask comes with each weekly report.
- **Before you build:** a part in hand shows NET AFTER, the credits a minute once its upkeep is paid. The build tip warns if it would put the station in the red.

**3. More ways to fix morale, and a way to track it.**

- **Track:** a chart of morale four times a day for two weeks, with the two lines that matter (colonists stop coming, residents leave). What makes it up, line by line. The top bar shows which way it is heading.
- **Ways to raise it:** a list worked out from the station as it stands, each with what it adds and what it costs. Those that are orders have a DO IT button.
- **New ways:** a **rations** order (double rations: morale +6, rations go twice as fast; short rations: half the rations, morale −8), **Liberty Day** (150 CR, morale +12 wearing off over three days, one a week), and the **Recreation Deck** room (+2).
- The colonist tax moved from the menu to the top of ACCOUNTS.

**4. A clean menu, laid out like Orbital Fury's.**

- The menu used to hold the tax slider and a small ledger. Those are gameplay and are now in the Commander's channel. Opening the menu pauses the station.
- **RESUME · SETTINGS · HELP · RADIO LOG · SAVE · TITLE SCREEN**, with FEEDBACK and CREDITS underneath.
- **Settings:** volume, mute, drawing quality, frames a second, people size, port dots, calm display (no blinking), flying speed, zoom speed, and advice on the radio. Remembered between visits. Also reachable from the title screen.
- **Help:** keys, touch, and how the station works. **Radio log:** everything said on comms. **Save:** save now, and a save code you can copy to another device and load there.

Also in this version: flying things see each part's true shape, not a box round it, so a gun barrel or the middle of a ring no longer shuts a berth that is clear.

Not done yet: there is no music, so there is one volume. Settings that Orbital Fury has and this does not: language, interface size, colour-blind colours, rebinding keys. The radio log is this visit only. A save code is long (tens of thousands of characters).

## What's new in 0.11.1

Asked for: ships flying through each other and through the station were distracting.

- **Ships go round the station, not through it.** Ships used to fly a straight line from where they waited to their berth, and a straight line out. Now each one flies round the outside of the station to a point opposite its berth, comes straight in, and leaves the same way. The way in is checked against the hull of every part.
- **They wait further out, each in its own place.** Waiting ships used to sit 44 units from the middle, which is inside a large station. They now wait outside the station however big it is, in eight separate places.
- **They step aside for each other.** Two ships that would pass too close: the later arrival moves over or under and eases back. A ship at a berth, or on its last stretch in, holds its line.
- **They back out.** A ship that docks nose-in used to spin round on the spot as it left, swinging through whatever was beside it. It now backs out until it is clear of the station, then turns. Ships fly level.
- **A berth with no clear way in is shut.** You can still build any shape. If something is built across a berth's approach, ships stop using that berth, Traffic says so once and names what is in the way, and the berth's card shows it. The build tip warns before you click.
- **Raiders circle outside.** They used to weave through the station. They now fly rings just outside it, never crossing each other, and lift over any ship they meet.
- **Eagles, Pelicans and drones** leaving for the ground steer round hulls and ships.
- **A check that flies it.** `node test/traffic.mjs <url>` builds a crowded station and flies it for a set time. Over two 15 minute runs (227 arrivals, 217 departures, 8 raids, 300 sorties, 5 berths pulled out from under a ship on its way in) nothing touched a hull or another ship.

Not done yet: the hull check treats each part as a box, so a ring counts as a solid disc and nothing flies through its middle. A berth can be shut by a part that only just reaches its approach. Ships do not avoid raiders; raiders avoid ships.

## What's new in 0.11

Asked for: fix the hallways (some were missing), add airlock doors for the gaps, and stop things passing through each other, above all at the lifts and stairs.

- **One sill for every port.** Every side port on every part now opens onto a deck exactly 3.6 m below the port's centre. Two parts joined at a port have their floors at the same height, so nobody steps up or down at a join. Most parts had their decks or their ports moved to make this true.
- **Floor everywhere people walk.** Spine parts (Command, Core, Long Spine, Junction, Tower) have a round deck out to the hull on every level, with a gallery round it. Hallway parts have a full deck under their rooms and a short entry from each end port across to the hallway. Ring spokes and the Drum's arms are hallways with their own floor. The Disc and the rings have a deck at the hub.
- **Airlocks.** Every side port has a heavy striped door frame just inside the hull. Where two parts join you walk through two frames. A port with nothing to walk into beyond it has its door shut, with a red bar across it.
- **Lifts are closed tubes.** The open lift frame, the car and the spiral stair are gone. A lift is a dark tube with a door at every stop on every side people come from. People walk to the door and are not drawn while inside, then walk out at their deck. A band of light round the tube shows where the car is.
- **Roof ports get a lift tube.** A part standing on another part's roof port used to be reached through thin air. Now a one-person tube runs from the hallway up through the roof, and the part above has a hatch in its hallway floor.
- **Spine parts join port to port.** A core, ring or tower built on a side port now turns one of its own side ports to face it, so the two airlocks meet. `R` picks which of its ports.
- **Nobody cuts through a room.** Side ports were moved to line up with the gaps between rooms. Hangar and Eagle pads open onto the passage beside them, not across each other. Promenade Disc rooms were made narrower so its eight hallways fit between them. The Reactor's room moved off the line of its ports.
- **A check that walks every route.** `node test/walks.mjs` walks 15,910 routes through 29 kinds of part, a step every 27 cm. It fails if any step in sight has no floor under it, passes through a wall, a fitting or a parked craft, or changes height outside a lift.

Not done yet: lift doors are drawn shut and do not slide. People inside a lift vanish at the door rather than stepping in. Racks and fuel tanks still have no walkway. Saves from 0.10 do not load, because parts changed shape.

## What's new in 0.10

- **Hallways.** Every corridor has a carpet runner in the station's colours. On the side with no rooms it has a waist-high wall with a handrail and a row of lights, and the wall opens wherever another part joins. Ring parts get the same round their walk, with runners along the spokes to the lift. Rooms have a runner down each aisle and across to the door.
- **Elevators.** Every part with a lift shaft and rooms on it has a cab: waist-high steel sides, glass above, a yellow band and a lit ceiling. It carries whoever is riding. With nobody aboard it travels from deck to deck by itself and waits a few seconds at each. The shaft is now a braced tower, and each deck has a lobby mat and two call posts.
- **Follow a person.** Click a person to read their card, then click them again, press `F`, or press **FOLLOW** on the card. The camera comes in close and stays on them: along the hallway, into the elevator, up to the next deck. You can still turn and zoom. Flying the camera with `W A S D`, `Space` or `Shift`, picking something else, or pressing `F` again lets go. If you were looking at the closed hull, following turns INSIDE on so you can see them.

Not done yet: elevator doors do not open and close, nobody takes the stairs, and the cab does not make people wait for it. Dragging to pan while following is pulled back to the person.

## What's new in 0.9

- **INSIDE** (`T`, or the button). Takes the hull away and leaves only its edges, so every deck, room and person can be seen from any side and any distance. Visiting ships keep their hulls.
- **A cutaway that follows the camera** (`G`). It used to cut one fixed wedge out of the station. Now it is a single plane that faces the camera, a little in front of what you are looking at, and it removes everything nearer than that: hull, decks, rooms, fittings and people. Move or turn the camera and the cut moves with it.
- **Flying the camera.**

  | Key | Does |
  | --- | --- |
  | `W` `A` `S` `D` | Fly forward, left, back, right along the deck |
  | `Space` / `Shift` | Up / down |
  | `Q` / `E` | Swing round what you are looking at |
  | Mouse wheel | Zoom toward the pointer, about twice as fast and three times closer than before |

  Speed follows distance: slow when you are close, quick when you are far out.
- **Keys that moved to make room:**

  | Was | Now |
  | --- | --- |
  | `Q W E T Y A S D Z` for parts | `1` to `9` |
  | `1 2 3` for views, `4` cutaway | `V` steps through the views, `G` cutaway, `T` inside |
  | `Space` pause | `P` |
  | `P` port dots | `J` |

## What's new in 0.8

- **Between rooms.** Every room door is a sliding door, drawn open, with lit edges and a hazard stripe. Every port has a hatch: a door frame on the deck just inside the hull, or a ring in the deck for a port above or below.
- **Between floors.** Each lift is an open frame with a car. The car goes to whoever is riding and waits where it last stopped. A spiral stair with a handrail runs round the lift from each deck to the next. (People ride the lift; nobody takes the stairs yet.)
- **People.** Figures are rounded 1.8 m people with heads, hair, hands and shoes, in a standing pose and a walking stride. Residents come in four looks. Each job has its own clothes and kit: a hauler's hi-vis vest, an engineer's hard hat and pack, an officer's peaked cap and cape, a medic's bag, an aide's beret and papers, a scientist's lab coat, a gunner's ear defenders, a SEAF trooper's armour and rifle, a pilot's flight helmet.
- **Surfaces.** Deck plate on floors, panelled walls, wood grain, brushed steel, woven cloth, vented lockers, stencilled crates, turned brass shells and leaves. Each is the same size everywhere: one repeat every 2 m.
- **Minimap hidden.** It is switched off by one constant (`MINIMAP` in `js/main.js`).

## What's new in 0.7

- **A bigger station, smaller people.** One unit is now 9 m, not 5 m, and a person is 1.8 m. Against the old scale people are a little over half the size, so a hab module is 18 m across and one of its rooms is about 10 m square. Ships shrank to match: a Pelican is about 25 m, an Eagle 15 m, a freighter 45 m, a destroyer 115 m.
- **Rooms furnished like real rooms.** Each room is laid out in metres from kits of real things at real sizes, set against the walls with clear aisles between:

  | Room | What is in it |
  | --- | --- |
  | Quarters | Double and single beds with bedside tables and wardrobes, a wet room (shower, toilet, basin), a kitchenette with a fridge and wall cupboards, a dining table, a sofa and screen, a desk, bookshelves, plants |
  | Bunk Room, Barrack Room | Two-tier bunks, lockers, kit racks with helmets and rifles, boot benches, a wet room, a treadmill and resistance frame |
  | Mess Hall | A galley with food printers and a serving counter, long tables with benches, a tea and water point, vending |
  | Observation Lounge | Sofas facing the window, armchairs, a game table, planters |
  | Hydroponics | Four-tier grow racks under lights, soil beds, a water tank and pump, a seedling bench |
  | Workshop | Workbenches with tool boards, a lathe, a printer, parts bins, a welding bay with gas bottles, an EVA suit rack |
  | Cargo Store | Pallet racking, floor stacks, barrels, a loader |
  | Ops Center | Console rows under a wall display, a holo table, server racks |
  | Market, Liberty Lounge | Stalls with awnings, a noodle bar; a bar counter with stools and a lit back shelf, booths, an arcade cabinet, kegs |
  | Medbay | Reception, treatment beds with monitors and curtains, an auto-doc pod, a scanner arch, cabinets |
  | Security, Truth, Brass | A duty desk, holding cells, a monitor wall; a broadcast studio, posters, voting booths; a flag-flanked desk, a conference table, a trophy case |
  | Laboratory | Benches, a glovebox, specimen tanks, a centrifuge, a whiteboard |
  | The platform's rooms | Fire control consoles and a plotting table; shells in racks and cradles under a hoist; rifle racks and armour stands; drones on cradles; bomb racks and trolleys; fabricator cells, hoppers and a conveyor |

- **Nobody is cut in half.** Every room has planned standing spots in front of its fittings and in its aisles. People go from their spot along the aisle, down a clear lane to the door, and out. `npm run rooms` checks every room at every size the station uses: no spot and no route passes through a fitting or a wall.
- **Walls you can see over.** Walls are drawn to waist height with a full-height door frame, so a room reads as a room and you can still see into it.
- **Adjusting.**
  - **Rearrange a room:** while editing a part, pick the room it already is and click it again. The same fittings are laid out another way (six arrangements). It costs nothing.
  - **People size:** MENU has a slider from 60% to 160%. 100% is true to scale.
  - **The scale itself** is two numbers in `js/config.js` (`scale.m`, `scale.person`); rooms are written in metres in `js/rooms.js`, so they follow.
- **You can zoom in much closer** to see it.

## What's new in 0.6

- **The fire support platform.** A new part group, **FIRE SUPPORT**, with one part for every line of the Orbital Fury armory:

  | In Orbital Fury | Build on the station | Opens at |
  | --- | --- | --- |
  | Ship gun | Ship Gun | Outpost |
  | Orbital strikes (up to five) | Orbital Battery | Outpost |
  | UAV scan, strike zone | Drone Bay, Target Relay | Garrison |
  | SEAF drops | SEAF Barracks, Pelican Bay | Garrison, Fortress |
  | Eagles | Eagle Hangar | Fortress |
  | Buildables | Fabrication Shop | Fortress |
  | Classified | Democracy Lance | Citadel |

- **Readiness.** Each system is ready when it is built, working, crewed and has shells. The top bar shows the whole platform as **RDY**, and Gunnery's page in the Commander's channel lists every system with what is holding it back. The next tier needs a readiness figure as well as people and capability.
- **Calls from the ground.** Squads on the planet call for gun fire, strikes, scans, Eagles, troops and crates. A ready system answers by itself: you see the shot go down or the craft leave. A call nobody could answer comes up on comms. You build the platform; you never fire it.
- **Gunnery, the seventh faction.** Gunners, pilots and SEAF troopers draw shells each week, live in Gun Crew Rooms, Barrack Rooms and on the pads, and want a ready platform. Residents do not like sleeping near a magazine.
- **One gravity.** The deck plates make gravity and it points the same way everywhere: toward the keel, where the planet is. So every deck is level however a part is attached. A spine part on a side port stands beside it; a module on a top port sits on it. Guns go on side ports or underneath. Only parts with nothing to stand on (arrays, dishes, turrets, racks) can still be turned any way.
- **Rooms you could walk through.** Every part has a walk: a corridor along a module, a ring corridor with spokes to the hub, the promenade round a disc, a lift up a tower. Rooms have walls and a door onto it. People stand in a room that suits their job, leave by the door, follow the corridor to the next part and go in by its door.
- **One scale** (revised in 0.7). One unit was 5 m. A person is 1.8 m, a bed 2 m, a door 1 m by 2.1 m, a corridor 2 m wide. A Pelican is about 20 m, a freighter 38 m, a corvette 62 m. Hangars and the drydock were enlarged to fit, and hull plating is the same size on every part.
- **Livery.** The **LIVERY** button sets the station's name, six colour schemes or your own three colours, five kinds of hull plating, four interiors, four light colours and an emblem. The name and emblem go on nameplates on the hull.
- **Borrowed from Orbital Fury:** the Pelican, a new Eagle on the hangar pads, SEAF troopers, and the Super Destroyer's look (blue light lines, black drive block) on the visiting warships.

## How to play

- **Three ways to start.**
  - **New station:** Station Command, 2,500 CR and an Outpost permit.
  - **Broken station:** take over a dark, stripped station (about twenty parts, most of them out of order, half the rooms gutted, four people left) and bring it back: every part repaired, the rooms refitted, twenty residents, full power.
  - **Free play:** every part and room, no costs, the biggest build zone, and controls (`K`) to call in freighters, shuttles, warships, colonists and raids. Nothing asks you anything.
  - **Continue** appears on the title once there is a save. The station saves itself every few seconds and when you leave.
- **Build:** parts come in eight groups: Structure, Fire Support, Habitation, Docking, Industry, Power, Defence and Comms. Each button is a picture of the part with its name and cost. Click a group (or `Tab`), pick a part (`1` to `9`), and click near a port: small see-through dots show the free ports near the pointer. `R` turns it 45°. Right-click or `Esc` puts it down.
- **Build inside:** select a part and press **EDIT INSIDE** (`I`). Its hull turns to glass and its rooms show in 3D. Pick a room and click where it goes. A part does what its rooms do.
- **The factions.** Supply, Maintenance, Security, Medical and, from Garrison, Command and Science. Each has an ideal station and a mood from 0 to 100:

  | Faction | People | Wants | Draws each week |
  | --- | --- | --- | --- |
  | Supply | haulers | Cargo Stores close to the docks | coffee |
  | Maintenance | engineers | Workshops near everything that breaks, few open faults | spare parts |
  | Security | Democracy Officers | an office close to every bay, guns on the hull | ammunition |
  | Medical | medics | a Medbay close to the beds | medkits |
  | Command | aides | a Brass Suite close to Station Command, everything working, full stores | fine rations |
  | Science | scientists | Laboratories close to the antennas, domes and blisters | instruments |

  Happy factions work up to 25% faster; unhappy ones up to 25% slower, and they say so. No station suits all six. Nothing ends the game.
- **The station changes itself.** A faction that needs something takes an empty room near the problem and sets it up, flag and all, and tells you afterwards. You hear about it first only when it is not simple.
- **Your desk** (top right) holds what does need you, each with its choices and a clock:
  - a faction wanting spare quarters turned into something of its own;
  - two factions after the same room, where siding with one costs you the other;
  - a weekly allotment the stores cannot cover unless someone else gives something up;
  - a matter of people: a hauler and an Officer at the checkpoint, a still behind the workshop benches, readings the Ministry would rather not see published.
  Leave something unanswered and it settles itself, and nobody is pleased. Painting over a faction's room yourself is allowed, and noted.
- **Supplies, not budgets.** Every crate a hauler carries to a store is one unit of something: coffee, spare parts, ammunition, medkits, fine rations, instruments or rations. Freighters bring more of whatever is short. Each faction draws its **weekly allotment** a day at a time, and the allotment decides how many of its people are on duty. Set it on the faction's page in the Commander's channel (`O`); Supply's page lists the stores. Run out and the faction goes without, and its people will tell you in the corridors.
- **Days and weeks.** A station day is 40 seconds at 1×, a week is seven days. The top bar shows the week and day, and every week the Ministry sends a report. Speed goes to 8×.
- **People.** Everyone has a name and a story that grows: when they came aboard, what they repaired, what you decided about them. With the hull cut away (Cutaway, or Edit Inside) they are small figures you can tell apart by job, and now and then one of them says something. In Life Signs they glow through the walls. Click one, or a name in a faction's crew list, to see who they are.
- **Capability** (the big number, top left) is the score: crates, ships served, residents, defence, warships repaired, staff on duty, research and raids driven off, scaled by how happy the factions are. It opens the upgrade path.
- **Raids.** From Garrison on, raiders come now and then. You get a warning, then defence (turrets, shields, fighter bays, half a point per Officer) is set against their strength. Short by four and they break a part; hold them off and Security is very pleased with itself.
- **The upgrade path** (`U`, or click the week at the top): Outpost, Garrison, Fortress, Citadel.

  | Tier | Build zone | Needs | Unlocks |
  | --- | --- | --- | --- |
  | Outpost | 16 | | the basics |
  | Garrison | 40 | 12 residents, 80 capability, 20 power | Command and Science, the Long Spine, rings, drums, discs, towers, pylons, the Docking Ring, fuel tanks, radiators, dishes, propaganda screens and flak turrets; bunk rooms, markets, bars, medbays, security and truth offices, brass suites and laboratories |
  | Fortress | 70 | 60 residents, 300 capability, 60 power, a Security Office and a Medbay | hangars, drydocks, refineries, shields, shuttle and fighter bays |
  | Citadel | 120 | 150 residents, 1,000 capability, morale 70 | the biggest zone the Ministry grants |
- **Look around:** drag to orbit, right-drag to pan, scroll or pinch to zoom. Click the minimap to look somewhere. `H` hides the whole interface; **PHOTO** saves the view as a picture; tap the station to bring the buttons back.
- **Views** (bottom right, or `1`-`4`): **Blueprint** (a technical drawing in 3D), **Hull** (the station under its sun, over a planet that is different every game; this is where you start), **Life Signs** (an x-ray) and **Cutaway** (the quarter facing you sliced away, with any view).
- **Ships:** freighters bring crates, Pelicans bring colonists, damaged warships come to the drydock.
- **Credits** pay for building and nothing else: every crate and every docking earns a little, and residents pay tax (set it in **MENU**).

**Layout matters.** Haulers walk through the station, so a docking port far from the cargo means slow unloading, thin stores, ships giving up and an unhappy Supply. `npm run sim` and `npm run sim:far` run the same station with the port beside the cargo and at the far end of a truss. `npm run story` plays sixteen minutes and prints everything that reached the commander.

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

**Rooms:** Quarters, Bunk Room, Mess Hall, Observation Lounge, Hydroponics, Workshop, Cargo Store, Ops Center, Market, Liberty Lounge, Medbay, Security Office, Truth Office, Brass Suite, Laboratory, Shuttle Bay and Fighter Bay.

Any part can go on any free port. Parts may overlap and nest on purpose, so a ring can sit inside a ring.

## How it's built

Plain JavaScript modules, no framework and no build step. The 3D is three.js, vendored as one minified file in `js/vendor/`. Every part, room, ship, suit and planet is built in code from simple shapes and noise: there are no model, image or sound files. The look (palette, type, cut-corner plates and strips) and the way planets are painted are carried over from Orbital Fury.

```
index.html          the page, the title card and the menu
css/style.css       the Orbital Fury theme plus the Age of Empires-style HUD
js/config.js        every tuning number: parts, rooms, divisions, orders and tiers
js/math3.js         small vector and quaternion helpers for the simulation
js/market.js        the market: why freighters come, reputation, the price of a crate, which berth a ship takes
js/ledger.js        the accounts and the asks: where everything comes from and goes, and what the station needs next
js/story.js         the story layer: days and weeks, supplies, what reaches the commander, raids, the Broken Station, saving
js/sim.js           the simulation: parts and rooms, walking, staff, ships, faults, economy, morale, tiers (no DOM, no 3D)
js/parts.js         every part, room, ship and suit, drawn in code, plus the grid icons
js/planets.js       planets and moons, painted with noise the way Orbital Fury paints Mars
js/noise.js         value noise, from Orbital Fury
js/view.js          the 3D view: blueprint space, the four views, rooms, EVA, the sky, picking
js/audio.js         synthesised sound
js/main.js          the loop, input, HUD, comms, the Commander's channel, the upgrade path and the minimap
js/vendor/three.js  three.js (MIT), see js/vendor/THREE-LICENSE
test/headless.mjs   runs a station without a browser and prints the economy, capability and faction moods (add `approve` as a fifth argument to say yes to every request)
test/story.mjs      plays the story with no browser: supplies, requests, a raid, a save and the Broken Station
test/market.mjs     freighters come for the trade, not the berths; the price answers supply against demand
test/ledger.mjs     the accounts add up to what the credits really do; every way to raise morale does what it says
test/traffic.mjs    flies a crowded station in the real page: no ship, raider or craft may touch a hull or each other
test/walks.mjs      walks every route through every kind of part: floor under every step, nothing in the way
test/ui.mjs         plays it through the real page on a desktop and a phone held sideways
test/fit.mjs        opens the interface at seven screen sizes and reports anything cut off, spilling out of its box or overlapping
tools/vendor.mjs    rebuilds js/vendor/three.js
tools/bundle.mjs    builds dist/super-orbital-simulator.html, the whole game in one file
```

**Running your own copy.** Serve this folder with any local web server (`npm start`, then open <http://localhost:8080>). Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

Tests: `npm run sim` needs only Node. For the browser test, `npm install`, `npm start` in one terminal and `npm run ui` in another. `?seed=N` fixes the random seed (and so the planet), and `?economy` or `?free` skips the title.

Prototype 0.1, the flat cross-section version, is the first commit in the history; 0.2 was the first 3D version. The interface follows Orbital Fury 0.60 and FOB Super Commander.

## Give feedback

This is an early prototype, and feedback is how it gets better. Join the **[SESF Helldivers Discord](https://discord.com/invite/qruRY4nkEz)** and tell us what you played on, what you built, what was fun, and what was confusing or broken. Screenshots of your stations are very welcome (`H` hides the interface).

## Credits and disclaimer

- **Created and vibe coded by** Robert Troumbley (RamziesSGXR), head admin of the Super Earth Special Forces (SESF) community.
- **Art is drawn in code** and **sound is synthesised** in the browser. There are no image, model or sound files in the game.
- **three.js** (MIT License, three.js authors) draws the 3D. See `js/vendor/THREE-LICENSE`.
- **Inspired by** Helldivers 2 (Arrowhead Game Studios, published by Sony Interactive Entertainment).
- **Unofficial fan project.** Not affiliated with, endorsed by or sponsored by Arrowhead Game Studios or Sony Interactive Entertainment. Helldivers, Super Earth, Super Destroyer, SEAF and the other names, phrases, factions and settings from the Helldivers games belong to their owners and are used only to refer to them. Free, no ads, collects nothing, provided as is with no warranty.
- **Build and test tools** (not part of the game): esbuild (MIT) and Playwright (Apache 2.0).
