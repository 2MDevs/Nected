// Missões de treino. As conclusões ficam em store.S.missions.
import { store } from '../core/store.js';
import { tvSource, dvrFeeds } from '../core/network.js';

export const MISSIONS = [
  ['crimp', 'Crimpe um cabo direto T568B nas duas pontas (Bancada de crimpagem)'],
  ['ping', 'Faça um computador pingar 8.8.8.8'],
  ['dns', 'Resolva google.com (nslookup google.com)'],
  ['tv', 'Mostre 2 câmeras ao vivo na TV de vigilância'],
  ['print', 'Imprima um cupom pela rede (print <ip> no PC)'],
  ['call', 'Faça uma ligação entre dois ramais'],
  ['failover', 'Com o LB em failover, derrube a operadora principal e continue com internet']
];

/** Verifica missões que dependem do estado (não de uma ação). */
export function checkMissions() {
  const S = store.S;
  for (const tv of S.devs.filter(d => d.type === 'tv')) {
    const s = tvSource(tv);
    if (s.dvr && dvrFeeds(s.dvr).filter(f => f.cam).length >= 2) S.missions.tv = 1;
  }
  return MISSIONS.filter(m => S.missions[m[0]]).length;
}
