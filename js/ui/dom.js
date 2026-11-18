// Helpers de DOM, toasts, modal e dica flutuante.
import { ICONS } from '../core/catalog.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ico = t => `<svg viewBox="0 0 24 24">${ICONS[t] || ''}</svg>`;
export const ENV = c => `<svg viewBox="0 0 22 18"><rect x="1" y="1" width="20" height="16" rx="3" fill="${c}"/><path d="M2 3l9 7 9-7" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/></svg>`;
export const PKT_COLOR = { ICMP: '#f5c84c', DHCP: '#a77bff', DNS: '#4fd1c5', SIP: '#39d353', RTP: '#39d353', RTSP: '#ff6b6b', RAW: '#ff9f2e', ARP: '#9aa0aa' };

export function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

/** Modal simples. btns: [{label, pri, fn(box) → false mantém aberto}] */
export function modal(title, html, btns) {
  const m = $('#modal'), b = m.querySelector('.mbox');
  b.innerHTML = `<h3>${title}</h3>${html}<div class="btns" style="justify-content:flex-end;margin-top:16px">${btns.map((x, i) => `<button class="btn ${x.pri ? 'pri' : ''}" data-mi="${i}">${x.label}</button>`).join('')}</div>`;
  m.classList.add('on');
  b.querySelectorAll('[data-mi]').forEach(el => el.onclick = () => {
    const x = btns[+el.dataset.mi];
    const r = x.fn ? x.fn(b) : undefined;
    if (r !== false) m.classList.remove('on');
  });
  return b;
}
export const closeModal = () => $('#modal').classList.remove('on');

export function hint(txt) {
  const h = $('#hint');
  if (!txt) { h.style.display = 'none'; return; }
  h.textContent = txt; h.style.display = 'block';
}
