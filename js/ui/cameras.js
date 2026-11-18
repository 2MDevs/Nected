// Imagem "ao vivo" simulada das câmeras (canvas.cam em qualquer janela).
import { hash } from '../core/ip.js';

let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (now - last < 70) return;
  last = now;
  document.querySelectorAll('canvas.cam').forEach(cv => {
    if (!cv.offsetParent) return;
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, s = hash(cv.dataset.cam), hue = s % 360;
    x.fillStyle = `hsl(${hue},16%,24%)`; x.fillRect(0, 0, w, h);
    x.fillStyle = `hsl(${hue},10%,32%)`; x.beginPath(); x.moveTo(0, h * 0.62); x.lineTo(w, h * 0.52); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    x.fillStyle = `hsl(${(hue + 40) % 360},14%,38%)`; x.fillRect(w * (0.1 + (s % 5) / 20), h * 0.22, w * 0.13, h * 0.4);
    x.fillStyle = `hsl(${(hue + 180) % 360},12%,30%)`; x.fillRect(w * 0.62, h * 0.3, w * 0.22, h * 0.18);
    const px = (Math.sin(now / 2200 + s) * 0.38 + 0.5) * w, py = h * 0.5 + Math.sin(now / 1300 + s) * h * 0.05;
    x.fillStyle = '#cfcfcf'; x.beginPath(); x.arc(px, py, h * 0.05, 0, 7); x.fill(); x.fillRect(px - h * 0.04, py + h * 0.05, h * 0.08, h * 0.18);
    for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.font = `${Math.round(h / 11)}px JetBrains Mono, monospace`; x.fillStyle = '#fff';
    x.fillText(cv.dataset.label, 5, h / 9);
    const t = new Date().toLocaleTimeString('pt-BR'); x.fillText(t, w - x.measureText(t).width - 5, h - 5);
    if (Math.floor(now / 600) % 2) { x.fillStyle = '#ff3b3b'; x.beginPath(); x.arc(w - 8, 8, 3.5, 0, 7); x.fill(); }
  });
}
export const startCameras = () => requestAnimationFrame(loop);
