// Meus laboratórios + exportar/importar.
import { store, blank, normalize } from '../core/store.js';
import { persist } from '../core/persist.js';
import { buildSample } from '../core/scenario.js';
import { $, esc, modal, toast } from './dom.js';

/** onSwitch(S) é chamado quando outro laboratório passa a ser o atual. */
export function openLabs(onSwitch) {
  const draw = box => {
    const list = persist.list();
    box.querySelector('.labs').innerHTML = list.map(l => `<div class="lab ${l.id === store.S.id ? 'cur' : ''}" data-id="${l.id}">
      <div class="ln"><b>${esc(l.name)}</b><span class="sub">${l.devs} aparelho(s) · ${new Date(l.updated).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      ${l.id === store.S.id ? '<span class="st ok">aberto</span>' : '<button class="btn" data-l="open">Abrir</button>'}
      <button class="btn" data-l="dup" title="Duplicar">⧉</button>${l.id === store.S.id ? '' : '<button class="btn dan" data-l="del" title="Excluir">✕</button>'}</div>`).join('')
      || '<div class="sub">Nenhum laboratório salvo.</div>';
  };
  const box = modal('Meus laboratórios', `${persist.available ? '' : '<div class="note w" style="margin:0 0 10px">Este navegador não permite salvar — use Exportar para guardar seu trabalho.</div>'}
    <div class="labs"></div><div class="btns"><button class="btn pri" data-l="new">+ Laboratório em branco</button><button class="btn" data-l="sample">+ Cenário exemplo</button></div>`,
    [{ label: 'Fechar' }]);
  draw(box);
  box.onclick = e => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    const id = b.closest('.lab')?.dataset.id, a = b.dataset.l;
    persist.save(store.S);
    if (a === 'new') { onSwitch(blank('Laboratório ' + (persist.list().length + 1))); }
    else if (a === 'sample') { onSwitch(buildSample()); }
    else if (a === 'open') { onSwitch(persist.load(id)); }
    else if (a === 'dup') { const src = id === store.S.id ? store.S : persist.load(id); const c = normalize(JSON.parse(JSON.stringify(src))); c.id = blank().id; c.name += ' (cópia)'; persist.save(c); toast('Laboratório duplicado', 'ok'); }
    else if (a === 'del') { persist.remove(id); toast('Laboratório excluído'); }
    persist.save(store.S); draw(box);
  };
}

export function openExport() {
  modal('Exportar laboratório', `<p class="sub" style="margin-top:0">Copie o texto e guarde num arquivo <b>.json</b>. Use Importar para abrir em outro aparelho.</p>
    <textarea id="exT" rows="10" readonly>${esc(JSON.stringify(store.S))}</textarea>`,
    [{ label: 'Fechar' }, { label: 'Baixar .json', fn: () => {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(store.S, null, 1)], { type: 'application/json' }));
        a.download = (store.S.name || 'nected').replace(/[^\w\-]+/g, '_') + '.nected.json'; a.click();
      } catch (e) { toast('Download bloqueado aqui — use Copiar', 'bad'); }
      return false;
    } }, { label: 'Copiar', pri: 1, fn: () => {
      const t = $('#exT'); t.select();
      const done = () => toast('Copiado!', 'ok');
      try { navigator.clipboard.writeText(t.value).then(done, () => { document.execCommand('copy'); done(); }); } catch (e) { document.execCommand('copy'); done(); }
      return false;
    } }]);
}

export function openImport(onSwitch) {
  const box = modal('Importar laboratório', `<p class="sub" style="margin-top:0">Escolha um arquivo .json ou cole o conteúdo:</p>
    <input type="file" id="imF" accept=".json,application/json" style="margin-bottom:10px"><textarea id="imT" rows="9"></textarea>`,
    [{ label: 'Cancelar' }, { label: 'Importar', pri: 1, fn: () => {
      try {
        const o = JSON.parse($('#imT').value);
        if (!o.devs || !o.links) throw 0;
        const S = normalize(o); S.id = blank().id; // sempre entra como laboratório novo
        onSwitch(S); toast('Laboratório importado', 'ok');
      } catch (e) { toast('JSON inválido', 'bad'); return false; }
    } }]);
  box.querySelector('#imF').onchange = async e => { const f = e.target.files[0]; if (f) $('#imT').value = await f.text(); };
}
