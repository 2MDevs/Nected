// Blocos dinâmicos das janelas (status), recalculados a cada mudança na rede.
import { KIND_LABEL, portsOf } from '../core/catalog.js';
import { maskBits, sameNet } from '../core/ip.js';
import { store, devById, linkAt, other } from '../core/store.js';
import { RT, ifsOf, ifaceOf, route, wanHealthy, regStatus, dvrFeeds, tvSource, routingTable } from '../core/network.js';
import { PRINTS, DIAL, PMSG } from '../sim/services.js';
import { esc } from './dom.js';
import { badge, mosaic } from './forms.js';

const stLabel = st => (st === 'up' ? 'link' : st === 'degraded' ? 'instável' : st === 'off' ? 'desligado' : 'sem link');

export const DYN = {
  ipnow(d) {
    if (!d.cfg.on) return badge(0, 'Desligado');
    const x = ifaceOf(d.id); if (!x) return '';
    const l = linkAt(d.id, 0), ls = l ? RT.ls[l.id] : null;
    let h = `<div class="kv"><span>Cabo</span><b>${l ? (ls === 'up' ? 'Conectado' : ls === 'degraded' ? 'Conectado (instável)' : 'Sem link') : 'Desconectado'}</b>
      <span>Origem</span><b style="font-family:Inter">${esc(x.src)}</b><span>IPv4</span><b>${x.ip || '—'}</b>
      <span>Máscara</span><b>${x.mask || '—'}${x.mask ? ' (/' + maskBits(x.mask) + ')' : ''}</b><span>Gateway</span><b>${x.gw || '—'}</b><span>DNS</span><b>${x.dns || '—'}</b></div>`;
    if (x.src.startsWith('APIPA')) h += `<div class="note w">IP 169.254.x.x (APIPA) = o aparelho pediu IP ao DHCP e ninguém respondeu. Confira cabo, VLAN e se há servidor DHCP ligado.</div>`;
    if (x.conflict) h += `<div class="note w">⚠ Conflito de IP: ${esc(devById(x.conflict)?.name)} usa o mesmo endereço ${x.ip} nesta rede.</div>`;
    if (x.warn) h += `<div class="note w">⚠ ${esc(x.warn)}</div>`;
    if (!x.dhcp && x.ip && x.gw && !sameNet(x.ip, x.gw, x.mask)) h += `<div class="note w">⚠ O gateway ${x.gw} não está na mesma sub-rede do IP ${x.ip}/${maskBits(x.mask)}.</div>`;
    return h;
  },
  ports: d => `<table class="t">${portsOf(d).map((p, i) => {
    const l = linkAt(d.id, i);
    if (!l) return `<tr><td>${p.n}</td><td style="color:var(--mut)">${KIND_LABEL[p.k]} — livre</td></tr>`;
    const o = other(l, d.id), od = devById(o.d), st = RT.ls[l.id];
    return `<tr><td>${p.n}</td><td>${badge(st === 'up', stLabel(st), st === 'degraded')} ${esc(od.name)} · ${portsOf(od)[o.p].n}</td></tr>`;
  }).join('')}</table>`,
  leases(d) {
    const cl = RT.ifaces.filter(x => x.dhcpSrv === d.id);
    if (!cl.length) return '<div class="sub">Nenhum cliente DHCP ainda.</div>';
    return `<table class="t"><tr><th>Aparelho</th><th>IP concedido</th></tr>${cl.map(x => `<tr><td>${esc(devById(x.dev).name)}${x.group !== 'nic' ? ' (' + x.group.toUpperCase() + ')' : ''}</td><td class="mono">${x.ip}</td></tr>`).join('')}</table>`;
  },
  wan(d, g) {
    const x = RT.ifaces.find(i => i.dev === d.id && i.group === g);
    if (!x) return badge(0, 'Desligado');
    return `<div class="kv"><span>Origem</span><b style="font-family:Inter">${esc(x.src)}</b><span>IP</span><b>${x.ip || '—'}</b><span>Gateway</span><b>${x.gw || '—'}</b><span>Internet</span><b>${wanHealthy(d, g) ? badge(1, 'online') : badge(0, 'offline')}</b></div>`;
  },
  inet(d) { const r = route(d.id, '8.8.8.8'); return `<div style="margin-top:10px">${r.ok ? badge(1, 'Navegação OK (8.8.8.8 alcançável)') : badge(0, r.msg)}</div>`; },
  rtable(d) {
    const rows = routingTable(d);
    if (!rows.length) return '<div class="sub">Sem rotas.</div>';
    return `<table class="t"><tr><th></th><th>Rede</th><th>Via</th><th>Interface</th></tr>${rows.map(r => `<tr><td><b>${r.t}</b></td><td class="mono">${r.net}</td><td class="mono">${r.via}</td><td>${r.dev}</td></tr>`).join('')}</table><div class="sub" style="margin-top:6px">C = conectada · S = estática · S* = rota padrão</div>`;
  },
  lbstat: d => ['wan1', 'wan2'].map(g => {
    const x = RT.ifaces.find(i => i.dev === d.id && i.group === g), hl = wanHealthy(d, g);
    const l = linkAt(d.id, g === 'wan1' ? 0 : 1), isp = l && devById(other(l, d.id).d);
    const tag = d.cfg.mode === 'failover' ? (d.cfg.primary === g ? 'principal' : 'backup') : d.cfg[g === 'wan1' ? 'w1' : 'w2'] + '%';
    return `<div class="lbrow"><span><b>${g.toUpperCase()}</b> <span class="sub">${esc(isp ? isp.cfg.provedor || isp.name : 'sem cabo')} · ${x && x.ip || 'sem IP'}</span></span>${hl ? badge(1, tag) : badge(0, 'fora')}</div>`;
  }).join(''),
  swp(d, i) {
    const l = linkAt(d.id, +i); if (!l) return '<span class="sub">—</span>';
    const st = RT.ls[l.id];
    return `<span class="dot ${st === 'up' ? '' : 'bad'}"></span> ${esc(devById(other(l, d.id).d).name)}`;
  },
  ipch(d, i) {
    if (!d.cfg.ipch[i].ip) return '<span class="sub">Canal livre</span>';
    const f = dvrFeeds(d)[4 + (+i)];
    return f.cam ? badge(1, 'Online — ' + f.cam.name) : badge(0, f.why);
  },
  dvrgrid: d => mosaic(dvrFeeds(d), 8, 4) + `<div class="note">CH1–CH4: câmeras analógicas (BNC). IP1–IP4: câmeras IP cadastradas na aba Canais IP.</div>`,
  tvgrid(d) {
    const s = tvSource(d);
    if (!s.dvr) return `<div class="tvframe"><div class="tvsig">${esc(s.why).replace('\n', '<br>')}</div></div>`;
    const f = dvrFeeds(s.dvr), live = f.filter(x => x.cam), n = +d.cfg.layout === 9 ? 9 : 4;
    const list = n === 4 ? [...live, ...f.filter(x => !x.cam)].slice(0, 4) : [...f, { info: `${s.dvr.name}\n${live.length} câmera(s) online` }];
    return `<div class="tvframe">${mosaic(list, n)}</div><div class="sub" style="margin-top:8px">Fonte: ${esc(s.dvr.name)} via HDMI · ${live.length} câmera(s) ao vivo</div>`;
  },
  camlive(d) {
    if (!d.cfg.on) return `<div class="tvframe"><div class="tvsig">Câmera desligada</div></div>`;
    const x = ifsOf(d.id)[0];
    return `<div class="tvframe"><div class="mosaic" style="grid-template-columns:1fr"><div class="feed"><canvas class="cam" width="320" height="180" data-cam="${d.id}" data-label="${esc(d.name + ' ' + d.cfg.res)}"></canvas></div></div></div>
      <div class="sub" style="margin-top:8px">Visualização local. ${x ? 'Cadastre no DVR com IP ' + x.ip + ', porta RTSP ' + d.cfg.rtsp + '.' : 'Sem IP na rede.'}</div>`;
  },
  camurl(d) { const x = ifsOf(d.id)[0]; return `<code class="mono" style="word-break:break-all">rtsp://${esc(d.cfg.user)}:${esc(d.cfg.pass)}@${x ? x.ip : 'IP'}:${d.cfg.rtsp}/stream1</code>`; },
  pbxreg(d) {
    const myip = ifsOf(d.id)[0]?.ip;
    const cl = store.S.devs.filter(x => (x.type === 'ramal' || x.type === 'ata') && x.cfg.sip && x.cfg.sip === myip);
    if (!cl.length) return '<div class="sub">Nenhum aparelho apontando para este PABX.</div>';
    return `<table class="t">${cl.map(x => { const r = regStatus(x); return `<tr><td>${esc(x.cfg.ramal || '?')}</td><td>${esc(x.name)}</td><td>${badge(r.ok, r.ok ? 'Registrado' : r.msg)}</td></tr>`; }).join('')}</table>`;
  },
  regstat: d => { const r = regStatus(d); return badge(r.ok, r.msg); },
  fxs(d) {
    const l = linkAt(d.id, 1);
    return `<div style="margin-top:8px">${l ? badge(1, 'FXS1: ' + devById(other(l, d.id).d).name + ' conectado') : badge(0, 'FXS1: nenhum telefone conectado', 1)}</div>`;
  },
  lcd(d) {
    let line1 = '', st = '';
    if (d.type === 'phone') {
      const l = linkAt(d.id, 0), ata = l && devById(other(l, d.id).d);
      if (!ata) st = 'Sem tom de discagem';
      else { line1 = ata.cfg.ramal ? 'Ramal ' + ata.cfg.ramal : ''; st = regStatus(ata).ok ? 'Tom de discagem ✓' : 'Sem linha'; }
    } else { line1 = d.cfg.ramal ? 'Ramal ' + d.cfg.ramal : 'Sem conta SIP'; st = regStatus(d).ok ? 'Registrado ✓' : 'Não registrado'; }
    return `<div style="display:flex;justify-content:space-between"><span>${esc(line1)}</span><span>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><b>${esc(DIAL[d.id] || '')}</b><div>${esc(PMSG[d.id] || st)}</div>`;
  },
  prints(d) {
    const p = PRINTS[d.id] || [];
    if (!p.length) return '<div class="sub">Nada impresso ainda.</div>';
    return `<div class="paper" style="width:${d.cfg.papel === '58mm' ? 200 : 250}px">${p.map(t => esc(t).replace(/&lt;hr&gt;/g, '<hr>')).join('<hr class="cut">')}</div>`;
  }
};
