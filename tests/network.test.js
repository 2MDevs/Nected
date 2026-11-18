import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ip2n, n2ip, sameNet, maskBits, isPrivate } from '../js/core/ip.js';
import { store, blank, addDev, addLink, devById, track, undo, redo, resetHistory } from '../js/core/store.js';
import { compute, route, regStatus, dvrFeeds, ifaceOf, routingTable } from '../js/core/network.js';
import { buildSample } from '../js/core/scenario.js';
import { evalCable, T568A, T568B } from '../js/core/cable.js';
import { TERM, PRINTS, DIAL, PMSG, runCmd, dial } from '../js/sim/services.js';
import { checkMissions } from '../js/sim/missions.js';

const byName = n => store.S.devs.find(d => d.name === n);
const byType = t => store.S.devs.find(d => d.type === t);

test('utilitários IP', () => {
  assert.equal(n2ip(ip2n('192.168.1.10')), '192.168.1.10');
  assert.equal(ip2n('300.1.1.1'), null);
  assert.ok(sameNet('192.168.1.10', '192.168.1.200', '255.255.255.0'));
  assert.ok(!sameNet('192.168.1.10', '192.168.2.10', '255.255.255.0'));
  assert.equal(maskBits('255.255.255.248'), 29);
  assert.ok(isPrivate('10.0.0.1') && isPrivate('172.20.1.1') && !isPrivate('8.8.8.8') && !isPrivate('100.64.10.5'));
});

