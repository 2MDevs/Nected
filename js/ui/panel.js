// Painel de simulação: controles, lista/filtro de eventos e missões.
import { store } from '../core/store.js';
import { Q, EV, FILT, setMode, togglePlay, stepOnce, resetQueue, clearEvents, pending } from '../sim/queue.js';
import { MISSIONS, checkMissions } from '../sim/missions.js';
import { $, $$, esc, toast } from './dom.js';

export function renderEv() {
  const rows = EV.filter(e => FILT[e.type] !== 0).slice(-80);
  $('#evBody').innerHTML = rows.map((e, i) => `<tr class="${i === rows.length - 1 ? 'new' : ''}"><td>${e.t}</td><td title="${esc(e.last)}">${esc(e.last)}</td>
    <td title="${esc(e.at)}">${esc(e.at)}</td><td>${e.type}</td><td><span class="dot ${e.ok ? '' : 'bad'}"></span></td></tr>`).join('')
    || `<tr><td colspan="5" style="color:var(--mut);padding:14px;white-space:normal">Nenhum evento ainda. Abra um PC e rode <b>ping</b> no terminal.</td></tr>`;
  const b = $('.evbox'); b.scrollTop = b.scrollHeight;
}

export function updSim() {
  const n = pending();
  $('#pPlay').innerHTML = `<svg viewBox="0 0 24 24">${(Q.mode === 'rt' || Q.playing) ? '<path d="M9 5v14M15 5v14"/>' : '<path d="M7 5l12 7-12 7z"/>'}</svg>`;
  $('#simInfo').textContent = Q.mode === 'rt' ? 'Tempo real: os pacotes andam sozinhos.'
    : n ? `Simulação: ${n} fluxo(s) na fila${Q.waiting ? ' — aguardando ▶ ou ⏭' : ''}` : 'Simulação: dispare um ping e avance passo a passo.';
  $('#pNext').disabled = Q.mode === 'rt';
  $('#speedRow').style.display = Q.mode === 'sim' ? 'flex' : 'none';
}

export function renderMissions() {
  const done = checkMissions(), M = store.S.missions;
  $('#pMis').innerHTML = `<div class="sub" style="margin-bottom:6px">${done}/${MISSIONS.length} concluídas</div>`
    + MISSIONS.map(([k, t]) => `<div class="mis ${M[k] ? 'done' : ''}"><i>${M[k] ? '✓' : ''}</i><span>${esc(t)}</span></div>`).join('')
    + `<div class="note">No cenário exemplo há <b>2 defeitos plantados</b> (um no CFTV e um na telefonia). Encontre-os pelas mensagens de status!</div>
       <div class="btns"><button class="btn" id="misReset">Zerar missões</button></div>`;
  $('#misReset').onclick = () => { store.S.missions = {}; renderMissions(); };
}

export function initPanel() {
  $$('.mbtn[data-mode]').forEach(b => b.onclick = () => {
    setMode(b.dataset.mode);
    $$('.mbtn[data-mode]').forEach(x => x.classList.toggle('on', x === b));
    toast(Q.mode === 'sim' ? 'Modo Simulação: use ▶ ou ⏭ para avançar os pacotes' : 'Modo Tempo real');
  });
  $('#ptoggle').onclick = () => $('#sim').classList.toggle('open');
  $('#pPlay').onclick = togglePlay;
  $('#pNext').onclick = stepOnce;
  $('#pReset').onclick = resetQueue;
  $('#evClear').onclick = clearEvents;
  $('#speed').oninput = e => { Q.speed = +e.target.value; };
  $('#filters').innerHTML = Object.keys(FILT).map(k => `<label><input type="checkbox" data-f="${k}" checked>${k}</label>`).join('');
  $$('#filters input').forEach(i => i.onchange = () => { FILT[i.dataset.f] = i.checked ? 1 : 0; renderEv(); });
  $$('.ptab').forEach(b => b.onclick = () => {
    $$('.ptab').forEach(x => x.classList.toggle('on', x === b));
    $('#pEv').style.display = b.dataset.pt === 'ev' ? 'flex' : 'none';
    $('#pMis').style.display = b.dataset.pt === 'mis' ? 'block' : 'none';
  });
  renderEv(); updSim(); renderMissions();
}
