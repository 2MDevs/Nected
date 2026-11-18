// Serviços de aplicação: ping, DHCP, DNS, impressão RAW, chamadas SIP e o terminal.
import { bus } from '../core/bus.js';
import { ip2n, sameNet, hash, macOf } from '../core/ip.js';
import { ROUTERS } from '../core/catalog.js';
import { store, devById, linkAt, other } from '../core/store.js';
import { RT, compute, route, rev, ifsOf, ifaceOf, segPath, regStatus, NET, DNSDB } from '../core/network.js';
import { runJob } from './queue.js';

export const TERM = {}, PRINTS = {}, DIAL = {}, PMSG = {};
const mission = k => { store.S.missions[k] = 1; };

export function tprint(id, txt, cls = '') {
  (TERM[id] = TERM[id] || []).push({ txt, cls });
  if (TERM[id].length > 400) TERM[id].shift();
  bus.term(id, { txt, cls });
}
const T = type => s => ({ ...s, type });
const lastName = r => devById(r.l3[r.l3.length - 1])?.name;

export function resolve(srcId, name, cb) {
  const dns = ifsOf(srcId)[0]?.dns;
  if (!dns) { cb(null, 'Servidor DNS não configurado neste aparelho'); return; }
  const r = route(srcId, dns);
  if (!r.ok) { runJob([...r.steps.map(T('DNS')), { ev: [devById(srcId).name, dns, 'DNS', false] }], () => cb(null, `Servidor DNS ${dns} inacessível: ${r.msg}`)); return; }
  const t = r.target !== 'internet' ? devById(r.target) : null;
  // DNS no roteador/LB funciona como "relay": precisa de internet.
  const up = !t || ((t.type === 'router' || t.type === 'lb') && route(t.id, '8.8.8.8').ok);
  const ans = DNSDB[name.toLowerCase()];
  const steps = r.steps.map(T('DNS'));
  if (r.internet) steps.push({ ev: [lastName(r), 'Internet ' + dns, 'DNS'] });
  steps.push(...rev(r.steps).map(T('DNS')));
  runJob(steps, () => {
    if (!up) cb(null, `O DNS ${dns} não conseguiu consultar a internet`);
    else if (!ans) cb(null, `*** ${dns} não encontrou ${name}: Non-existent domain`);
    else { mission('dns'); cb(ans); }
  });
}

export function doPing(id, target) {
  const d = devById(id);
  const go = (dst, label) => {
    const r = route(id, dst);
    tprint(id, `\nDisparando ${label || dst}${label ? ` [${dst}]` : ''} com 32 bytes de dados:`);
    const steps = [{ ev: [d.name, 'Broadcast', 'ARP'] }, ...r.steps.map(T('ICMP'))];
    if (r.ok) {
      if (r.internet) steps.push({ ev: [lastName(r), 'Internet ' + dst, 'ICMP'] });
      steps.push(...rev(r.steps).map(T('ICMP')));
    } else steps.push({ ev: [devById(r.failAt || id)?.name, dst, 'ICMP', false] });
    runJob(steps, () => {
      let rec = 0;
      const hops = r.l3.filter(x => ROUTERS.includes(devById(x)?.type)).length;
      for (let i = 0; i < 4; i++) {
        if (!r.ok) { tprint(id, r.msg.startsWith('Host de destino') ? `Resposta de ${r.srcIp || '0.0.0.0'}: Host de destino inacessível.` : 'Esgotado o tempo limite do pedido.', 'bad'); continue; }
        if (r.degraded && Math.random() < 0.45) { tprint(id, 'Esgotado o tempo limite do pedido.', 'bad'); continue; }
        rec++;
        const ms = r.internet ? 10 + Math.round(Math.random() * 12) : (r.degraded ? 30 + Math.round(Math.random() * 90) : 0);
        tprint(id, `Resposta de ${dst}: bytes=32 tempo${ms ? '=' + ms : '<1'}ms TTL=${r.internet ? 117 : 128 - hops}`, 'ok');
      }
      tprint(id, `\nEstatísticas do Ping para ${dst}:\n    Pacotes: Enviados = 4, Recebidos = ${rec}, Perdidos = ${4 - rec} (${(4 - rec) * 25}% de perda)`);
      if (!r.ok) tprint(id, '💡 Diagnóstico: ' + r.msg, 'h');
      else if (r.degraded) tprint(id, '💡 Perda de pacotes: há um cabo com pares trocados (split pair) no caminho.', 'h');
      if (r.ok && r.lbWan) tprint(id, `↳ saiu pela ${r.lbWan.toUpperCase()} do Load Balance${r.failover ? ' (failover: link principal fora)' : ''}`, 'c');
      if (r.ok && r.internet) { mission('ping'); if (r.failover) mission('failover'); }
    });
    return r;
  };
  if (ip2n(target) != null) return go(target);
  resolve(id, target, (ip, err) => { if (!ip) tprint(id, `A solicitação ping não encontrou o host ${target}. ${err}`, 'bad'); else go(ip, target); });
}

