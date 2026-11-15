// The fire support platform: the part of the station that does the job the gunner calls on in Orbital Fury.
// You build it; you never fire it. Each SYSTEM (ship gun, orbital strikes, UAV, Eagles, SEAF, buildables, Classified) has a
// readiness figure made by the station's people: is it built, is it working, is it crewed, has it got shells.
// Calls come up from the war below. A ready system answers them and nobody tells you. One it cannot answer is news.
import { C } from './config.js';

export function installPlatform(Station) {
  Object.assign(Station.prototype, {
    sysOpen(k) { return this.sandbox || Object.values(C.parts).some((d) => d.sys === k && (d.tier ?? 0) <= this.tier); },
    // Every system: how many parts it has, how ready it is (0 to 1) and, when it is not, the first reason why.
    platform() {
      const P = C.platform, sys = [], by = {};
      const crew = this.homes.gunner ? Math.min(1, this.staff.gunner / this.homes.gunner) : 0;
      let score = 0, got = 0, want = 0;
      for (const k of P.order) {
        const S = P.sys[k], parts = [...this.parts.values()].filter((p) => this.def(p).sys === k && p.state === 'active');
        const open = this.sysOpen(k), n = Math.min(S.max, parts.length);
        let ready = 0, why = open ? 'Not built' : 'Not yet permitted';
        if (parts.length) {
          const ok = parts.filter((p) => !p.fault).length / parts.length;
          ready = ok * crew; why = '';
          if (ok < 1) why = `${parts.length - Math.round(ok * parts.length)} of ${parts.length} in repair`;
          if (crew < 1 && !why) why = !this.homes.gunner ? 'No crew room' : this.staff.gunner ? 'Short of crew: raise Gunnery\'s allotment' : 'No crew on duty';
          if (S.shells && !this.magN) { ready *= 0.5; why = why || 'No magazine'; }
          if (S.shells && this.short.gunnery) { ready *= P.shortReady; why = why || 'Out of shells'; }
          if (k === 'seaf' && this.short.medical) { ready *= 0.7; why = why || 'No medkits for the troopers'; }
          score += S.w * ready * (0.5 + 0.5 * n / S.max);
        }
        if (open) { want += S.w; got += S.w * ready; }
        const s = { k, name: S.name, n, max: S.max, ready, why, open };
        sys.push(s); by[k] = s;
      }
      return { sys, by, score, ready: want ? got / want : 0 };
    },
    _gunneryTarget() {
      if (!this.platformN) return { t: 25, why: 'The station has no gun on it. It is here to support the troops below.' };
      const P = this.platform(), log = this.callLog || [], miss = log.length ? log.filter((x) => !x).length / log.length : 0;
      const worst = P.sys.filter((s) => s.open && s.n && s.why).sort((a, b) => a.ready - b.ready)[0], gap = P.sys.find((s) => s.open && !s.n);
      const why = worst ? `${worst.name}: ${worst.why.toLowerCase()}.` : gap ? `The Ministry expects ${gap.name.toLowerCase()} and there is nothing built for it.` : miss > 0.3 ? 'Too many calls from the ground go unanswered.' : 'The platform is answering its calls.';
      return { t: Math.max(5, Math.min(100, 30 + 65 * P.ready - miss * 20)), why };
    },
    // The war below: every so often a squad calls for something. Only systems the Ministry expects of this station are asked for.
    _platform(dt) {
      const P = C.platform;
      if (this.timers.call === undefined) { this.timers.call = P.firstSec; this.callLog = []; this.missSaid = -999; }
      if (!this.platformN) return;
      if ((this.timers.call -= dt) > 0) return;
      this.timers.call = this.rng.range(P.callSec[0], P.callSec[1]);
      const open = P.order.filter((k) => this.sysOpen(k)), total = open.reduce((s, k) => s + P.sys[k].weight, 0);
      let r = this.rng.next() * total, k = open[0];
      for (const x of open) { k = x; if ((r -= P.sys[x].weight) <= 0) break; }
      const S = P.sys[k], s = this.platform().by[k], squad = this.rng.pick(P.squads);
      const parts = [...this.parts.values()].filter((p) => this.def(p).sys === k && this.works(p));
      if (parts.length && this.rng.next() < s.ready && this.take('shells', S.shells)) {
        const p = this.rng.pick(parts);
        this.stats.calls = (this.stats.calls || 0) + 1; this.callLog.push(1);
        this.events.push({ type: 'fire', sys: k, part: p.id, squad });
        if (this.rng.chance(0.3)) { const a = this.agents.find((x) => x.role === 'gunner' && x.home === p.id) || this.someone('gunner'); if (a) this.note(a, `Answered the ${squad}' call for ${S.call}.`); }
      } else {
        this.stats.missed = (this.stats.missed || 0) + 1; this.callLog.push(0);
        this._favor('gunnery', -1);
        // News, not nagging: a system that is not built is mentioned once a week; one that failed, at most every so often.
        this.noSys ||= {};
        const quiet = !parts.length && !s.n ? this.t - (this.noSys[k] ?? -9999) < C.time.daySec * C.time.week : this.t - this.missSaid < P.missSayGap;
        if (!this.sandbox && !quiet) {
          if (!parts.length && !s.n) this.noSys[k] = this.t; else this.missSaid = this.t;
          const why = !parts.length ? (s.n ? 'it is in repair' : `the station has no ${S.name.toLowerCase()}`) : s.why ? s.why.toLowerCase() : 'the crew were not ready in time';
          this.say('gunnery', `The ${squad} called for ${S.call}. We could not answer: ${why}.`, { warn: true });
        }
      }
      if (this.callLog.length > 12) this.callLog.shift();
    },
  });
}
