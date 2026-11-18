// Motor de rede: segmentos L2 (VLAN), DHCP, roteamento L3, NAT, rotas estáticas, load balance.
// Puro — opera sobre store.S e grava o resultado em RT.
import { ip2n, n2ip, sameNet, maskBits, isPrivate, hash, netOf } from './ip.js';
import { ROUTERS } from './catalog.js';
import { store, devById, linkStatus, portGroup, linkAt, other } from './store.js';

export const RT = { ifaces: [], adj: {}, ls: {}, f: k => k, act: new Set() };

// "Internet" simulada atrás das operadoras.
export const NET = { '8.8.8.8': 'dns.google', '8.8.4.4': 'dns.google', '1.1.1.1': 'one.one.one.one',
  '142.250.79.46': 'google.com', '157.240.12.35': 'facebook.com', '200.160.2.3': 'registro.br' };
export const DNSDB = { 'google.com': '142.250.79.46', 'www.google.com': '142.250.79.46', 'facebook.com': '157.240.12.35',
  'dns.google': '8.8.8.8', 'registro.br': '200.160.2.3' };

/** Interfaces L3 que cada aparelho declara (antes do DHCP). */
export function ifDefs(d) {
  const c = d.cfg;
  switch (d.type) {
    case 'isp': return [{ group: 'lan', ip: c.lanIp, mask: c.lanMask, server: { on: true, start: c.dhcpStart, end: c.dhcpEnd }, dnsOut: '8.8.8.8', router: 1 }];
    case 'router': return [
      { group: 'lan', ip: c.lanIp, mask: c.lanMask, server: { on: c.dhcp, start: c.dhcpStart, end: c.dhcpEnd }, dnsOut: c.dns || c.lanIp, router: 1 },
      { group: 'wan', dhcp: c.wanMode === 'dhcp', ip: c.wanIp, mask: c.wanMask, gw: c.wanGw, router: 1, wan: 1 }];
    case 'lb': return [
      { group: 'lan', ip: c.lanIp, mask: c.lanMask, server: { on: c.dhcp, start: c.dhcpStart, end: c.dhcpEnd }, dnsOut: c.dns || c.lanIp, router: 1 },
      { group: 'wan1', dhcp: c.wan1Mode === 'dhcp', ip: c.wan1Ip, mask: c.wan1Mask, gw: c.wan1Gw, router: 1, wan: 1 },
      { group: 'wan2', dhcp: c.wan2Mode === 'dhcp', ip: c.wan2Ip, mask: c.wan2Mask, gw: c.wan2Gw, router: 1, wan: 1 }];
    case 'switch': return c.mgmtIp ? [{ group: 'v1', ip: c.mgmtIp, mask: c.mgmtMask, gw: c.mgmtGw }] : [];
    case 'tv': case 'camana': case 'phone': return [];
    default: return [{ group: 'nic', dhcp: c.dhcp, ip: c.ip, mask: c.mask, gw: c.gw, dns: c.dns }];
  }
}

function lease(s, x, defs) {
  const S = store.S;
  const mem = S.leaseMem[s.key] = S.leaseMem[s.key] || {};
  const a = ip2n(s.server.start), b = ip2n(s.server.end);
  if (a == null || b == null || a > b) return null;
  const used = new Set(defs.filter(d => !d.dhcp && d.ip).map(d => d.ip));
  Object.entries(mem).forEach(([k, v]) => { if (k !== x.key) used.add(v); });
  const cur = mem[x.key];
  if (cur && ip2n(cur) >= a && ip2n(cur) <= b && !used.has(cur)) return cur;
  for (let n = a; n <= b && n < a + 4096; n++) { const ip = n2ip(n); if (!used.has(ip)) { mem[x.key] = ip; return ip; } }
  return null;
}

