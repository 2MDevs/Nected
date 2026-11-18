// Utilitários IPv4 — puros, sem DOM.

export function ip2n(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').trim());
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some(x => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export const n2ip = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function sameNet(a, b, m) {
  const A = ip2n(a), B = ip2n(b), M = ip2n(m);
  if (A == null || B == null || M == null) return false;
  return ((A & M) >>> 0) === ((B & M) >>> 0);
}

export function maskBits(m) {
  const n = ip2n(m);
  if (n == null) return '?';
  let c = 0;
  for (let i = 31; i >= 0; i--) { if (n & (1 << i)) c++; else break; }
  return c;
}

export function netOf(ip, mask) {
  const A = ip2n(ip), M = ip2n(mask);
  if (A == null || M == null) return null;
  return n2ip((A & M) >>> 0);
}

// Redes privadas RFC 1918 + APIPA. (100.64/10 — CGNAT — é tratado como "público" do ponto de vista da LAN.)
export function isPrivate(ip) {
  const n = ip2n(ip);
  if (n == null) return false;
  const a = n >>> 24, b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const macOf = (key, sep = ':') =>
  ['00', '47', '50', ...(hash(key) & 0xffffff).toString(16).padStart(6, '0').match(/../g)].join(sep);
