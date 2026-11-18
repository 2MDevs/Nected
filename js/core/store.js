// Estado do laboratório + histórico (desfazer/refazer). Sem DOM.
import { TYPES, portsOf } from './catalog.js';

export const store = { S: null };

export function blank(name = 'Meu laboratório') {
  return { v: 2, id: 'lab' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name,
    devs: [], links: [], cables: [], seq: 1, leaseMem: {}, missions: {}, cnt: {} };
}

// Garante campos de versões antigas (protótipo v1).
export function normalize(o) {
  const S = Object.assign(blank(o.name), o);
  if (!S.id) S.id = blank().id;
  for (const d of S.devs) {
    const def = TYPES[d.type]?.cfg(0) || {};
    for (const k of Object.keys(def)) if (d.cfg[k] === undefined) d.cfg[k] = def[k];
    if (d.cfg.on === undefined) d.cfg.on = true;
  }
  S.v = 2;
  return S;
}

export const uid = p => p + (store.S.seq++);
export const devById = id => store.S.devs.find(d => d.id === id);

export function addDev(type, x, y, over) {
  const S = store.S, T = TYPES[type];
  S.cnt[type] = (S.cnt[type] || 0) + 1;
  const n = S.cnt[type];
  const d = { id: uid('d'), type, name: `${T.short} ${n}`, x: Math.round(x), y: Math.round(y), cfg: { on: true, ...T.cfg(n - 1) } };
  if (over) { if (over.name) d.name = over.name; Object.assign(d.cfg, over.cfg || {}); }
  S.devs.push(d);
  return d;
}

export function removeDev(id) {
  const S = store.S;
  S.links = S.links.filter(l => l.a.d !== id && l.b.d !== id);
  S.devs = S.devs.filter(x => x.id !== id);
  for (const k of Object.keys(S.leaseMem)) {
    if (k.startsWith(id + '|')) delete S.leaseMem[k];
    else for (const c of Object.keys(S.leaseMem[k])) if (c.startsWith(id + '|')) delete S.leaseMem[k][c];
  }
}

export const linkAt = (id, pi) => store.S.links.find(l => (l.a.d === id && l.a.p === pi) || (l.b.d === id && l.b.p === pi));
export const other = (l, id) => (l.a.d === id ? l.b : l.a);
export const freePorts = d => portsOf(d).map((p, i) => ({ ...p, i })).filter(p => !linkAt(d.id, p.i));

const DEFAULT_CABLE = { eth: 'factory', coax: 'coax', rj11: 'rj11', hdmi: 'hdmi' };
export function addLink(a, pa, b, pb, cable) {
  const A = devById(a), B = devById(b);
  const ka = portsOf(A)[pa]?.k, kb = portsOf(B)[pb]?.k;
  if (!ka || ka !== kb) throw new Error('Portas incompatíveis');
  if (linkAt(a, pa) || linkAt(b, pb)) throw new Error('Porta já ocupada');
  const l = { id: uid('l'), a: { d: a, p: pa }, b: { d: b, p: pb }, kind: ka, cable: cable || DEFAULT_CABLE[ka] };
  store.S.links.push(l);
  return l;
}
export const removeLink = id => { store.S.links = store.S.links.filter(l => l.id !== id); };

export const CABLE_NAMES = { factory: 'Patch cord de fábrica (T568B)', coax: 'Coaxial RG59 + BNC', rj11: 'Cabo telefônico RJ11', hdmi: 'Cabo HDMI' };
export function cableOf(l) {
  if (l.kind !== 'eth' || !String(l.cable).startsWith('c'))
    return { name: CABLE_NAMES[l.cable] || l.cable, status: 'ok', type: 'direto' };
  const c = store.S.cables.find(x => x.id === l.cable);
  if (!c) return { name: 'Cabo removido', status: 'bad', type: 'defeituoso' };
  return { name: c.name, status: c.res.type === 'defeituoso' ? 'bad' : c.res.type === 'split' ? 'split' : 'ok', type: c.res.type, c };
}
export const cableInUse = cid => store.S.links.some(l => l.cable === cid);

export function linkStatus(l) {
  const A = devById(l.a.d), B = devById(l.b.d);
  if (!A || !B) return 'bad';
  if (!A.cfg.on || !B.cfg.on) return 'off';
  const c = cableOf(l);
  if (c.status === 'bad') return 'bad';
  return c.status === 'split' ? 'degraded' : 'up';
}

export function portGroup(d, pi) {
  if (d.type === 'switch') return 'v' + (d.cfg.vlans[pi] || 1);
  return portsOf(d)[pi].g;
}

/* ---------- histórico ---------- */
const H = { undo: [], redo: [], last: null };
const snap = () => { const { missions, ...r } = store.S; return JSON.stringify(r); };
function restore(json) { const m = store.S.missions; store.S = normalize(JSON.parse(json)); store.S.missions = m; }
// Chame depois de cada alteração: se o estado mudou, empilha a versão anterior.
export function track() {
  const cur = snap();
  if (H.last !== null && cur !== H.last) { H.undo.push(H.last); if (H.undo.length > 100) H.undo.shift(); H.redo = []; }
  H.last = cur;
}
export function resetHistory() { H.undo = []; H.redo = []; H.last = snap(); }
export function undo() { if (!H.undo.length) return false; H.redo.push(H.last); H.last = H.undo.pop(); restore(H.last); return true; }
export function redo() { if (!H.redo.length) return false; H.undo.push(H.last); H.last = H.redo.pop(); restore(H.last); return true; }
export const canUndo = () => H.undo.length > 0;
export const canRedo = () => H.redo.length > 0;
