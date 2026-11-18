// Fila de fluxos de pacotes: tempo real ou passo a passo (modo Simulação).
import { bus } from '../core/bus.js';
import { devById } from '../core/store.js';

export const Q = { jobs: [], cur: null, playing: true, waiting: false, simT: 0, speed: 1, once: false, mode: 'rt' };
export const EV = [];
export const FILT = { ARP: 1, DHCP: 1, DNS: 1, ICMP: 1, SIP: 1, RTP: 1, RTSP: 1, RAW: 1 };

/** steps: [{l, from, type}] (pacote num cabo) ou [{ev:[último, em, tipo, ok]}] (evento sem animação). */
export function runJob(steps, done) { Q.jobs.push({ steps, done }); pump(); }

function pump() {
  if (Q.cur || !Q.jobs.length) { bus.queue(); return; }
  Q.cur = { ...Q.jobs.shift(), i: 0 };
  nextStep();
}

export function nextStep() {
  const j = Q.cur; if (!j) return;
  if (j.i >= j.steps.length) {
    Q.cur = null;
    try { j.done && j.done(); } catch (e) { console.error(e); }
    bus.refresh(); pump(); return;
  }
  if (Q.mode === 'sim' && !Q.playing && !Q.once) { Q.waiting = true; bus.queue(); return; }
  Q.once = false; Q.waiting = false;
  const st = j.steps[j.i++];
  if (st.ev) { logEv(st.ev[0], st.ev[1], st.ev[2], st.ev[3] !== false); bus.delay(nextStep, Q.mode === 'rt' ? 60 : 250 / Q.speed); return; }
  const to = st.l.a.d === st.from ? st.l.b.d : st.l.a.d;
  logEv(devById(st.from)?.name, devById(to)?.name, st.type, true);
  bus.animate(st, nextStep);
}

export function logEv(last, at, type, ok) {
  Q.simT += 0.001 + Math.random() * 0.0005;
  EV.push({ t: Q.simT.toFixed(3), last: last || '—', at: at || '—', type, ok });
  if (EV.length > 300) EV.shift();
  bus.events();
}
export function clearEvents() { EV.length = 0; Q.simT = 0; bus.events(); }
export function resetQueue() { Q.jobs = []; Q.cur = null; Q.waiting = false; clearEvents(); bus.queue(); }
export function setMode(m) { Q.mode = m; Q.playing = m === 'rt'; if (m === 'rt' && Q.waiting) nextStep(); bus.queue(); }
export function togglePlay() { if (Q.mode === 'rt') return; Q.playing = !Q.playing; bus.queue(); if (Q.playing && Q.waiting) nextStep(); }
export function stepOnce() { if (Q.mode === 'sim' && Q.waiting) { Q.once = true; nextStep(); } }
export const pending = () => Q.jobs.length + (Q.cur ? 1 : 0);
