// Etapa 3 — editor visual (as janelas de configuração entram na etapa 4).
import { bus } from './core/bus.js';
import { store, removeDev, removeLink, track, resetHistory } from './core/store.js';
import { compute } from './core/network.js';
import { persist } from './core/persist.js';
import { buildSample } from './core/scenario.js';
import { $, $$, toast, hint } from './ui/dom.js';
import { ui } from './ui/uistate.js';
import { initCanvas, renderNodes, drawLinks, fitView, zoomBy, animate } from './ui/canvas.js';
import { connectDialog, linkPopup, hideLinkPop } from './ui/connect.js';

function refreshAll() { compute(); renderNodes(); drawLinks(); track(); persist.save(store.S); }
Object.assign(bus, { refresh: refreshAll, toast, animate, delay: (fn, ms) => setTimeout(fn, ms) });

function setTool(t) {
  ui.tool = t; ui.con = null;
  $$('.tool[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  hint(t === 'cable' ? 'Cabo: toque no primeiro aparelho' : t === 'delete' ? 'Excluir: toque em um aparelho ou cabo' : '');
  renderNodes();
}

initCanvas({
  onNodeClick(d) {
    hideLinkPop();
    if (ui.tool === 'delete') { removeDev(d.id); refreshAll(); return; }
    if (ui.tool === 'cable') {
      if (!ui.con) { ui.con = { a: d.id }; hint(`Cabo: agora toque no segundo aparelho`); renderNodes(); return; }
      const a = ui.con.a; ui.con = null; renderNodes();
      if (a !== d.id) connectDialog(a, d.id, () => {});
      hint('Cabo: toque no primeiro aparelho'); return;
    }
    ui.sel = d.id; renderNodes();
  },
  onLinkClick(id, e) { if (ui.tool === 'delete') { removeLink(id); refreshAll(); } else linkPopup(id, e); },
  onBackground() { hideLinkPop(); if (ui.tool === 'select' && ui.sel) { ui.sel = null; renderNodes(); } },
  onMoved() { refreshAll(); },
  onAdd(d) { ui.sel = d.id; refreshAll(); }
});
$$('.tool[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
$('.tool[data-act="zin"]').onclick = () => zoomBy(1.2);
$('.tool[data-act="zout"]').onclick = () => zoomBy(1 / 1.2);
$('.tool[data-act="fit"]').onclick = fitView;

store.S = persist.current() || buildSample();
compute(); resetHistory(); refreshAll(); fitView();
