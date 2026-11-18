// Nected — ponto de entrada: liga o motor (core/sim) à interface (ui).
import { bus } from './core/bus.js';
import { store, blank, removeDev, removeLink, track, resetHistory, undo, redo, canUndo, canRedo } from './core/store.js';
import { compute } from './core/network.js';
import { persist } from './core/persist.js';
import { buildSample } from './core/scenario.js';
import { resetQueue } from './sim/queue.js';
import { $, $$, toast, hint, modal, closeModal } from './ui/dom.js';
import { ui } from './ui/uistate.js';
import { initCanvas, renderNodes, drawLinks, fitView, zoomBy, animate } from './ui/canvas.js';
import { connectDialog, linkPopup, hideLinkPop } from './ui/connect.js';
import { openWin, closeWin, closeAll, refreshWins, rerenderAll, termAppend } from './ui/windows.js';
import { startCameras } from './ui/cameras.js';
import { initPanel, renderEv, updSim, renderMissions } from './ui/panel.js';
import { openLabs, openExport, openImport } from './ui/labs.js';

/* ---------- ciclo de atualização ---------- */
let saveT = null;
function save() {
  $('#saved').textContent = 'Salvando…';
  clearTimeout(saveT);
  saveT = setTimeout(() => { $('#saved').textContent = persist.save(store.S) ? 'Salvo neste navegador' : 'Não salvo (sem armazenamento)'; }, 400);
}
function refreshAll() {
  compute(); renderNodes(); drawLinks(); refreshWins(); renderMissions();
  track(); updHistory(); save();
}
function updHistory() { $('#bUndo').disabled = !canUndo(); $('#bRedo').disabled = !canRedo(); }
function delDev(id) { const d = store.S.devs.find(x => x.id === id); removeDev(id); closeWin(id); if (ui.sel === id) ui.sel = null; refreshAll(); if (d) toast(`${d.name} removido`); }

Object.assign(bus, {
  refresh: refreshAll, toast, animate, delDev, term: termAppend,
  delay: (fn, ms) => setTimeout(fn, ms), events: renderEv, queue: updSim
});

/** Troca o laboratório aberto. */
function switchLab(S) {
  persist.save(store.S);
  store.S = S; closeAll(); resetQueue(); ui.sel = null;
  $('#pname').value = S.name;
  compute(); resetHistory(); refreshAll(); fitView(); closeModal();
}
function stepHistory(fn) { if (!fn()) return; ui.sel = null; $('#pname').value = store.S.name; compute(); rerenderAll(); renderNodes(); drawLinks(); renderMissions(); updHistory(); save(); }

/* ---------- ferramentas ---------- */
function setTool(t) {
  ui.tool = t; ui.con = null;
  $$('.tool[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  hint(t === 'cable' ? 'Cabo: toque no primeiro aparelho' : t === 'delete' ? 'Excluir: toque em um aparelho ou cabo para remover' : '');
  renderNodes();
}
const openCrimp = () => openWin('crimp');

initCanvas({
  onNodeClick(d) {
    hideLinkPop();
    if (ui.tool === 'delete') { delDev(d.id); return; }
    if (ui.tool === 'cable') {
      if (!ui.con) { ui.con = { a: d.id }; hint(`Cabo: agora toque no segundo aparelho (saindo de ${d.name})`); renderNodes(); return; }
      const a = ui.con.a; ui.con = null; renderNodes();
      if (a !== d.id) connectDialog(a, d.id, openCrimp);
      hint('Cabo: toque no primeiro aparelho'); return;
    }
    ui.sel = d.id; ui.selL = null; renderNodes(); openWin(d.id);
  },
  onLinkClick(id, e) { if (ui.tool === 'delete') { removeLink(id); hideLinkPop(); refreshAll(); toast('Cabo removido'); } else linkPopup(id, e); },
  onBackground() { hideLinkPop(); if (ui.tool === 'select' && ui.sel) { ui.sel = null; renderNodes(); } },
  onMoved() { refreshAll(); },
  onAdd(d) { ui.sel = d.id; refreshAll(); toast(`${d.name} adicionado — toque nele para configurar`); }
});

$$('.tool[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
const ACTS = {
  zin: () => zoomBy(1.2), zout: () => zoomBy(1 / 1.2), fit: fitView, crimp: openCrimp,
  sample: () => modal('Abrir cenário exemplo?', '<p class="sub" style="margin:0">Cria um novo laboratório com uma loja: 2 operadoras, Load Balance, switch, PCs, impressora térmica, CFTV e telefonia VoIP. O laboratório atual continua salvo.</p>',
    [{ label: 'Cancelar' }, { label: 'Abrir', pri: 1, fn: () => switchLab(buildSample()) }]),
  clear: () => modal('Limpar tudo?', '<p class="sub" style="margin:0">Remove todos os aparelhos e cabos deste laboratório. Dá para desfazer com Ctrl+Z.</p>',
    [{ label: 'Cancelar' }, { label: 'Limpar', pri: 1, fn: () => { Object.assign(store.S, { devs: [], links: [], leaseMem: {}, cnt: {} }); closeAll(); refreshAll(); fitView(); } }])
};
$$('.tool[data-act]').forEach(b => b.onclick = () => ACTS[b.dataset.act]());
$('#bLabs').onclick = () => openLabs(switchLab);
$('#bExport').onclick = openExport;
$('#bImport').onclick = () => openImport(switchLab);
$('#bUndo').onclick = () => stepHistory(undo);
$('#bRedo').onclick = () => stepHistory(redo);
$('#pname').onchange = e => { store.S.name = e.target.value.trim() || 'Sem nome'; refreshAll(); };

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { if (!e.target.matches('input,textarea')) { e.preventDefault(); stepHistory(undo); } return; }
  if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { if (!e.target.matches('input,textarea')) { e.preventDefault(); stepHistory(redo); } return; }
  if (e.target.matches('input,textarea,select')) return;
  if (e.key === 'Escape') { setTool('select'); hideLinkPop(); closeModal(); }
  else if (e.key === 'v' || e.key === 'V') setTool('select');
  else if (e.key === 'c' || e.key === 'C') setTool('cable');
  else if (e.key === 'Delete') { if (ui.sel) delDev(ui.sel); else if (ui.selL) { removeLink(ui.selL); hideLinkPop(); refreshAll(); } }
});
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
// Relógio dos telefones.
setInterval(refreshWins, 15000);

/* ---------- boot ---------- */
const first = persist.current();
store.S = first || buildSample();
initPanel();
$('#pname').value = store.S.name;
compute(); resetHistory(); refreshAll(); fitView(); startCameras();
if (!first) setTimeout(() => toast('Bem-vindo ao Nected! Toque em um aparelho para abrir a configuração.'), 400);

// PWA: funciona offline quando servido por http(s).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