test('crimpagem: direto, crossover, split pair e defeituoso', () => {
  assert.equal(evalCable(T568B, T568B).type, 'direto');
  assert.equal(evalCable(T568B, T568B).std, 'T568B');
  assert.equal(evalCable(T568A, T568B).type, 'crossover');
  const split = ['wo', 'o', 'wg', 'g', 'bl', 'wbl', 'wbr', 'br'];
  assert.equal(evalCable(split, split).type, 'split');
  const wrong = [...T568B]; [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
  assert.equal(evalCable(T568B, wrong).type, 'defeituoso');
  assert.equal(evalCable([...T568B.slice(0, 7), null], T568B).type, 'defeituoso');
});

test('cenário exemplo: DHCP e internet', () => {
  buildSample(); compute();
  const pc = byName('PC Caixa');
  const x = ifaceOf(pc.id);
  assert.match(x.ip, /^192\.168\.1\.1\d\d$/);
  assert.equal(x.gw, '192.168.1.1');
  const r = route(pc.id, '8.8.8.8');
  assert.ok(r.ok, r.msg);
  assert.ok(r.internet);
  assert.ok(['wan1', 'wan2'].includes(r.lbWan));
});

test('cenário exemplo: defeitos plantados e correção', () => {
  buildSample(); compute();
  const ata = byType('ata'), dvr = byType('dvr');
  assert.match(regStatus(ata).msg, /401/);
  assert.ok(regStatus(byType('ramal')).ok);
  assert.match(dvrFeeds(dvr)[4].why, /autenticação/);
  ata.cfg.senha = '1234';
  byName('Câmera Salão').cfg.pass = '12345';
  compute();
  assert.ok(regStatus(ata).ok);
  assert.ok(dvrFeeds(dvr)[4].cam);
  checkMissions();
  assert.equal(store.S.missions.tv, 1);
});

test('VLAN isola o PC e ele cai em APIPA', () => {
  buildSample();
  const sw = byName('Switch Rack');
  sw.cfg.vlans[1] = 10; // porta P2 = PC Caixa
  compute();
  const x = ifaceOf(byName('PC Caixa').id);
  assert.match(x.ip, /^169\.254\./);
  const r = route(byName('PC Caixa').id, '192.168.1.1');
  assert.ok(!r.ok);
});

test('failover do Load Balance', () => {
  buildSample();
  const lb = byType('lb');
  lb.cfg.mode = 'failover'; lb.cfg.primary = 'wan1';
  byName('Modem Vivo').cfg.online = false;
  compute();
  const r = route(byName('PC Caixa').id, '8.8.8.8');
  assert.ok(r.ok, r.msg);
  assert.equal(r.lbWan, 'wan2');
  assert.ok(r.failover);
  lb.cfg.health = false; compute();
  const r2 = route(byName('PC Caixa').id, '8.8.8.8');
  assert.ok(!r2.ok, 'sem health check o LB manda para o link morto');
});

test('NAT desligado: provedor descarta IP privado', () => {
  buildSample();
  byType('lb').cfg.nat = false; compute();
  const r = route(byName('PC Caixa').id, '8.8.8.8');
  assert.ok(!r.ok);
  assert.match(r.msg, /NAT/);
});

function twoRouters() {
  store.S = blank();
  const isp = addDev('isp', 0, 0);
  const r1 = addDev('router', 0, 100, { cfg: { lanIp: '192.168.0.1', dhcpStart: '192.168.0.100', dhcpEnd: '192.168.0.150' } });
  const sw = addDev('switch', 0, 200);
  // r2 tem WAN fixa na LAN do r1 e LAN própria 10.0.0.0/24
  const r2 = addDev('router', 300, 200, { cfg: { wanMode: 'static', wanIp: '192.168.0.2', wanMask: '255.255.255.0', wanGw: '192.168.0.1',
    lanIp: '10.0.0.1', lanMask: '255.255.255.0', dhcpStart: '10.0.0.100', dhcpEnd: '10.0.0.150', nat: false } });
  const pcA = addDev('pc', 0, 300), pcB = addDev('pc', 300, 300);
  addLink(isp.id, 0, r1.id, 0); addLink(r1.id, 1, sw.id, 0);
  addLink(sw.id, 1, pcA.id, 0); addLink(sw.id, 2, r2.id, 0); addLink(r2.id, 1, pcB.id, 0);
  return { r1, r2, pcA, pcB };
}

test('roteador atrás de roteador + rota estática', () => {
  const { r1, pcA, pcB } = twoRouters(); compute();
  assert.match(ifaceOf(pcB.id).ip, /^10\.0\.0\./);
  assert.ok(route(pcB.id, '8.8.8.8').ok, 'pcB sai para a internet via r2 → r1');
  const ipB = ifaceOf(pcB.id).ip;
  let r = route(pcA.id, ipB);
  assert.ok(!r.ok, 'sem rota estática o r1 manda 10.0.0.x para a internet');
  r1.cfg.routes = [{ net: '10.0.0.0', mask: '255.255.255.0', via: '192.168.0.2' }];
  compute();
  r = route(pcA.id, ipB);
  assert.ok(r.ok, r.msg);
  assert.ok(routingTable(r1).some(x => x.t === 'S' && x.via === '192.168.0.2'));
});

test('cabo defeituoso derruba o link', () => {
  buildSample();
  store.S.cables.push({ id: 'c900', name: 'Cabo ruim', res: { type: 'defeituoso' } });
  const l = store.S.links.find(l => l.b.d === byName('PC Caixa').id);
  l.cable = 'c900'; compute();
  assert.equal(ifaceOf(byName('PC Caixa').id).src, 'Mídia desconectada');
});

test('terminal: ping, nslookup e print', () => {
  buildSample(); compute();
  const pc = byName('PC Caixa');
  runCmd(pc.id, 'ping 8.8.8.8');
  runCmd(pc.id, 'nslookup google.com');
  runCmd(pc.id, 'print 192.168.1.50');
  const out = TERM[pc.id].map(x => x.txt).join('\n');
  assert.match(out, /Recebidos = 4/);
  assert.match(out, /142\.250\.79\.46/);
  assert.equal(PRINTS[byName('Térmica Cozinha').id].length, 1);
  assert.ok(store.S.missions.ping && store.S.missions.dns && store.S.missions.print);
});

test('VoIP: chamada entre ramal e telefone analógico via ATA', () => {
  buildSample();
  byType('ata').cfg.senha = '1234'; compute();
  const rm = byType('ramal');
  DIAL[rm.id] = '202';
  dial(rm.id);
  assert.match(PMSG[rm.id], /Em chamada com 202/);
  assert.match(PMSG[byType('phone').id], /Em chamada com 201/);
});

test('desfazer / refazer', () => {
  buildSample(); compute(); resetHistory();
  const n = store.S.devs.length;
  addDev('pc', 0, 0); compute(); track();
  assert.equal(store.S.devs.length, n + 1);
  assert.ok(undo());
  assert.equal(store.S.devs.length, n);
  assert.ok(redo());
  assert.equal(store.S.devs.length, n + 1);
});
