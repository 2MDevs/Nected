// Editor visual: aparelhos, cabos pulsando, pan/zoom, dock de arrastar e soltar e animação de pacotes.
import { TYPES, CATS } from '../core/catalog.js';
import { maskBits, hash } from '../core/ip.js';
import { store, devById, addDev, linkAt } from '../core/store.js';
import { RT, ifsOf, ifaceOf, regStatus } from '../core/network.js';
import { Q } from '../sim/queue.js';
import { $, $$, ico, ENV, PKT_COLOR } from './dom.js';
import { ui } from './uistate.js';

const V = ui.view;
let cb = { onNodeClick() {}, onLinkClick() {}, onBackground() {}, onMoved() {}, onAdd() {} };

/* ---------- geometria ---------- */
const center = d => ({ x: d.x + 28, y: d.y + 28 });
export function geomPts(l) {
  const A = devById(l.a.d), B = devById(l.b.d), a = center(A), b = center(B), dx = b.x - a.x, dy = b.y - a.y;
  const dup = store.S.links.filter(x => (x.a.d === l.a.d && x.b.d === l.b.d) || (x.a.d === l.b.d && x.b.d === l.a.d));
  const k = dup.length > 1 ? (dup.indexOf(l) - (dup.length - 1) / 2) * 26 : 0;
  if (Math.abs(dx) > Math.abs(dy)) return [a, { x: a.x + dx / 2, y: a.y + k }, { x: b.x - dx / 2, y: b.y + k }, b];
  return [a, { x: a.x + k, y: a.y + dy / 2 }, { x: b.x + k, y: b.y - dy / 2 }, b];
}
export function bez(g, t) {
  const u = 1 - t, [p0, p1, p2, p3] = g;
  return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
           y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
}
function dotAt(g, fromEnd) {
  const c = fromEnd ? g[3] : g[0];
  for (let i = 1; i <= 50; i++) { const p = bez(g, fromEnd ? 1 - i / 100 : i / 100); if (Math.hypot(p.x - c.x, p.y - c.y) > 36) return p; }
  return bez(g, fromEnd ? 0.6 : 0.4);
}

/* ---------- aparelhos ---------- */
function ledOf(d) {
  if (!d.cfg.on) return '';
  if (d.type === 'isp') return d.cfg.online ? 'g' : 'r';
  if (d.type === 'ramal' || d.type === 'ata') return regStatus(d).ok ? 'g' : 'o';
  if (['tv', 'camana', 'phone', 'switch'].includes(d.type))
    return store.S.links.some(l => (l.a.d === d.id || l.b.d === d.id) && RT.ls[l.id] === 'up') ? 'g' : 'o';
  const x = ifaceOf(d.id);
  if (!x) return 'o';
  if (x.conflict) return 'r';
  return x.ip && !x.src.startsWith('APIPA') ? 'g' : 'o';
}
function subOf(d) {
  if (!d.cfg.on) return 'desligado';
  const x = ifsOf(d.id).find(i => !i.wan) || ifsOf(d.id)[0];
  const ip = x ? `${x.ip}/${maskBits(x.mask)}` : null;
  if (d.type === 'ramal' || d.type === 'ata') return `${d.cfg.ramal ? 'Ramal ' + d.cfg.ramal + ' · ' : ''}${ip || 'sem IP'}`;
  return ip || TYPES[d.type].label;
}
export function renderNodes() {
  const box = $('#nodes'), ids = new Set(store.S.devs.map(d => d.id));
  [...box.children].forEach(c => { if (!ids.has(c.dataset.id)) c.remove(); });
  for (const d of store.S.devs) {
    let el = box.querySelector(`[data-id="${d.id}"]`);
    if (!el) {
      el = document.createElement('div'); el.className = 'node'; el.dataset.id = d.id;
      el.innerHTML = `<div class="tile">${ico(d.type)}<span class="led"></span></div><div class="nlabel"><b></b><span></span></div>`;
      box.appendChild(el); bindNode(el);
    }
    el.style.left = d.x + 'px'; el.style.top = d.y + 'px';
    el.querySelector('b').textContent = d.name;
    el.querySelector('.nlabel span').textContent = subOf(d);
    el.querySelector('.led').className = 'led ' + ledOf(d);
    el.classList.toggle('sel', ui.sel === d.id);
    el.classList.toggle('off', !d.cfg.on);
    el.classList.toggle('pick', !!ui.con && ui.con.a === d.id);
  }
}

