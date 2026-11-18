// Persistência local de vários laboratórios (localStorage). Funciona sem armazenamento — só não salva.
import { normalize } from './store.js';

const LS = (() => {
  try { const t = '__nected'; localStorage.setItem(t, t); localStorage.removeItem(t); return localStorage; } catch (e) { return null; }
})();

const K_INDEX = 'nected:labs', K_CUR = 'nected:current', K_LAB = id => 'nected:lab:' + id, K_LEGACY = 'nected:v1';
const read = (k, def) => { try { const v = LS && LS.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
const write = (k, v) => { try { LS && LS.setItem(k, JSON.stringify(v)); return !!LS; } catch (e) { return false; } };

export const persist = {
  available: !!LS,
  list() { return read(K_INDEX, []).sort((a, b) => b.updated - a.updated); },
  load(id) { const o = read(K_LAB(id), null); return o ? normalize(o) : null; },
  save(S) {
    const ok = write(K_LAB(S.id), S);
    const idx = read(K_INDEX, []).filter(x => x.id !== S.id);
    idx.push({ id: S.id, name: S.name, updated: Date.now(), devs: S.devs.length });
    write(K_INDEX, idx); write(K_CUR, S.id);
    return ok;
  },
  remove(id) { try { LS && LS.removeItem(K_LAB(id)); } catch (e) {} write(K_INDEX, read(K_INDEX, []).filter(x => x.id !== id)); },
  current() {
    const id = read(K_CUR, null);
    if (id) { const S = this.load(id); if (S) return S; }
    const legacy = read(K_LEGACY, null); // migra o protótipo v1
    if (legacy && legacy.devs) { const S = normalize(legacy); this.save(S); try { LS.removeItem(K_LEGACY); } catch (e) {} return S; }
    const first = this.list()[0];
    return first ? this.load(first.id) : null;
  }
};
