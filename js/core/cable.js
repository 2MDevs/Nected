// Crimpagem RJ45: padrões T568A/B e avaliação do cabo montado.

export const WNAME = { wo: 'Branco-laranja', o: 'Laranja', wg: 'Branco-verde', bl: 'Azul', wbl: 'Branco-azul', g: 'Verde', wbr: 'Branco-marrom', br: 'Marrom' };
export const T568B = ['wo', 'o', 'wg', 'bl', 'wbl', 'g', 'wbr', 'br'];
export const T568A = ['wg', 'g', 'wo', 'bl', 'wbl', 'o', 'wbr', 'br'];
export const CABLE_RES = { direto: 'Direto', crossover: 'Crossover', split: 'Pares trocados', defeituoso: 'Defeituoso' };

const eq = (x, y) => x.every((v, i) => v === y[i]);
const std = x => (eq(x, T568B) ? 'T568B' : eq(x, T568A) ? 'T568A' : null);

/**
 * a, b: arrays de 8 cores (pino 1..8) ou null em pino vazio.
 * Retorna { type: direto|crossover|split|defeituoso, detail, map, std? }
 * map[i] = pino da ponta B que recebe o fio do pino i+1 da ponta A (0 = sem continuidade).
 */
export function evalCable(a, b) {
  if (a.includes(null) || b.includes(null)) return { type: 'defeituoso', detail: 'Há pinos sem fio — o conector ficou incompleto.', map: a.map(c => (c ? b.indexOf(c) + 1 : 0)) };
  const sa = std(a), sb = std(b), map = a.map(c => b.indexOf(c) + 1);
  if (sa && sb) return sa === sb
    ? { type: 'direto', std: sa, map, detail: `${sa} nas duas pontas → cabo DIRETO (patch cord). Uso: PC↔switch, roteador↔switch, câmera↔switch.` }
    : { type: 'crossover', map, detail: `${sa} × ${sb} → cabo CROSSOVER. Uso clássico: PC↔PC ou switch↔switch sem Auto-MDIX.` };
  if (eq(a, b)) {
    const fam = c => c.replace(/^w/, '');
    const pairsOk = [[0, 1], [2, 5], [3, 4], [6, 7]].every(([x, y]) => fam(a[x]) === fam(a[y]));
    if (pairsOk) return { type: 'direto', map, detail: 'Ordem fora da norma, mas os pares estão nos pinos certos (1-2, 3-6, 4-5, 7-8). Funciona — porém padronize em T568B.' };
    return { type: 'split', map, detail: 'O testador acende 1→1 … 8→8, mas os pares trançados foram separados (split pair). O link sobe com interferência: perda de pacotes e lentidão.' };
  }
  const wrong = map.map((m, i) => (m !== i + 1 ? i + 1 : null)).filter(Boolean);
  return { type: 'defeituoso', map, detail: `Pinos cruzados/invertidos: ${wrong.join(', ')}. O testador acende fora de ordem — corte o conector e refaça.` };
}
