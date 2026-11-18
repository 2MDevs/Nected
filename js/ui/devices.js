// Abas de configuração de cada tipo de aparelho.
import { esc } from './dom.js';
import { F, dyn } from './forms.js';
import { TERM } from '../sim/services.js';

const netForm = d => {
  const c = d.cfg;
  return `<div class="sec">Configuração IPv4</div>${F(d, 'Obter IP via DHCP', 'dhcp', { type: 'check', rr: 1 })}
    ${F(d, 'Endereço IP', 'ip', { dis: c.dhcp, ip: 1, ph: '192.168.0.10' })}${F(d, 'Máscara', 'mask', { dis: c.dhcp, ip: 1, ph: '255.255.255.0' })}
    ${F(d, 'Gateway padrão', 'gw', { dis: c.dhcp, ip: 1, ph: '192.168.0.1' })}${F(d, 'DNS', 'dns', { dis: c.dhcp, ip: 1, ph: '8.8.8.8' })}
    <div class="sec">Status atual</div>${dyn('ipnow')}`;
};
const geral = d => ({ n: 'Geral', h: () => `${F(d, 'Nome', '$name')}${F(d, 'Ligado', 'on', { type: 'check' })}<div class="sec">Portas</div>${dyn('ports')}
  <div class="btns"><button class="btn dan" data-act="del">Excluir aparelho</button></div>` });
const CHIPS = ['ipconfig', 'ipconfig /renew', 'ping gateway', 'ping 8.8.8.8', 'ping google.com', 'tracert 8.8.8.8', 'arp -a', 'cls'];
const term = d => ({ n: 'Terminal', h: () => {
  if (!TERM[d.id]) TERM[d.id] = [{ txt: 'Nected Terminal [versão 1.0]\nDigite help para ver os comandos.', cls: '' }];
  return `<div class="term" data-dev="${d.id}">${TERM[d.id].map(x => `<div class="${x.cls}">${esc(x.txt)}</div>`).join('')}</div>
    <div class="tin"><span>C:\\&gt;</span><input data-term placeholder="ex.: ping 8.8.8.8" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <div class="chips">${CHIPS.map(c => `<span class="chip" data-cmd="${c}">${c}</span>`).join('')}</div>`;
} });
const keypad = () => `<div class="phone"><div class="lcd" data-dyn="lcd"></div><div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}
  <button class="key end" data-act="hang">✕</button><button class="key" data-act="back">⌫</button><button class="key call" data-act="call">📞</button></div></div>`;
const lanTab = d => ({ n: 'LAN / DHCP', h: () => `${F(d, 'IP da LAN', 'lanIp', { ip: 1 })}${F(d, 'Máscara', 'lanMask', { ip: 1 })}
  <div class="sec">Servidor DHCP</div>${F(d, 'DHCP ativo', 'dhcp', { type: 'check', rr: 1 })}
  ${d.cfg.dhcp ? F(d, 'Início do pool', 'dhcpStart', { ip: 1 }) + F(d, 'Fim do pool', 'dhcpEnd', { ip: 1 }) + F(d, 'DNS entregue', 'dns', { ip: 1, ph: '(o próprio aparelho)' }) : ''}
  <div class="sec">Clientes DHCP</div>${dyn('leases')}` });
const routesTab = d => ({ n: 'Rotas', h: () => `<div class="note" style="margin:0 0 12px">Rotas estáticas dizem por qual gateway alcançar uma rede que não está ligada direto neste aparelho. Tudo o que não casar vai pela rota padrão (WAN).</div>
  <table class="t"><tr><th>Rede destino</th><th>Máscara</th><th>Próximo salto</th><th></th></tr>${d.cfg.routes.map((r, i) => `<tr>
   <td><input data-p="routes.${i}.net" data-ip value="${esc(r.net)}" placeholder="10.0.0.0"></td><td><input data-p="routes.${i}.mask" data-ip value="${esc(r.mask)}"></td>
   <td><input data-p="routes.${i}.via" data-ip value="${esc(r.via)}" placeholder="192.168.0.2"></td><td><button class="btn" data-act="delrt:${i}">✕</button></td></tr>`).join('')}</table>
  <div class="btns"><button class="btn" data-act="addrt">+ Adicionar rota</button></div><div class="sec">Tabela de roteamento</div>${dyn('rtable')}` });