/* ---------- cabos ---------- */
export function drawLinks() {
  $('#links').innerHTML = store.S.links.map(l => {
    if (!devById(l.a.d) || !devById(l.b.d)) return '';
    const g = geomPts(l);
    const path = `M${g[0].x},${g[0].y} C${g[1].x},${g[1].y} ${g[2].x},${g[2].y} ${g[3].x},${g[3].y}`;
    const st = RT.ls[l.id] || 'up', up = st === 'up' || st === 'degraded';
    const col = st === 'up' ? '#39d353' : st === 'degraded' ? '#ff9f2e' : st === 'off' ? '#666' : '#ff5a5f';
    const a = dotAt(g, false), b = dotAt(g, true);
    return `<g class="lk k-${l.kind} s-${st}${ui.selL === l.id ? ' sel' : ''}${RT.act.has(l.id) ? ' act' : ''}" data-l="${l.id}">
      <path class="lbase" d="${path}"/>${up ? `<path class="lpulse" pathLength="100" d="${path}" style="animation-delay:-${(hash(l.id) % 26) / 10}s"/>` : ''}
      <path class="lhit" d="${path}"/><circle cx="${a.x}" cy="${a.y}" r="4.5" fill="${col}"/><circle cx="${b.x}" cy="${b.y}" r="4.5" fill="${col}"/></g>`;
  }).join('');
}

/* ---------- pacotes ---------- */
export function animate(st, done) {
  const l = st.l;
  if (!devById(l.a.d) || !devById(l.b.d)) { done(); return; }
  const back = st.from !== l.a.d;
  const el = document.createElement('div');
  el.className = 'pkt'; el.innerHTML = ENV(PKT_COLOR[st.type] || '#fff');
  $('#fx').appendChild(el);
  const dur = Q.mode === 'rt' ? 380 : 1100 / Q.speed, t0 = performance.now();
  RT.act.add(l.id); markAct(l.id, true);
  (function fr(now) {
    const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const p = bez(geomPts(l), back ? 1 - e : e);
    el.style.transform = `translate(${p.x - 11}px,${p.y - 9}px)`;
    if (t < 1) requestAnimationFrame(fr);
    else { el.remove(); RT.act.delete(l.id); markAct(l.id, false); done(); }
  })(t0);
}
function markAct(id, on) { const g = document.querySelector(`#links [data-l="${id}"]`); if (g) g.classList.toggle('act', on); }