/** Recalcula toda a rede. Chame depois de qualquer mudança. */
export function compute() {
  const S = store.S;
  const uf = {};
  const f = k => { if (uf[k] === undefined) uf[k] = k; while (uf[k] !== k) { uf[k] = uf[uf[k]]; k = uf[k]; } return k; };
  const adj = {}, ls = {};
  for (const l of S.links) {
    const st = linkStatus(l); ls[l.id] = st;
    if (l.kind !== 'eth' || st === 'bad' || st === 'off') continue;
    const A = devById(l.a.d), B = devById(l.b.d);
    const ka = A.id + '|' + portGroup(A, l.a.p), kb = B.id + '|' + portGroup(B, l.b.p);
    uf[f(ka)] = f(kb);
    (adj[ka] = adj[ka] || []).push({ l, to: kb, from: A.id });
    (adj[kb] = adj[kb] || []).push({ l, to: ka, from: B.id });
  }
  RT.f = f; RT.adj = adj; RT.ls = ls;

  const defs = S.devs.filter(d => d.cfg.on).flatMap(d => ifDefs(d).map(x => ({ ...x, dev: d.id, key: d.id + '|' + x.group })));
  for (const x of defs) if (!x.dhcp) {
    if (ip2n(x.ip) == null) x.ip = '';
    if (x.gw && ip2n(x.gw) == null) x.gw = '';
    x.src = 'Estático';
  }
  for (const x of defs) if (x.dhcp) {
    if (!adj[x.key]) { Object.assign(x, { ip: '', mask: '', gw: '', dns: '', src: 'Mídia desconectada' }); continue; }
    const seg = f(x.key);
    const servers = defs.filter(s => s.server && s.server.on && !s.dhcp && s.ip && f(s.key) === seg && s.dev !== x.dev);
    if (!servers.length) {
      const h = hash(x.key);
      Object.assign(x, { ip: `169.254.${(h >> 8) % 254 + 1}.${h % 254 + 1}`, mask: '255.255.0.0', gw: '', dns: '', src: 'APIPA (DHCP não respondeu)' });
      continue;
    }
    const s = servers[0], ip = lease(s, x, defs);
    if (!ip) { Object.assign(x, { ip: '', src: 'DHCP sem endereços livres no pool' }); continue; }
    Object.assign(x, { ip, mask: s.mask, gw: s.ip, dns: s.dnsOut || s.ip, src: 'DHCP ← ' + devById(s.dev).name, dhcpSrv: s.dev, dhcpKey: s.key });
    if (servers.length > 1) x.warn = `Há ${servers.length} servidores DHCP na mesma rede! (${servers.map(s => devById(s.dev).name).join(', ')})`;
  }
  const seen = {};
  for (const x of defs) {
    if (!x.ip) continue;
    const k = f(x.key) + '@' + x.ip;
    if (seen[k]) { x.conflict = seen[k].dev; seen[k].conflict = x.dev; } else seen[k] = x;
  }
  RT.ifaces = defs;
  return RT;
}

export const ifsOf = id => RT.ifaces.filter(i => i.dev === id && i.ip);
export const ifaceOf = id => RT.ifaces.find(i => i.dev === id);
export function onSeg(key, ip) { const s = RT.f(key); return RT.ifaces.find(i => i.ip === ip && RT.f(i.key) === s); }

/** Caminho físico (lista de cabos) entre duas interfaces do mesmo segmento. */
export function segPath(k1, k2) {
  if (k1 === k2) return [];
  if (RT.f(k1) !== RT.f(k2)) return null;
  const prev = { [k1]: null }, q = [k1];
  while (q.length) {
    const k = q.shift(); if (k === k2) break;
    for (const e of RT.adj[k] || []) if (!(e.to in prev)) { prev[e.to] = { k, e }; q.push(e.to); }
  }
  if (!(k2 in prev)) return null;
  const out = []; let k = k2;
  while (prev[k]) { out.unshift({ l: prev[k].e.l, from: prev[k].e.from }); k = prev[k].k; }
  return out;
}
export const rev = steps => steps.slice().reverse().map(s => ({ l: s.l, from: s.l.a.d === s.from ? s.l.b.d : s.l.a.d }));

export function wanHealthy(d, g) {
  const x = ifsOf(d.id).find(i => i.group === g);
  if (!x || !x.gw) return false;
  const gi = onSeg(x.key, x.gw); if (!gi) return false;
  const gd = devById(gi.dev);
  return gd.type === 'isp' ? gd.cfg.online : true;
}
export function pickWan(d, R = {}, rnd = Math.random) {
  const c = d.cfg, has = g => ifsOf(d.id).some(i => i.group === g);
  const ok = g => (c.health ? wanHealthy(d, g) : has(g));
  if (c.mode === 'failover') {
    const p = c.primary, s = p === 'wan1' ? 'wan2' : 'wan1';
    if (ok(p)) return p; if (ok(s)) { R.failover = true; return s; } return null;
  }
  const cand = ['wan1', 'wan2'].filter(ok);
  if (cand.length < 2) return cand[0] || null;
  const w1 = +c.w1 || 0, w2 = +c.w2 || 0;
  return rnd() * (w1 + w2 || 1) < w1 ? 'wan1' : 'wan2';
}

