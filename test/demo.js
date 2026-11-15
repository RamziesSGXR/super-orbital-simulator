// Shared by the screenshot checks: builds a station with a platform into the running game (window.__st).
window.__demo = () => {
  const s = window.__st, b = (t, h, p, r = 0) => { const x = s.build(t, h, p, r); if (!x.ok) console.error('build', t, x.why); return x.id; };
  const c1 = b('core', 1, 1), re = b('reactor', c1, 1); b('spire', re, 1);
  b('hab', 1, 2); b('cargo', 1, 3); b('dockport', 1, 4); const bk = b('barracks', 1, 5);
  const low = b('core', 1, 0); const g = b('gunmount', low, 0); const bt = b('battery', low, 2); b('battery', low, 4); b('dronebay', low, 3);
  const eh = b('eaglehangar', c1, 2); const hg = b('hangar', c1, 4); b('pelicanbay', c1, 3); b('fabshop', c1, 5);
  const ring = b('ring', re, 2);
  for (let i = 0; i < 60 * 30; i++) s.step(1 / 30);
  s.setRoom(ring, 0, 'medbay'); s.setRoom(ring, 1, 'bar'); s.setRoom(ring, 2, 'mess'); s.setRoom(ring, 3, 'secoffice'); s.setRoom(ring, 4, 'lab'); s.setRoom(ring, 5, 'market'); s.setRoom(ring, 6, 'bunks'); s.setRoom(ring, 7, 'brass');
  s.setRoom(c1, 0, 'ops'); s.setRoom(c1, 1, 'workshop'); s.setRoom(low, 0, 'guncrew'); s.setRoom(low, 1, 'truth');
  s.addColonists(24);
  for (let i = 0; i < 60 * 30; i++) s.step(1 / 30);
  return { c1, low, g, bt, eh, hg, bk, ring };
};