/* ---------- visão ---------- */
export function applyView() {
  $('#world').style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})`;
  const s = 22 * V.z, c = $('#canvas');
  c.style.backgroundSize = `${s}px ${s}px`; c.style.backgroundPosition = `${V.x}px ${V.y}px`;
}
export function fitView() {
  const st = $('#stage').getBoundingClientRect(), devs = store.S.devs;
  if (!devs.length) { Object.assign(V, { x: st.width / 2 - 200, y: st.height / 2 - 150, z: 1 }); applyView(); return; }
  const xs = devs.map(d => d.x), ys = devs.map(d => d.y);
  const x0 = Math.min(...xs) - 20, x1 = Math.max(...xs) + 220, y0 = Math.min(...ys) - 20, y1 = Math.max(...ys) + 80;
  const mob = st.width < 820, L = mob ? 60 : 80, R = mob ? 10 : 360, T = mob ? 60 : 20, B = mob ? 140 : 130;
  const w = st.width - L - R, h = st.height - T - B;
  const z = Math.max(0.35, Math.min(1.1, Math.min(w / (x1 - x0), h / (y1 - y0))));
  Object.assign(V, { z, x: L + (w - (x1 - x0) * z) / 2 - x0 * z, y: T + (h - (y1 - y0) * z) / 2 - y0 * z });
  applyView();
}
function zoomAt(cx, cy, z) { z = Math.max(0.3, Math.min(2.2, z)); V.x = cx - (cx - V.x) * z / V.z; V.y = cy - (cy - V.y) * z / V.z; V.z = z; applyView(); }
export function zoomBy(f) { const r = $('#stage').getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, V.z * f); }
export const toWorld = (cx, cy) => { const r = $('#stage').getBoundingClientRect(); return { x: (cx - r.left - V.x) / V.z, y: (cy - r.top - V.y) / V.z }; };

/* ---------- interação ---------- */
function bindNode(el) {
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const d = devById(el.dataset.id); if (!d) return;
    el.setPointerCapture(e.pointerId);
    const st = { x: e.clientX, y: e.clientY, dx: d.x, dy: d.y, moved: false };
    const mv = ev => {
      const dx = (ev.clientX - st.x) / V.z, dy = (ev.clientY - st.y) / V.z;
      if (!st.moved && Math.hypot(dx, dy) * V.z < 5) return;
      st.moved = true; d.x = Math.round(st.dx + dx); d.y = Math.round(st.dy + dy);
      el.style.left = d.x + 'px'; el.style.top = d.y + 'px'; drawLinks();
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      if (st.moved) cb.onMoved(d); else cb.onNodeClick(d);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}

export function initCanvas(callbacks) {
  cb = { ...cb, ...callbacks };
  const c = $('#canvas'), ptrs = new Map(); let pan = null, pinch = null;
  c.addEventListener('pointerdown', e => {
    if (e.target.closest('.node')) return;
    const hit = e.target.closest('.lk');
    if (hit) { cb.onLinkClick(hit.dataset.l, e); return; }
    cb.onBackground();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); c.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.z, vx: V.x, vy: V.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pan = null;
    } else { pan = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; c.classList.add('panning'); }
  });
  c.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], r = $('#stage').getBoundingClientRect();
      const z = Math.max(0.3, Math.min(2.2, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      const cx = pinch.cx - r.left, cy = pinch.cy - r.top;
      V.x = cx - (cx - pinch.vx) * z / pinch.z; V.y = cy - (cy - pinch.vy) * z / pinch.z; V.z = z; applyView();
    } else if (pan) { V.x = pan.vx + e.clientX - pan.x; V.y = pan.vy + e.clientY - pan.y; applyView(); }
  });
  const end = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { pan = null; c.classList.remove('panning'); } };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('wheel', e => {
    e.preventDefault();
    const r = $('#stage').getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, V.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  window.addEventListener('resize', applyView);
  renderDock();
}

/* ---------- dock ---------- */
let CAT = 'Rede';
function renderDock() {
  $('#dock .cats').innerHTML = Object.keys(CATS).map(c => `<button class="cat ${c === CAT ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('#dock .items').innerHTML = CATS[CAT].map(t => `<div class="item" data-type="${t}" title="${TYPES[t].label}"><div class="ib">${ico(t)}</div><small>${TYPES[t].short}</small></div>`).join('');
  $$('#dock .cat').forEach(b => b.onclick = () => { CAT = b.dataset.cat; renderDock(); });
  $$('#dock .item').forEach(it => it.addEventListener('pointerdown', e => {
    e.preventDefault();
    const t = it.dataset.type, sx = e.clientX, sy = e.clientY; let g = null;
    const mv = ev => {
      if (!g && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        g = document.createElement('div'); g.className = 'ghost';
        g.innerHTML = `<div class="tile">${ico(t)}</div>`; document.body.appendChild(g);
      }
      if (g) { g.style.left = ev.clientX - 28 + 'px'; g.style.top = ev.clientY - 28 + 'px'; }
    };
    const up = ev => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      let p;
      if (g) {
        g.remove();
        const over = document.elementFromPoint(ev.clientX, ev.clientY);
        if (!over || !over.closest('#canvas')) return;
        p = toWorld(ev.clientX, ev.clientY); p.x -= 28; p.y -= 28;
      } else { // toque simples: adiciona no centro da tela
        const r = $('#stage').getBoundingClientRect();
        p = toWorld(r.left + r.width / 2 - 60 + Math.random() * 80, r.top + r.height / 2 - 80 + Math.random() * 60);
      }
      cb.onAdd(addDev(t, p.x, p.y));
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }));
}
