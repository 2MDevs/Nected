// Gerenciador de janelas estilo Windows: mover, minimizar, maximizar, abas e ações.
import { TYPES } from '../core/catalog.js';
import { ip2n } from '../core/ip.js';
import { bus } from '../core/bus.js';
import { devById } from '../core/store.js';
import { runCmd, dial, selfTest, lbTest, rtspTest, DIAL, PMSG, PRINTS } from '../sim/services.js';
import { $, esc, ico, toast, modal } from './dom.js';
import { setP } from './forms.js';
import { DYN } from './dyn.js';
import { tabsFor } from './devices.js';
import { crimpTabs, crimpAct } from './crimp.js';

export const WINS = {};
let zTop = 100;

const isCrimp = w => w.kind === 'crimp';
const titleOf = w => (isCrimp(w) ? 'Bancada de Crimpagem RJ45' : `${devById(w.id).name} — ${TYPES[devById(w.id).type].label}`);

export function openWin(id) {
  if (WINS[id]) { const w = WINS[id]; w.el.style.display = 'flex'; removeTask(id); focusWin(id); return; }
  const el = document.createElement('div');
  el.className = 'win';
  el.innerHTML = `<div class="wtitle"><span class="wic"></span><span class="tt"></span><button class="wb" data-w="min" title="Minimizar">—</button>
    <button class="wb" data-w="max" title="Maximizar">▢</button><button class="wb x" data-w="close" title="Fechar">✕</button></div><div class="wtabs"></div><div class="wbody"></div>`;
  $('#wins').appendChild(el);
  const w = { id, el, tab: 0, kind: id === 'crimp' ? 'crimp' : 'dev', born: Date.now() };
  WINS[id] = w;
  const st = $('#stage').getBoundingClientRect(), n = Object.keys(WINS).length - 1, mob = st.width < 820;
  el.style.width = Math.min(id === 'crimp' ? 560 : 470, st.width - 16) + 'px';
  el.style.left = (mob ? 8 : Math.max(8, Math.min(st.width - 490, st.width / 2 - 260 + n * 26))) + 'px';
  el.style.top = (mob ? 56 : Math.max(8, 60 + n * 26)) + 'px';
  bindWin(w); renderWin(w); focusWin(id);
}
export function focusWin(id) {
  Object.values(WINS).forEach(w => w.el.classList.remove('active'));
  const w = WINS[id]; if (!w) return;
  w.el.classList.add('active'); w.el.style.zIndex = ++zTop;
}
export function closeWin(id) { const w = WINS[id]; if (!w) return; w.el.remove(); delete WINS[id]; removeTask(id); }
export const closeAll = () => Object.keys(WINS).forEach(closeWin);
function removeTask(id) { document.querySelector(`.task[data-t="${id}"]`)?.remove(); }
function minWin(w) {
  w.el.style.display = 'none';
  const t = document.createElement('div');
  t.className = 'task'; t.dataset.t = w.id;
  t.innerHTML = `${ico(isCrimp(w) ? 'crimp' : devById(w.id).type)}<span>${esc(isCrimp(w) ? 'Crimpagem' : devById(w.id).name)}</span>`;
  t.onclick = () => openWin(w.id);
  $('#taskbar').appendChild(t);
}
function setTitle(w) {
  w.el.querySelector('.wic').innerHTML = ico(isCrimp(w) ? 'crimp' : devById(w.id).type);
  w.el.querySelector('.tt').textContent = titleOf(w);
}
export function renderWin(w) {
  setTitle(w);
  const tabs = isCrimp(w) ? crimpTabs() : tabsFor(devById(w.id));
  if (w.tab >= tabs.length) w.tab = 0;
  w.el.querySelector('.wtabs').innerHTML = tabs.map((t, i) => `<button class="wtab ${i === w.tab ? 'on' : ''}" data-tab="${i}">${t.n}</button>`).join('');
  const body = w.el.querySelector('.wbody');
  body.innerHTML = tabs[w.tab].h();
  refreshDyn(w);
  const term = body.querySelector('.term'); if (term) term.scrollTop = 1e9;
}
function refreshDyn(w) {
  const d = devById(w.id);
  w.el.querySelectorAll('[data-dyn]').forEach(e => {
    const [k, ...a] = e.dataset.dyn.split(':'), fn = DYN[k]; if (!fn || !d) return;
    const h = fn(d, ...a);
    if (e._h !== h) { e.innerHTML = h; e._h = h; }
  });
}
/** Atualiza título e status de todas as janelas abertas (sem perder o foco dos campos). */
export function refreshWins() {
  for (const w of Object.values(WINS)) {
    if (!isCrimp(w) && !devById(w.id)) { closeWin(w.id); continue; }
    setTitle(w); refreshDyn(w);
  }
}
export function rerenderAll() { Object.values(WINS).forEach(w => (isCrimp(w) || devById(w.id)) ? renderWin(w) : closeWin(w.id)); }