const wanForm = (d, g, label) => `${F(d, 'Tipo de conexão', g + 'Mode', { opts: [['dhcp', 'IP dinâmico (DHCP da operadora)'], ['static', 'IP fixo']], rr: 1 })}
  ${d.cfg[g + 'Mode'] === 'static' ? F(d, 'IP ' + label, g + 'Ip', { ip: 1 }) + F(d, 'Máscara', g + 'Mask', { ip: 1 }) + F(d, 'Gateway', g + 'Gw', { ip: 1 }) : ''}`;

export function tabsFor(d) {
  const c = d.cfg, G = geral(d), rede = { n: 'Rede', h: () => netForm(d) };
  switch (d.type) {
    case 'pc': case 'notebook': return [term(d), rede, G];
    case 'printer': return [{ n: 'Impressora', h: () => `${F(d, 'Porta RAW (TCP)', 'port', { num: 1 })}${F(d, 'Largura do papel', 'papel', { opts: ['58mm', '80mm'] })}
      <div class="btns"><button class="btn" data-act="selftest">Autoteste (segurar FEED)</button><button class="btn" data-act="clearpaper">Cortar papel</button></div>
      <div class="note">Para imprimir pela rede, abra um PC e use <b>print ${esc(c.ip || 'IP')}</b>. O autoteste imprime a configuração de rede — o truque da vida real para descobrir o IP da térmica.</div>
      <div class="sec">Saída de papel</div>${dyn('prints')}` }, rede, G];
    case 'isp': return [{ n: 'Provedor', h: () => `${F(d, 'Operadora', 'provedor')}${F(d, 'Link da operadora online', 'online', { type: 'check' })}
      <div class="sec">LAN do modem</div>${F(d, 'IP do modem', 'lanIp', { ip: 1 })}${F(d, 'Máscara', 'lanMask', { ip: 1 })}${F(d, 'DHCP início', 'dhcpStart', { ip: 1 })}${F(d, 'DHCP fim', 'dhcpEnd', { ip: 1 })}
      <div class="note">Desligue "Link da operadora online" para simular queda de internet e testar o failover do Load Balance.</div>` },
      { n: 'Clientes', h: () => dyn('leases') }, G];
    case 'router': return [{ n: 'WAN', h: () => `${wanForm(d, 'wan', 'WAN')}${F(d, 'NAT (mascaramento)', 'nat', { type: 'check' })}<div class="sec">Status</div>${dyn('wan:wan')}${dyn('inet')}` },
      lanTab(d), routesTab(d), G];
    case 'lb': return [{ n: 'Balanceamento', h: () => `${F(d, 'Modo', 'mode', { opts: [['balance', 'Balanceamento por peso'], ['failover', 'Failover (principal + backup)']], rr: 1 })}
      ${c.mode === 'balance' ? F(d, 'Peso WAN1 (%)', 'w1', { num: 1 }) + F(d, 'Peso WAN2 (%)', 'w2', { num: 1 }) : F(d, 'Link principal', 'primary', { opts: [['wan1', 'WAN1'], ['wan2', 'WAN2']] })}
      ${F(d, 'Health check (ping 8.8.8.8)', 'health', { type: 'check' })}${F(d, 'NAT', 'nat', { type: 'check' })}
      <div class="sec">Estado dos links</div>${dyn('lbstat')}<div class="btns"><button class="btn pri" data-act="lbtest">Testar saída para internet</button></div>
      <div class="note">Sem health check, o Load Balance só percebe a queda se o cabo for desconectado — se a operadora cair "por trás" do modem, ele continua mandando tráfego para o link morto.</div>` },
      ...['wan1', 'wan2'].map(g => ({ n: g.toUpperCase(), h: () => `${wanForm(d, g, g.toUpperCase())}<div class="sec">Status</div>${dyn('wan:' + g)}` })),
      lanTab(d), routesTab(d), G];
    case 'switch': return [{ n: 'Portas e VLANs', h: () => `<table class="t"><tr><th>Porta</th><th>Conectado a</th><th style="width:96px">VLAN</th></tr>${c.vlans.map((v, i) => `<tr><td>P${i + 1}</td><td data-dyn="swp:${i}"></td>
      <td><select data-p="vlans.${i}" data-num>${[1, 10, 20, 30, 99].map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select></td></tr>`).join('')}</table>
      <div class="note">Portas em VLANs diferentes ficam em redes isoladas — não se enxergam sem um roteador. Teste: coloque um PC na VLAN 10 e rode ipconfig /renew.</div>` },
      { n: 'Gerência', h: () => `<div class="note" style="margin:0 0 12px">Switch gerenciável: IP opcional na VLAN 1 para acessar a gerência.</div>${F(d, 'IP de gerência', 'mgmtIp', { ip: 1, ph: 'vazio = sem IP' })}${F(d, 'Máscara', 'mgmtMask', { ip: 1 })}${F(d, 'Gateway', 'mgmtGw', { ip: 1 })}` }, G];
    case 'dvr': return [{ n: 'Ao vivo', h: () => dyn('dvrgrid') },
      { n: 'Canais IP', h: () => `<table class="t"><tr><th>Canal</th><th>IP da câmera</th><th>Usuário</th><th>Senha</th></tr>${c.ipch.map((x, i) => `<tr><td>IP${i + 1}</td>
        <td><input data-p="ipch.${i}.ip" data-ip value="${esc(x.ip)}" placeholder="—"></td><td><input data-p="ipch.${i}.user" value="${esc(x.user)}"></td><td><input data-p="ipch.${i}.pass" value="${esc(x.pass)}"></td></tr>
        <tr><td></td><td colspan="3" data-dyn="ipch:${i}" class="chst"></td></tr>`).join('')}</table><div class="btns"><button class="btn pri" data-act="rtsp">Conectar canais (RTSP)</button></div>` },
      { n: 'Rede', h: () => netForm(d) + `<div class="sec">Acesso</div>${F(d, 'Usuário', 'user')}${F(d, 'Senha', 'pass')}` }, G];
    case 'camip': return [{ n: 'Ao vivo', h: () => dyn('camlive') },
      { n: 'Câmera', h: () => `${F(d, 'Usuário', 'user')}${F(d, 'Senha', 'pass')}${F(d, 'Resolução', 'res', { opts: ['720p', '1080p', '4MP', '4K'] })}${F(d, 'Porta RTSP', 'rtsp', { num: 1 })}<div class="sec">URL do stream</div>${dyn('camurl')}` }, rede, G];
    case 'camana': return [{ n: 'Câmera', h: () => `${F(d, 'Resolução', 'res', { opts: ['720p', '1080p', '4MP'] })}<div class="note">Câmera analógica (AHD/HDCVI) não tem IP: o vídeo vai pelo coaxial até uma entrada BNC (CH1–CH4) do DVR.</div><div class="sec">Portas</div>${dyn('ports')}` }, G];
    case 'tv': return [{ n: 'Monitor', h: () => `${F(d, 'Layout', 'layout', { opts: [[4, '4 câmeras (2×2)'], [9, '9 câmeras (3×3)']], num: 1 })}${dyn('tvgrid')}` }, G];
    case 'pabx': return [{ n: 'Ramais', h: () => `<table class="t"><tr><th>Ramal</th><th>Senha SIP</th><th></th></tr>${c.ramais.map((r, i) => `<tr><td><input data-p="ramais.${i}.num" value="${esc(r.num)}"></td><td><input data-p="ramais.${i}.senha" value="${esc(r.senha)}"></td><td><button class="btn" data-act="delr:${i}">✕</button></td></tr>`).join('')}</table>
      <div class="btns"><button class="btn" data-act="addr">+ Adicionar ramal</button></div><div class="sec">Registros SIP</div>${dyn('pbxreg')}` }, rede, G];
    case 'ramal': return [{ n: 'Telefone', h: keypad },
      { n: 'SIP', h: () => `${F(d, 'Servidor SIP (PABX)', 'sip', { ip: 1, ph: 'IP do PABX' })}${F(d, 'Ramal', 'ramal', { ph: 'ex.: 201' })}${F(d, 'Senha', 'senha')}<div class="sec">Status</div>${dyn('regstat')}` }, rede, G];
    case 'ata': return [{ n: 'SIP / FXS', h: () => `${F(d, 'Servidor SIP (PABX)', 'sip', { ip: 1, ph: 'IP do PABX' })}${F(d, 'Ramal da porta FXS1', 'ramal', { ph: 'ex.: 202' })}${F(d, 'Senha', 'senha')}
      <div class="sec">Status</div>${dyn('regstat')}${dyn('fxs')}<div class="note">O ATA transforma um telefone comum (analógico) em ramal VoIP: a porta FXS dá tom e energia ao aparelho, e o ATA conversa SIP com o PABX.</div>` }, rede, G];
    case 'phone': return [{ n: 'Telefone', h: keypad }, G];
  }
  return [G];
}
