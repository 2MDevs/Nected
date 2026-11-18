// Helpers de formulário das janelas. Os inputs usam data-p="caminho.no.cfg".
import { esc } from './dom.js';

export function gP(d, p) { if (p === '$name') return d.name; return p.split('.').reduce((o, k) => (o == null ? o : o[k]), d.cfg); }
export function setP(d, p, v) {
  if (p === '$name') { d.name = v || d.name; return; }
  const ks = p.split('.'); let o = d.cfg;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}

/** Campo: o = { type:'check', opts:[[v,label]], num, ip, dis, ph, rr (re-render ao mudar) } */
export function F(d, label, p, o = {}) {
  const v = gP(d, p); let inp;
  if (o.type === 'check')
    inp = `<span><label class="sw"><input type="checkbox" data-p="${p}" ${v ? 'checked' : ''} ${o.rr ? 'data-rr' : ''}><i></i></label></span>`;
  else if (o.opts)
    inp = `<select data-p="${p}" ${o.rr ? 'data-rr' : ''} ${o.num ? 'data-num' : ''}>${o.opts.map(x => {
      const [val, lab] = Array.isArray(x) ? x : [x, x];
      return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`;
    }).join('')}</select>`;
  else
    inp = `<input data-p="${p}" value="${esc(v)}" ${o.dis ? 'disabled' : ''} placeholder="${esc(o.ph || '')}" ${o.num ? 'type="number" data-num' : ''} ${o.ip ? 'data-ip inputmode="decimal"' : ''} autocomplete="off">`;
  return `<div class="row"><label>${label}</label>${inp}</div>`;
}

export const dyn = (k, style = '') => `<div data-dyn="${k}" style="${style}"></div>`;
export const badge = (ok, txt, warn) => `<span class="st ${ok ? 'ok' : warn ? 'warn' : 'bad'}">● ${esc(txt)}</span>`;

export const mosaic = (feeds, n, cols) => `<div class="mosaic m${n}" ${cols ? `style="grid-template-columns:repeat(${cols},1fr)"` : ''}>${feeds.slice(0, n).map(f =>
  f.cam ? `<div class="feed"><canvas class="cam" width="192" height="108" data-cam="${f.cam.id}" data-label="${esc(f.ch + ' ' + f.cam.name)}"></canvas></div>`
  : f.info ? `<div class="feed info">${esc(f.info)}</div>`
  : `<div class="feed nos"><b>${f.ch}</b><span>${esc(f.why)}</span></div>`).join('')}</div>`;