export function doRenew(id) {
  compute();
  const d = devById(id), x = ifaceOf(id);
  if (!x || !d.cfg.dhcp) { tprint(id, 'Este adaptador usa IP estático. Ative o DHCP na aba Rede.', 'h'); return; }
  tprint(id, 'Liberando e renovando o endereço...');
  if (!x.dhcpKey) {
    runJob([{ ev: [d.name, 'Broadcast', 'DHCP', false] }], () => {
      tprint(id, x.src === 'Mídia desconectada' ? 'Mídia desconectada.' : `Nenhum servidor DHCP respondeu. Endereço automático (APIPA): ${x.ip}`, 'bad');
      tprint(id, '💡 Verifique o cabo, a VLAN da porta no switch ou se o DHCP do roteador está ligado.', 'h');
    });
    return;
  }
  const p = segPath(x.key, x.dhcpKey) || [];
  const f = p.map(T('DHCP')), b = rev(p).map(T('DHCP'));
  runJob([{ ev: [d.name, 'Broadcast', 'DHCP'] }, ...f, ...b, ...f, ...b], () =>
    tprint(id, `DHCP Discover → Offer → Request → Ack\nEndereço IPv4: ${x.ip}\nMáscara: ${x.mask}\nGateway: ${x.gw}\nDNS: ${x.dns}`, 'ok'));
}

export function addPrint(pid, txt) { (PRINTS[pid] = PRINTS[pid] || []).push(txt); if (PRINTS[pid].length > 6) PRINTS[pid].shift(); }

export function doPrint(id, ip, port) {
  const d = devById(id), r = route(id, ip); port = +port || 9100;
  const steps = r.steps.map(T('RAW'));
  if (!r.ok) steps.push({ ev: [d.name, ip, 'RAW', false] });
  runJob(steps, () => {
    if (!r.ok) { tprint(id, 'Falha ao enviar: ' + r.msg, 'bad'); return; }
    const t = devById(r.target);
    if (!t || t.type !== 'printer') { tprint(id, `${ip} não é uma impressora (conexão recusada na porta ${port}).`, 'bad'); return; }
    if (+t.cfg.port !== port) { tprint(id, `Conexão recusada: a impressora escuta na porta ${t.cfg.port}, não na ${port}.`, 'bad'); return; }
    const now = new Date();
    addPrint(t.id, `      NECTED LAB\n   CUPOM DE TESTE\n<hr>Origem : ${d.name}\nIP     : ${r.srcIp}\nDestino: ${ip}:${port}\nData   : ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}\n<hr>1x Pizza Calabresa   R$ 49,90\n1x Refrigerante 2L   R$ 12,00\n<hr>TOTAL              R$ 61,90\n\n   Obrigado e volte sempre!`);
    tprint(id, `Trabalho enviado para ${t.name} (${ip}:${port}) ✔`, 'ok');
    mission('print'); bus.toast(`🧾 ${t.name} imprimiu o cupom`, 'ok');
  });
}

export function selfTest(d) {
  const x = ifaceOf(d.id);
  addPrint(d.id, `   AUTOTESTE ${d.cfg.papel}\n<hr>Modo IP : ${d.cfg.dhcp ? 'DHCP' : 'Estático'}\nIP      : ${x?.ip || '0.0.0.0'}\nMáscara : ${x?.mask || '-'}\nGateway : ${x?.gw || '-'}\nPorta   : ${d.cfg.port} (RAW)\nMAC     : ${macOf(d.id)}`);
}

const say = (id, msg) => { PMSG[id] = msg; bus.refresh(); };

