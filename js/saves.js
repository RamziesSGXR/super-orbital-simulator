// SAVES, the same way Orbital Fury keeps them (its js/session.js): three save slots on this browser, and save codes that carry a
// station anywhere as text.
//
// A slot holds { at (when saved), sum (a line to recognise it by), data (Station.save()) }. A station saved to a slot remembers it
// (st.slot, 1-3) and saves itself there again whenever it saves (main.js writeSave), so a slot is never more than a little behind.
//
// A save code is "SOS<z>-<data>-<check>", as Orbital Fury's "OFS<z>-…": z is 1 when the data is deflated (CompressionStream), 0
// when not; the data is the station's JSON in base64url; the check is four characters of a hash of the data, so a code cut short
// or mistyped is caught. It is not a lock: a code can be edited, as the browser's storage can. Codes from 0.11.2 ("SOS1:…") still
// load.
import { C } from './config.js';

const SLOTS_KEY = 'sos.slots';
export const SLOTS = 3;
const load = () => { try { const a = JSON.parse(localStorage.getItem(SLOTS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const keep = (a) => { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(a)); return true; } catch (e) { return false; /* storage full or off */ } };

// One line to know a station by: its name, its standing, how far in, how big.
export function summary(st) {
  return { name: (st.livery && st.livery.name) || 'Orbital Station', mode: st.mode, tier: C.tiers[st.tier] ? C.tiers[st.tier].name : '', week: st.week(), day: st.dow(),
    parts: st.parts.size, residents: st.residents(), credits: Math.round(st.credits), cap: st.capability(), v: C.version };
}
export function getSlots() { const a = load(); return Array.from({ length: SLOTS }, (_, i) => (a[i] && a[i].data ? a[i] : null)); }
export function putSlot(n, st, at = Date.now()) {
  if (!(n >= 1 && n <= SLOTS)) return false;
  const a = getSlots(); st.slot = n; a[n - 1] = { at, sum: summary(st), data: st.save() };
  return keep(a);
}
export function clearSlot(n) { const a = getSlots(); if (n >= 1 && n <= SLOTS) { a[n - 1] = null; keep(a); } }

const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export const codeSum = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return (h % 1679616).toString(36).padStart(4, '0').toUpperCase(); };
const pipe = async (u8, T) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer());

export async function toCode(data) {
  const d0 = { ...data }; delete d0.slot;
  let u8 = new TextEncoder().encode(JSON.stringify(d0)), z = 0;
  if (typeof CompressionStream === 'function') { try { u8 = await pipe(u8, CompressionStream); z = 1; } catch (e) { /* sent as it is */ } }
  const d = b64u(u8);
  return `SOS${z}-${d}-${codeSum(d)}`;
}
// { data } from a code, or { err: 'empty' | 'bad' | 'zip' }. Whether the data is a station of this version is Station.load's to say.
export async function fromCode(code) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!c) return { err: 'empty' };
  const old = /^SOS1:([A-Za-z0-9+/=]+)$/.exec(c);
  if (old) { try { return { data: JSON.parse(decodeURIComponent(escape(atob(old[1])))) }; } catch (e) { return { err: 'bad' }; } }
  const m = /^SOS([01])-([A-Za-z0-9_-]+)-([0-9A-Za-z]{4})$/.exec(c);
  if (!m || codeSum(m[2]) !== m[3].toUpperCase()) return { err: 'bad' };
  let u8;
  try { u8 = unb64u(m[2]); } catch (e) { return { err: 'bad' }; }
  if (m[1] === '1') {
    if (typeof DecompressionStream !== 'function') return { err: 'zip' };
    try { u8 = await pipe(u8, DecompressionStream); } catch (e) { return { err: 'bad' }; }
  }
  try { const data = JSON.parse(new TextDecoder().decode(u8)); return data && typeof data === 'object' ? { data } : { err: 'bad' }; } catch (e) { return { err: 'bad' }; }
}