/** Linha nova no terminal aberto (ou limpa, se line === null). */
export function termAppend(id, line) {
  const el = document.querySelector(`.term[data-dev="${id}"]`); if (!el) return;
  if (line === null) { el.innerHTML = ''; return; }
  el.insertAdjacentHTML('beforeend', `<div class="${line.cls}">${esc(line.txt)}</div>`);
  el.scrollTop = 1e9;
}

function bindWin(w) {
  const el = w.el, tb = el.querySelector('.wtitle');
  el.addEventListener('pointerdown', () => focusWin(w.id));
  tb.addEventListener('pointerdown', e => {
    if (e.target.closest('.wb') || el.classList.contains('max')) return;
    tb.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop, st = $('#stage').getBoundingClientRect();
    const mv = ev => {
      el.style.left = Math.max(-el.offsetWidth + 80, Math.min(st.width - 80, ox + ev.clientX - sx)) + 'px';
      el.style.top = Math.max(0, Math.min(st.height - 40, oy + ev.clientY - sy)) + 'px';
    };
    const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); };
    tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
  });
  tb.addEventListener('dblclick', () => el.classList.toggle('max'));
  el.addEventListener('click', e => {
    if (Date.now() - w.born < 450) return; // evita o "clique fantasma" do toque que abriu a janela
    const wb = e.target.closest('[data-w]');
    if (wb) { const a = wb.dataset.w; if (a === 'close') closeWin(w.id); else if (a === 'max') el.classList.toggle('max'); else minWin(w); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { w.tab = +tab.dataset.tab; renderWin(w); return; }
    const cmd = e.target.closest('[data-cmd]');
    if (cmd) { runCmd(w.id, cmd.dataset.cmd); return; }
    const key = e.target.closest('[data-key]');
    if (key) { DIAL[w.id] = ((DIAL[w.id] || '') + key.dataset.key).slice(0, 12); PMSG[w.id] = ''; refreshDyn(w); return; }
    const act = e.target.closest('[data-act]');
    if (act) doAct(w, act.dataset.act.split(':'));
  });
  el.addEventListener('change', e => {
    const t = e.target; if (t.dataset.p === undefined) return;
    const d = devById(w.id);
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if ('num' in t.dataset) v = Number(v);
    if (typeof v === 'string') v = v.trim();
    if ('ip' in t.dataset) { const bad = v !== '' && ip2n(v) == null; t.classList.toggle('err', bad); if (bad) toast(`"${v}" não é um IP válido`, 'bad'); }
    setP(d, t.dataset.p, v);
    if ('rr' in t.dataset) renderWin(w);
    bus.refresh();
  });
  el.addEventListener('keydown', e => {
    if (e.target.matches('[data-term]') && e.key === 'Enter') { const v = e.target.value; e.target.value = ''; runCmd(w.id, v); }
  });
}

function doAct(w, [a, arg]) {
  if (isCrimp(w)) { crimpAct(a, arg); renderWin(w); bus.refresh(); return; }
  const d = devById(w.id), c = d.cfg;
  switch (a) {
    case 'del': modal('Excluir aparelho?', `<p class="sub" style="margin:0">${esc(d.name)} e todos os cabos ligados a ele serão removidos.</p>`,
      [{ label: 'Cancelar' }, { label: 'Excluir', pri: 1, fn: () => bus.delDev(d.id) }]); return;
    case 'selftest': selfTest(d); break;
    case 'clearpaper': PRINTS[d.id] = []; break;
    case 'addr': c.ramais.push({ num: String(200 + c.ramais.length + 1), senha: '1234' }); renderWin(w); break;
    case 'delr': c.ramais.splice(+arg, 1); renderWin(w); break;
    case 'addrt': c.routes.push({ net: '', mask: '255.255.255.0', via: '' }); renderWin(w); break;
    case 'delrt': c.routes.splice(+arg, 1); renderWin(w); break;
    case 'call': dial(d.id); return;
    case 'back': DIAL[d.id] = (DIAL[d.id] || '').slice(0, -1); refreshDyn(w); return;
    case 'hang': DIAL[d.id] = ''; PMSG[d.id] = ''; break;
    case 'lbtest': lbTest(d); return;
    case 'rtsp': if (!rtspTest(d)) toast('Cadastre o IP de uma câmera em algum canal', 'bad'); return;
  }
  bus.refresh();
}
