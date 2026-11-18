// Cenário exemplo: loja com 2 operadoras, Load Balance, CFTV e VoIP — com 2 defeitos plantados.
import { store, blank, addDev, addLink } from './store.js';

export function buildSample() {
  store.S = blank('Loja exemplo');
  const A = (t, x, y, o) => addDev(t, x, y, o);
  const i1 = A('isp', 420, 0, { name: 'Modem Vivo' }), i2 = A('isp', 780, 0, { name: 'Modem Claro' });
  const lb = A('lb', 600, 150, { cfg: { mode: 'balance', w1: 70, w2: 30 } });
  const sw = A('switch', 600, 310, { name: 'Switch Rack' });
  const pc = A('pc', 120, 470, { name: 'PC Caixa' });
  const nb = A('notebook', 330, 560, { name: 'Notebook Gerência' });
  const pr = A('printer', 560, 620, { name: 'Térmica Cozinha', cfg: { ip: '192.168.1.50', gw: '192.168.1.1' } });
  const dvr = A('dvr', 830, 520, { cfg: { ip: '192.168.1.60', gw: '192.168.1.1',
    ipch: [{ ip: '192.168.1.61', user: 'admin', pass: '12345' }, { ip: '', user: 'admin', pass: '' }, { ip: '', user: 'admin', pass: '' }, { ip: '', user: 'admin', pass: '' }] } });
  // Defeito 1: senha da câmera diferente da cadastrada no DVR.
  const cip = A('camip', 1080, 400, { name: 'Câmera Salão', cfg: { ip: '192.168.1.61', gw: '192.168.1.1', pass: 'Adm@2024' } });
  const cana = A('camana', 1080, 640, { name: 'Câmera Estoque' });
  const tv = A('tv', 830, 720, { name: 'TV Balcão' });
  const pbx = A('pabx', 1080, 250, { cfg: { ip: '192.168.1.10', gw: '192.168.1.1',
    ramais: [{ num: '201', senha: '1234' }, { num: '202', senha: '1234' }, { num: '203', senha: '1234' }] } });
  const rm = A('ramal', 200, 300, { name: 'Ramal Recepção', cfg: { sip: '192.168.1.10', ramal: '201', senha: '1234' } });
  // Defeito 2: senha SIP do ATA errada.
  const ata = A('ata', 150, 160, { cfg: { sip: '192.168.1.10', ramal: '202', senha: '4321' } });
  const ph = A('phone', -110, 160, { name: 'Telefone Cozinha' });

  addLink(i1.id, 0, lb.id, 0); addLink(i2.id, 0, lb.id, 1); addLink(lb.id, 2, sw.id, 0);
  [pc, nb, pr, dvr, cip, pbx, rm, ata].forEach((d, i) => addLink(sw.id, i + 1, d.id, 0));
  addLink(dvr.id, 1, cana.id, 0); addLink(dvr.id, 5, tv.id, 0); addLink(ata.id, 1, ph.id, 0);
  return store.S;
}