export function dial(id) {
  const d = devById(id); let caller = d;
  if (!d.cfg.on) return say(id, 'Aparelho desligado');
  if (d.type === 'phone') {
    const l = linkAt(d.id, 0);
    if (!l) return say(id, 'Sem tom de discagem — telefone desconectado do ATA');
    caller = devById(other(l, d.id).d);
    if (!caller.cfg.on) return say(id, 'Sem tom — ATA desligado');
  }
  const num = (DIAL[id] || '').trim();
  if (!num) return say(id, 'Digite um número');
  const reg = regStatus(caller);
  if (!reg.ok) return say(id, 'Sem linha: ' + reg.msg);
  const pabx = reg.pabx, inv = reg.r.steps.map(T('SIP')), back = rev(reg.r.steps).map(T('SIP'));
  const callee = store.S.devs.find(x => (x.type === 'ramal' || x.type === 'ata') && String(x.cfg.ramal) === num && x.id !== caller.id && x.cfg.sip === caller.cfg.sip);
  say(id, `Chamando ${num}...`);
  if (!callee || !pabx.cfg.ramais.some(e => String(e.num) === num)) {
    runJob([...inv, { ev: [pabx.name, caller.name, 'SIP', false] }, ...back], () => say(id, `404 — ramal ${num} não encontrado`)); return;
  }
  let bad = regStatus(callee).ok ? '' : `480 Indisponível — o ramal ${num} não está registrado`;
  if (!bad && callee.type === 'ata' && !linkAt(callee.id, 1)) bad = '480 — nenhum telefone ligado na porta FXS do ATA';
  if (bad) { runJob([...inv, { ev: [pabx.name, caller.name, 'SIP', false] }, ...back], () => say(id, bad)); return; }
  const calleeIp = ifsOf(callee.id)[0].ip;
  const r2 = route(pabx.id, calleeIp), media = route(caller.id, calleeIp);
  runJob([...inv, ...r2.steps.map(T('SIP')), ...rev(r2.steps).map(T('SIP')), ...back, ...media.steps.map(T('RTP')), ...rev(media.steps).map(T('RTP'))], () => {
    const ringer = callee.type === 'ata' ? devById(other(linkAt(callee.id, 1), callee.id).d) : callee;
    PMSG[ringer.id] = `☎ Em chamada com ${caller.cfg.ramal}`;
    mission('call');
    bus.toast(`📞 Chamada ${caller.cfg.ramal} → ${num} estabelecida (SIP + RTP)`, 'ok');
    say(id, `☎ Em chamada com ${num}`);
  });
}

export function lbTest(d) {
  const r = route(d.id, '8.8.8.8');
  const steps = r.steps.map(T('ICMP'));
  if (r.ok) steps.push({ ev: [lastName(r), 'Internet 8.8.8.8', 'ICMP'] }, ...rev(r.steps).map(T('ICMP')));
  else steps.push({ ev: [d.name, '8.8.8.8', 'ICMP', false] });
  runJob(steps, () => {
    if (r.ok) { bus.toast(`Saiu pela ${r.lbWan.toUpperCase()}${r.failover ? ' (failover ativo)' : ''} ✔`, 'ok'); if (r.failover) mission('failover'); }
    else bus.toast(r.msg, 'bad');
  });
  return r;
}

export function rtspTest(d) {
  let any = false;
  d.cfg.ipch.forEach(c => {
    if (!c.ip) return; any = true;
    const r = route(d.id, c.ip);
    const st = r.steps.map(T('RTSP'));
    if (r.ok) st.push(...rev(r.steps).map(T('RTSP'))); else st.push({ ev: [d.name, c.ip, 'RTSP', false] });
    runJob(st);
  });
  return any;
}

const HELP = `Comandos disponíveis:
  ipconfig            mostra IP, máscara, gateway e DNS
  ipconfig /renew     pede um novo IP ao servidor DHCP
  ping <ip|nome>      testa a comunicação (ex.: ping 8.8.8.8)
  ping gateway        pinga o gateway padrão
  tracert <ip>        mostra os roteadores no caminho
  nslookup <nome>     consulta o DNS (ex.: nslookup google.com)
  arp -a              lista os vizinhos na mesma rede
  print <ip> [porta]  envia cupom de teste à impressora térmica
  hostname | cls`;

