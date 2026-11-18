// Diálogo "ligar cabo" e popup de informações do cabo.
import { KIND_LABEL, portsOf } from '../core/catalog.js';
import { store, devById, addLink, removeLink, freePorts, cableOf, cableInUse } from '../core/store.js';
import { CABLE_RES } from '../core/cable.js';
import { RT } from '../core/network.js';
import { bus } from '../core/bus.js';
import { $, esc, modal, toast } from './dom.js';
import { ui } from './uistate.js';
import { drawLinks } from './canvas.js';

export function connectDialog(aId, bId, openCrimp) {
  const A = devById(aId), B = devById(bId), fa = freePorts(A), fb = freePorts(B);
  const kinds = [...new Set(fa.map(p => p.k))].filter(k => fb.some(p => p.k === k));
  if (!kinds.length) { toast(`Não há portas compatíveis livres entre ${A.name} e ${B.name}`, 'bad'); return; }
  // Ao ligar num modem, prefere a porta WAN; senão, uma LAN.
  const pref = (list, o) => { const w = list.filter(p => /^wan/.test(p.g)); return o.type === 'isp' && w.length ? w[0] : list.find(p => !/^wan/.test(p.g)) || list[0]; };
  const box = modal(`Conectar ${esc(A.name)} ↔ ${esc(B.name)}`,
    `<div class="row"><label>Porta em ${esc(A.name)}</label><select id="cpa"></select></div>
     <div class="row"><label>Porta em ${esc(B.name)}</label><select id="cpb"></select></div>
     <div class="row"><label>Cabo</label><select id="ccb"></select></div><div id="cnote"></div>`,
    [{ label: 'Cancelar' }, { label: 'Crimpar um cabo', fn: () => openCrimp() }, { label: 'Conectar', pri: 1, fn: () => {
      const pa = +$('#cpa').value, pb = +$('#cpb').value;
      if (isNaN(pa) || isNaN(pb)) return false;
      const l = addLink(aId, pa, bId, pb, $('#ccb').value);
      bus.refresh();
      const bad = RT.ls[l.id] === 'bad';
      toast(bad ? 'Cabo conectado, mas SEM LINK — cabo defeituoso' : `Cabo conectado: ${A.name} ${portsOf(A)[pa].n} ↔ ${B.name} ${portsOf(B)[pb].n}`, bad ? 'bad' : 'ok');
    } }]);
  const sa = box.querySelector('#cpa'), sb = box.querySelector('#cpb'), sc = box.querySelector('#ccb');
  const allowed = fa.filter(p => kinds.includes(p.k)), d0 = pref(allowed, B);
  sa.innerHTML = allowed.map(p => `<option value="${p.i}" ${p === d0 ? 'selected' : ''}>${p.n} (${KIND_LABEL[p.k]})</option>`).join('');
  const upd = () => {
    const k = portsOf(A)[+sa.value].k, lb = fb.filter(p => p.k === k), d1 = pref(lb, A);
    sb.innerHTML = lb.map(p => `<option value="${p.i}" ${p === d1 ? 'selected' : ''}>${p.n} (${KIND_LABEL[p.k]})</option>`).join('');
    const mine = store.S.cables.filter(c => !cableInUse(c.id));
    const opts = k === 'eth'
      ? [['factory', 'Patch cord de fábrica (direto T568B)'], ...mine.map(c => [c.id, `${c.name} — ${CABLE_RES[c.res.type]}`])]
      : [[k, { coax: 'Coaxial RG59 + BNC', rj11: 'Cabo telefônico RJ11', hdmi: 'Cabo HDMI' }[k]]];
    sc.innerHTML = opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('');
    box.querySelector('#cnote').innerHTML = k === 'eth'
      ? `<div class="note">Dica: crimpe seus próprios cabos na <b>Bancada de crimpagem</b> — eles aparecem aqui. ${mine.length} cabo(s) seu(s) disponível(is).</div>` : '';
  };
  sa.onchange = upd; upd();
}

export function linkPopup(lid, e) {
  const l = store.S.links.find(x => x.id === lid); if (!l) return;
  ui.selL = lid; drawLinks();
  const A = devById(l.a.d), B = devById(l.b.d), c = cableOf(l), st = RT.ls[l.id];
  const stTxt = { up: '<span class="st ok">● Link ativo</span>', degraded: '<span class="st warn">● Link instável</span>', bad: '<span class="st bad">● Sem link</span>', off: '<span class="st">● Aparelho desligado</span>' }[st];
  const pop = $('#linkpop');
  pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Cabo ${KIND_LABEL[l.kind]}</b>${stTxt}</div>
   <div class="kv" style="grid-template-columns:70px 1fr"><span>Ponta A</span><b>${esc(A.name)} · ${portsOf(A)[l.a.p].n}</b><span>Ponta B</span><b>${esc(B.name)} · ${portsOf(B)[l.b.p].n}</b><span>Cabo</span><b style="font-family:Inter">${esc(c.name)}${l.kind === 'eth' ? ' (' + CABLE_RES[c.type] + ')' : ''}</b></div>
   ${c.c ? `<div class="note ${c.status === 'ok' ? '' : 'w'}">${esc(c.c.res.detail)}</div>` : ''}
   ${l.kind === 'eth' && c.type === 'crossover' ? '<div class="note">Aparelhos modernos têm Auto-MDIX, então o crossover também funciona aqui.</div>' : ''}
   <div class="btns"><button class="btn dan" id="lpDel">Remover cabo</button><button class="btn" id="lpX">Fechar</button></div>`;
  const r = $('#stage').getBoundingClientRect();
  pop.style.display = 'block';
  pop.style.left = Math.min(r.width - 275, Math.max(8, e.clientX - r.left + 10)) + 'px';
  pop.style.top = Math.min(r.height - 260, Math.max(8, e.clientY - r.top + 10)) + 'px';
  $('#lpDel').onclick = () => { removeLink(l.id); hideLinkPop(); bus.refresh(); };
  $('#lpX').onclick = hideLinkPop;
}
export function hideLinkPop() { $('#linkpop').style.display = 'none'; if (ui.selL) { ui.selL = null; drawLinks(); } }