/** Tabela de roteamento de um roteador/LB (para exibição). */
export function routingTable(d) {
  const rows = [];
  for (const i of ifsOf(d.id)) rows.push({ t: 'C', net: netOf(i.ip, i.mask) + '/' + maskBits(i.mask), via: 'conectada', dev: i.group.toUpperCase() });
  for (const r of d.cfg.routes || []) if (ip2n(r.net) != null && ip2n(r.via) != null)
    rows.push({ t: 'S', net: r.net + '/' + maskBits(r.mask), via: r.via, dev: '' });
  const wans = ifsOf(d.id).filter(i => i.wan && i.gw);
  for (const w of wans) rows.push({ t: 'S*', net: '0.0.0.0/0', via: w.gw, dev: w.group.toUpperCase() });
  return rows;
}

/**
 * Calcula a rota de srcId até o IP dst.
 * Retorna { ok, msg, steps:[{l,from}], l3:[devIds], target, internet, lbWan, failover, srcIp, natIp, degraded }
 */
export function route(srcId, dst, opts = {}) {
  const R = { ok: false, steps: [], l3: [srcId], msg: '', target: null, internet: false };
  if (ip2n(dst) == null) { R.msg = 'Endereço IP inválido'; return R; }
  const src = devById(srcId);
  if (!src || !src.cfg.on) { R.msg = 'Aparelho desligado'; return R; }
  const sIfs = ifsOf(srcId);
  if (!sIfs.length) {
    const any = RT.ifaces.find(i => i.dev === srcId);
    R.msg = any && any.src === 'Mídia desconectada' ? 'Cabo de rede desconectado (mídia desconectada)' : 'Este aparelho não tem endereço IP';
    return R;
  }
  let srcIp = sIfs[0].ip; const orig = srcIp; let at = srcId, ttl = 16;
  const fail = (msg) => { R.msg = msg; R.failAt = at; return R; };

  while (ttl--) {
    const d = devById(at), my = ifsOf(at);
    if (my.some(i => i.ip === dst)) { R.ok = true; R.target = at; R.tIf = my.find(i => i.ip === dst); break; }
    const conn = my.find(i => sameNet(i.ip, dst, i.mask));
    if (conn) {
      const t = onSeg(conn.key, dst);
      if (!t) return fail(`Host de destino inacessível: ninguém respondeu ao ARP de ${dst}`);
      R.steps.push(...segPath(conn.key, t.key)); at = t.dev; R.l3.push(at); R.target = at; R.tIf = t; R.ok = true; break;
    }
    if (d.type === 'isp') {
      if (!d.cfg.online) return fail(`${d.cfg.provedor}: sem sinal da operadora (link fora do ar)`);
      if (isPrivate(srcIp)) return fail('O provedor descartou o pacote: IP de origem privado (NAT está desligado?)');
      if (NET[dst]) { R.ok = true; R.internet = true; R.target = 'internet'; break; }
      return fail('Esgotado o tempo: o host remoto não respondeu');
    }
    let out, gw;
    if (d.type === 'router' || d.type === 'lb') {
      const sr = (d.cfg.routes || []).find(r => ip2n(r.net) != null && ip2n(r.mask) != null && sameNet(dst, r.net, r.mask));
      if (sr) {
        out = my.find(i => sameNet(i.ip, sr.via, i.mask));
        if (!out) return fail(`${d.name}: o próximo salto ${sr.via} da rota ${sr.net}/${maskBits(sr.mask)} não está em nenhuma rede conectada`);
        gw = sr.via;
      } else if (d.type === 'router') out = my.find(i => i.group === 'wan');
      else {
        const g = pickWan(d, R, opts.rnd); R.lbWan = g; out = g && my.find(i => i.group === g);
        if (!out) return fail(`${d.name}: nenhuma WAN disponível`);
      }
      if (!out) return fail(`${d.name}: WAN sem endereço IP (cabo da operadora desconectado?)`);
    } else out = my[0];
    gw = gw || out.gw;
    if (!gw) return fail(out.src && out.src.startsWith('APIPA')
      ? `${d.name}: IP ${out.ip} é APIPA — o DHCP não respondeu, então não há gateway`
      : `${d.name}: sem gateway padrão configurado`);
    if (!sameNet(out.ip, gw, out.mask)) return fail(`${d.name}: o gateway ${gw} está fora da sub-rede ${out.ip}/${maskBits(out.mask)}`);
    const g = onSeg(out.key, gw);
    if (!g) return fail(`${d.name}: gateway ${gw} não responde (ARP sem resposta)`);
    const gd = devById(g.dev);
    if (!ROUTERS.includes(gd.type)) return fail(`${gw} (${gd.name}) não é um roteador — gateway errado`);
    if ((d.type === 'router' || d.type === 'lb') && out.wan && d.cfg.nat && isPrivate(srcIp)) srcIp = out.ip;
    R.steps.push(...segPath(out.key, g.key)); at = g.dev; R.l3.push(at);
  }
  if (!R.ok && !R.msg) { R.msg = 'TTL expirou em trânsito (loop de roteamento)'; R.failAt = at; }
  if (R.ok && R.tIf && R.l3.length > 2 && !sameNet(R.tIf.ip, srcIp, R.tIf.mask)) {
    const t = R.tIf;
    if (!t.gw || !onSeg(t.key, t.gw)) { R.ok = false; R.msg = `${dst} recebeu o pacote, mas não consegue responder: está sem gateway configurado`; }
  }
  R.srcIp = orig; R.natIp = srcIp;
  R.degraded = R.steps.some(s => RT.ls[s.l.id] === 'degraded');
  return R;
}

