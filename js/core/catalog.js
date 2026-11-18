// Catálogo de aparelhos: portas, configuração padrão e ícones.

export const ICONS = {
  isp: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  router: '<rect x="3" y="12" width="18" height="7" rx="2"/><path d="M7 15.5h.01M10.5 15.5h.01M7 12V7M17 12V5M14 9a4 4 0 0 1 6 0"/>',
  lb: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l6-5.5M11 12l6 5.5"/>',
  switch: '<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  notebook: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2 19h20l-2-4H4z"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="9" rx="2"/><path d="M8 13h8M17 12h.01"/><path d="M8 18v3h8v-3"/>',
  dvr: '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="6" cy="12" r="1.2"/><path d="M10 12h8M10 14.5h5"/>',
  camip: '<path d="M3 8l12-3 2.2 6.5-12 3z"/><path d="M8 14l1 4H5M17 8l4-1.5v5L18 11"/>',
  camana: '<path d="M3 9h18"/><path d="M5 9a7 7 0 0 0 14 0"/><circle cx="12" cy="12" r="2.2"/>',
  tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M5 7h4v3H5zM10 7h4v3h-4zM15 7h4v3h-4zM5 11h4v3H5z"/>',
  pabx: '<rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.01M8 17.5h.01M12 10v4"/>',
  ramal: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M6 9V5.5A2.5 2.5 0 0 1 8.5 3H10v6M13 12h5v3h-5zM13 17.5h.01M15.5 17.5h.01M18 17.5h.01"/>',
  ata: '<rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 12.5h.01M10 12.5h.01M14 11h4v3h-4zM12 17v3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  crimp: '<path d="M4 20l6-6M10 14l2-6 4-4 4 4-4 4-6 2zM14 6l4 4"/>'
};

export const KIND_LABEL = { eth: 'RJ45', coax: 'BNC', rj11: 'RJ11', hdmi: 'HDMI' };

const P = (n, k, g) => ({ n, k, g });
const nic = (dhcp, ip = '') => ({ dhcp, ip, mask: '255.255.255.0', gw: '', dns: '' });

export const TYPES = {
  isp: { label: 'Modem ISP (operadora)', short: 'Modem',
    ports: () => [P('LAN1', 'eth', 'lan'), P('LAN2', 'eth', 'lan')],
    cfg: i => ({ provedor: ['Vivo Fibra', 'Claro Net', 'TIM Live', 'Oi Fibra'][i % 4], online: true,
      lanIp: `100.64.${10 + i}.1`, lanMask: '255.255.255.0', dhcpStart: `100.64.${10 + i}.10`, dhcpEnd: `100.64.${10 + i}.50` }) },
  router: { label: 'Roteador', short: 'Roteador',
    ports: () => [P('WAN', 'eth', 'wan'), ...[1, 2, 3, 4].map(i => P('LAN' + i, 'eth', 'lan'))],
    cfg: () => ({ wanMode: 'dhcp', wanIp: '', wanMask: '255.255.255.0', wanGw: '', lanIp: '192.168.0.1', lanMask: '255.255.255.0',
      dhcp: true, dhcpStart: '192.168.0.100', dhcpEnd: '192.168.0.199', dns: '', nat: true, routes: [] }) },
  lb: { label: 'Load Balance (dual WAN)', short: 'Load Balance',
    ports: () => [P('WAN1', 'eth', 'wan1'), P('WAN2', 'eth', 'wan2'), ...[1, 2, 3].map(i => P('LAN' + i, 'eth', 'lan'))],
    cfg: () => ({ wan1Mode: 'dhcp', wan1Ip: '', wan1Mask: '255.255.255.0', wan1Gw: '', wan2Mode: 'dhcp', wan2Ip: '', wan2Mask: '255.255.255.0', wan2Gw: '',
      mode: 'balance', w1: 50, w2: 50, primary: 'wan1', health: true, lanIp: '192.168.1.1', lanMask: '255.255.255.0',
      dhcp: true, dhcpStart: '192.168.1.100', dhcpEnd: '192.168.1.199', dns: '', nat: true, routes: [] }) },
  switch: { label: 'Switch 16 portas', short: 'Switch',
    ports: () => Array.from({ length: 16 }, (_, i) => P('P' + (i + 1), 'eth', 'sw')),
    cfg: () => ({ vlans: Array(16).fill(1), mgmtIp: '', mgmtMask: '255.255.255.0', mgmtGw: '' }) },
  pc: { label: 'Computador', short: 'PC', ports: () => [P('ETH0', 'eth', 'nic')], cfg: () => nic(true) },
  notebook: { label: 'Notebook', short: 'Notebook', ports: () => [P('ETH0', 'eth', 'nic')], cfg: () => nic(true) },
  printer: { label: 'Impressora térmica', short: 'Impressora', ports: () => [P('ETH', 'eth', 'nic')],
    cfg: () => ({ ...nic(false, '192.168.0.50'), port: 9100, papel: '80mm' }) },
  dvr: { label: 'DVR / NVR', short: 'DVR',
    ports: () => [P('LAN', 'eth', 'nic'), P('CH1', 'coax', 'v'), P('CH2', 'coax', 'v'), P('CH3', 'coax', 'v'), P('CH4', 'coax', 'v'), P('HDMI', 'hdmi', 'v')],
    cfg: () => ({ ...nic(false, '192.168.0.60'), user: 'admin', pass: 'admin123', ipch: [0, 1, 2, 3].map(() => ({ ip: '', user: 'admin', pass: '' })) }) },
  camip: { label: 'Câmera IP', short: 'Câmera IP', ports: () => [P('ETH', 'eth', 'nic')],
    cfg: () => ({ ...nic(false, '192.168.0.61'), user: 'admin', pass: '12345', res: '1080p', rtsp: 554 }) },
  camana: { label: 'Câmera analógica (AHD)', short: 'Câmera AHD', ports: () => [P('VIDEO', 'coax', 'v')], cfg: () => ({ res: '1080p' }) },
  tv: { label: 'TV de vigilância', short: 'TV', ports: () => [P('HDMI', 'hdmi', 'v')], cfg: () => ({ layout: 4 }) },
  pabx: { label: 'PABX IP (central)', short: 'PABX', ports: () => [P('ETH', 'eth', 'nic')],
    cfg: () => ({ ...nic(false, '192.168.0.10'), ramais: [{ num: '201', senha: '1234' }, { num: '202', senha: '1234' }] }) },
  ramal: { label: 'Ramal IP (telefone SIP)', short: 'Ramal', ports: () => [P('ETH', 'eth', 'nic')],
    cfg: () => ({ ...nic(true), sip: '', ramal: '', senha: '' }) },
  ata: { label: 'Adaptador ATA VoIP', short: 'ATA', ports: () => [P('ETH', 'eth', 'nic'), P('FXS1', 'rj11', 'v')],
    cfg: () => ({ ...nic(true), sip: '', ramal: '', senha: '' }) },
  phone: { label: 'Telefone analógico', short: 'Telefone', ports: () => [P('LINE', 'rj11', 'v')], cfg: () => ({}) }
};

export const CATS = {
  'Rede': ['isp', 'router', 'lb', 'switch'],
  'CFTV': ['dvr', 'camip', 'camana', 'tv'],
  'Estações': ['pc', 'notebook', 'printer'],
  'Telefonia': ['pabx', 'ramal', 'ata', 'phone']
};

export const portsOf = d => TYPES[d.type].ports();
export const ROUTERS = ['router', 'lb', 'isp'];
