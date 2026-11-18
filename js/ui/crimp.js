// Bancada de crimpagem RJ45 (conteúdo da janela "crimp").
import { store, uid, cableInUse } from '../core/store.js';
import { WNAME, T568A, T568B, CABLE_RES, evalCable } from '../core/cable.js';
import { esc, toast } from './dom.js';
import { badge } from './forms.js';

const CR = { a: Array(8).fill(null), b: Array(8).fill(null), pick: 'wo', res: null };
const ok = t => t === 'direto' || t === 'crossover';

export function crimpTabs() {
  return [
    { n: 'Crimpar', h: () => {
      const end = (k, t) => `<div class="endc"><h4>${t}</h4><div class="rj"><div class="pins">${CR[k].map((c, i) =>
        `<div class="slot ${c ? 'f w-' + c : ''}" data-act="slot:${k}${i}" title="Pino ${i + 1}${c ? ' — ' + WNAME[c] : ''}"><em>${i + 1}</em></div>`).join('')}</div></div></div>`;
      const leds = (map, side) => [1, 2, 3, 4, 5, 6, 7, 8].map(n => {
        const i = side === 'a' ? n - 1 : map.indexOf(n);
        const lit = side === 'a' ? map[n - 1] > 0 : i >= 0;
        return `<i class="${lit ? 'on' : ''}" style="animation-delay:${Math.max(0, i) * 0.35}s">${n}</i>`;
      }).join('');
      return `<div class="sub" style="margin-bottom:8px">1) Escolha um fio · 2) toque no pino do conector (vista de frente, trava para baixo, pino 1 à esquerda).</div>
        <div class="wires">${T568B.map(c => `<div class="wire w-${c} ${CR.pick === c ? 'on' : ''}" data-act="pick:${c}" title="${WNAME[c]}"></div>`).join('')}</div>
        <div class="sub" style="margin:-4px 0 6px">Fio selecionado: <b style="color:#fff">${WNAME[CR.pick]}</b></div>
        <div class="ends">${end('a', 'Ponta A')}${end('b', 'Ponta B')}</div>
        <div class="btns"><button class="btn" data-act="copy">Copiar A → B</button><button class="btn" data-act="clr">Limpar</button><button class="btn pri" data-act="test">Crimpar e testar</button></div>
        ${CR.res ? `<div class="tester"><div><div class="sub tc">Testador A</div><div class="leds">${leds(CR.res.map, 'a')}</div></div><div><div class="sub tc">Testador B</div><div class="leds">${leds(CR.res.map, 'b')}</div></div></div>
        <div class="note ${ok(CR.res.type) ? '' : 'w'}"><b>${CABLE_RES[CR.res.type]}</b> — ${esc(CR.res.detail)}${CR.res.saved ? `<br>Guardado no inventário como <b>${esc(CR.res.saved)}</b>.` : ''}</div>` : ''}`;
    } },
    { n: `Inventário (${store.S.cables.length})`, h: () => store.S.cables.length
      ? `<table class="t"><tr><th>Cabo</th><th>Tipo</th><th>Uso</th><th></th></tr>${store.S.cables.map(c => `<tr><td>${esc(c.name)}</td><td>${badge(ok(c.res.type), CABLE_RES[c.res.type], c.res.type === 'split')}</td>
        <td>${cableInUse(c.id) ? 'Em uso' : 'Livre'}</td><td>${cableInUse(c.id) ? '' : `<button class="btn" data-act="delc:${c.id}">✕</button>`}</td></tr>`).join('')}</table>
        <div class="note">Cabos livres aparecem na lista ao ligar aparelhos com a ferramenta Cabo.</div>`
      : '<div class="sub">Nenhum cabo crimpado ainda.</div>' },
    { n: 'Padrões', h: () => {
      const strip = a => `<div class="std">${a.map((c, i) => `<span class="w-${c}">${i + 1}</span>`).join('')}</div>`;
      return `<div class="sec">T568B (mais usado no Brasil)</div>${strip(T568B)}<div class="sub">${T568B.map(c => WNAME[c]).join(' · ')}</div>
        <div class="sec">T568A</div>${strip(T568A)}<div class="sub">${T568A.map(c => WNAME[c]).join(' · ')}</div>
        <div class="sec">Regras</div><div class="note">• <b>Direto</b>: mesmo padrão nas duas pontas (B–B). É o cabo do dia a dia.<br>• <b>Crossover</b>: A numa ponta, B na outra. Hoje quase tudo tem Auto-MDIX.<br>
        • Os pares trançados ficam nos pinos <b>1-2, 3-6, 4-5, 7-8</b>. Trocar um par de lugar (split pair) passa no testador simples mas dá perda de pacotes.<br>
        • Desencape ~2 cm, destrance, alinhe, corte reto deixando ~1,2 cm e empurre até os fios tocarem o fim do conector antes de crimpar.</div>`;
    } }
  ];
}

/** Retorna true se a missão de crimpagem foi concluída. */
export function crimpAct(a, arg) {
  if (a === 'pick') CR.pick = arg;
  else if (a === 'slot') {
    const k = arg[0], i = +arg.slice(1), arr = CR[k];
    if (arr[i] === CR.pick) arr[i] = null;
    else {
      const j = arr.indexOf(CR.pick);
      if (j >= 0) arr[j] = arr[i];
      arr[i] = CR.pick;
      const nx = T568B.find(c => !arr.includes(c)); if (nx) CR.pick = nx;
    }
    CR.res = null;
  } else if (a === 'copy') { CR.b = [...CR.a]; CR.res = null; }
  else if (a === 'clr') { CR.a = Array(8).fill(null); CR.b = Array(8).fill(null); CR.res = null; CR.pick = 'wo'; }
  else if (a === 'test') {
    const r = evalCable(CR.a, CR.b);
    if (!CR.a.includes(null) && !CR.b.includes(null)) {
      const c = { id: uid('c'), name: `Cabo #${store.S.cables.length + 1}`, a: [...CR.a], b: [...CR.b], res: r };
      store.S.cables.push(c); r.saved = c.name;
      if (r.type === 'direto' && r.std === 'T568B') store.S.missions.crimp = 1;
    }
    CR.res = r;
    toast(`Testador: ${CABLE_RES[r.type]}`, ok(r.type) ? 'ok' : 'bad');
  } else if (a === 'delc') store.S.cables = store.S.cables.filter(c => c.id !== arg);
}