/* ---------- serviços de aplicação ---------- */
export function regStatus(d) {
  const c = d.cfg;
  if (!c.on) return { ok: false, msg: 'Desligado' };
  if (!c.sip) return { ok: false, msg: 'Servidor SIP não configurado' };
  if (!c.ramal) return { ok: false, msg: 'Número do ramal não configurado' };
  const r = route(d.id, c.sip);
  if (!r.ok) return { ok: false, msg: 'Sem rota até o PABX: ' + r.msg, r };
  const t = devById(r.target);
  if (!t || t.type !== 'pabx') return { ok: false, msg: `${c.sip} não é um servidor SIP (sem resposta na porta 5060)`, r };
  const e = t.cfg.ramais.find(x => String(x.num) === String(c.ramal));
  if (!e) return { ok: false, msg: `404 — ramal ${c.ramal} não existe no ${t.name}`, r, pabx: t };
  if (String(e.senha) !== String(c.senha)) return { ok: false, msg: '401 Não autorizado — senha do ramal incorreta', r, pabx: t };
  return { ok: true, msg: `Registrado no ${t.name} (${c.sip})`, r, pabx: t };
}

export function dvrFeeds(dvr) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const l = linkAt(dvr.id, 1 + i); let cam = null, why = 'Sem vídeo';
    if (!dvr.cfg.on) why = 'DVR desligado';
    else if (l) { const od = devById(other(l, dvr.id).d); if (!od.cfg.on) why = 'Câmera desligada'; else cam = od; }
    out.push({ ch: 'CH' + (i + 1), cam, why: cam ? '' : why });
  }
  dvr.cfg.ipch.forEach((c, i) => {
    let cam = null, why = 'Canal não configurado';
    if (!dvr.cfg.on) why = 'DVR desligado';
    else if (c.ip) {
      const r = route(dvr.id, c.ip);
      if (!r.ok) why = 'Sem rede: ' + r.msg;
      else {
        const t = devById(r.target);
        if (!t || t.type !== 'camip') why = `${c.ip} não é uma câmera IP`;
        else if (t.cfg.user !== c.user || t.cfg.pass !== c.pass) why = 'Falha de autenticação (usuário/senha)';
        else cam = t;
      }
    }
    out.push({ ch: 'IP' + (i + 1), cam, why: cam ? '' : why, ip: c.ip });
  });
  return out;
}

export function tvSource(tv) {
  const l = linkAt(tv.id, 0);
  if (!tv.cfg.on) return { why: 'TV desligada' };
  if (!l) return { why: 'SEM SINAL\nHDMI desconectado' };
  const d = devById(other(l, tv.id).d);
  if (d.type !== 'dvr') return { why: 'Fonte HDMI desconhecida' };
  if (!d.cfg.on) return { why: 'SEM SINAL\nDVR desligado' };
  return { dvr: d };
}