export function runCmd(id, raw) {
  const d = devById(id), line = String(raw || '').trim();
  tprint(id, 'C:\\>' + line, 'c');
  if (!line) return;
  const [cmd, ...args] = line.split(/\s+/), c = cmd.toLowerCase();
  if (!d.cfg.on) { tprint(id, 'O computador está desligado.', 'bad'); return; }
  compute();
  const x = ifaceOf(id);
  switch (c) {
    case 'help': case 'ajuda': return tprint(id, HELP);
    case 'cls': TERM[id] = []; bus.term(id, null); return;
    case 'hostname': return tprint(id, d.name.replace(/\s+/g, '-').toUpperCase());
    case 'ipconfig':
      if (args[0] === '/renew') return doRenew(id);
      if (args[0] === '/release') return tprint(id, 'Endereço liberado. Use ipconfig /renew.');
      tprint(id, `Adaptador Ethernet ETH0:\n   Status . . . . . . : ${x?.src === 'Mídia desconectada' ? 'Mídia desconectada' : 'Conectado'}\n   Origem . . . . . . : ${x ? x.src : '-'}\n   Endereço IPv4. . . : ${x?.ip || '-'}\n   Máscara de Sub-rede: ${x?.mask || '-'}\n   Gateway Padrão . . : ${x?.gw || ''}\n   Servidores DNS . . : ${x?.dns || ''}\n   Endereço físico. . : ${macOf(id + '|nic', '-')}`);
      if (x?.src.startsWith('APIPA')) tprint(id, '💡 169.254.x.x = DHCP não respondeu (APIPA).', 'h');
      return;
    case 'ping': {
      let t = args[0];
      if (!t) return tprint(id, 'Uso: ping <ip ou nome>');
      if (t === 'gateway') { t = x?.gw; if (!t) return tprint(id, 'Sem gateway padrão configurado.', 'bad'); }
      return doPing(id, t);
    }
    case 'tracert': case 'traceroute': {
      const t = args[0];
      if (!t || ip2n(t) == null) return tprint(id, 'Uso: tracert <ip>');
      const r = route(id, t);
      tprint(id, `\nRastreando a rota para ${t} com no máximo 30 saltos:\n`);
      let n = 0;
      r.l3.slice(1).forEach(h => {
        const hd = devById(h); if (!hd) return;
        const ip = ifsOf(h).find(i => !i.wan) || ifsOf(h)[0];
        tprint(id, `  ${++n}    <1 ms    <1 ms    <1 ms  ${ip ? ip.ip : '*'}  [${hd.name}]`);
      });
      if (r.internet) {
        tprint(id, `  ${++n}     9 ms     8 ms    10 ms  187.100.${hash(t) % 200}.1  [backbone da operadora]`);
        tprint(id, `  ${++n}    14 ms    13 ms    14 ms  ${t}  [${NET[t]}]`);
      }
      if (!r.ok) { tprint(id, `  ${++n}     *        *        *     Esgotado o tempo limite do pedido.`, 'bad'); tprint(id, '💡 ' + r.msg, 'h'); }
      else tprint(id, '\nRastreamento concluído.', 'ok');
      runJob([...r.steps.map(T('ICMP')), ...(r.ok ? rev(r.steps).map(T('ICMP')) : [])]);
      return;
    }
    case 'nslookup': {
      const n = args[0];
      if (!n) return tprint(id, 'Uso: nslookup <nome>');
      return resolve(id, n, (ip, err) => ip
        ? tprint(id, `Servidor:  ${x.dns}\n\nResposta não autoritativa:\nNome:    ${n}\nAddress: ${ip}`, 'ok')
        : tprint(id, err, 'bad'));
    }
    case 'arp': {
      if (!x || !x.ip) return tprint(id, 'Sem interface ativa.');
      const nb = RT.ifaces.filter(i => i.ip && i !== x && RT.f(i.key) === RT.f(x.key) && sameNet(i.ip, x.ip, x.mask));
      tprint(id, `\nInterface: ${x.ip}\n  Endereço IP           Endereço físico       Tipo`);
      nb.forEach(i => tprint(id, `  ${i.ip.padEnd(20)}  ${macOf(i.key, '-').padEnd(20)}  dinâmico   (${devById(i.dev).name})`));
      if (!nb.length) tprint(id, '  (nenhum vizinho)');
      return;
    }
    case 'print':
      if (!args[0] || ip2n(args[0]) == null) return tprint(id, 'Uso: print <ip-da-impressora> [porta]');
      return doPrint(id, args[0], args[1]);
  }
  tprint(id, `'${cmd}' não é reconhecido como um comando. Digite help.`, 'bad');
}
