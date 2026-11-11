// Dibuja placas de Instagram (1080x1350) con Chrome y controla que no falte ninguna imagen.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './util.mjs';
import { buscar } from './commons.mjs';

const UA = 'ATodoTenis/1.0 (https://atodotenis.vercel.app)';
const DIR_FOTOS = path.join(ROOT, 'static/ig/fotos');
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esJPEG = (b) => b && b.length > 8000 && b[0] === 0xff && b[1] === 0xd8;

// Foto de un jugador como data URI, o null. Usa la copia local; si no hay, la baja de Wikimedia Commons (avatares.json).
export function focoJugador(nombre) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/avatares.json'), 'utf8'))[nombre]?.foco || 'center 18%'; } catch { return 'center 18%'; }
}
export async function fotoJugador(nombre, ancho = 500) {
  if (ancho > 500) { const g = await fotoJugador(nombre + '\u0000' + ancho); if (g) return g; }
  const [nom, px] = nombre.split('\u0000');
  nombre = nom;
  const local = path.join(DIR_FOTOS, `${slug(nombre)}${px ? '-' + px : ''}.jpg`);
  if (!fs.existsSync(local)) {
    const archivoAv = path.join(ROOT, 'data/avatares.json');
    let todos = {};
    try { todos = JSON.parse(fs.readFileSync(archivoAv, 'utf8')); } catch {}
    let av = todos[nombre] || {};
    // Primero, la foto elegida a mano para Instagram (scripts/ig-fotos.json), si existe
    try { const elegida = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/ig-fotos.json'), 'utf8'))[slug(nombre)]; if (elegida?.url) av = { ...av, url: elegida.url }; } catch {}
    // Sin foto conocida: se busca en Commons y se guarda con su crédito (aparece en /creditos del sitio)
    if (!av.url) {
      const f = await buscar(nombre).catch(() => null);
      if (!f) return null;
      av = todos[nombre] = { ...f, revisado: new Date().toISOString() };
      fs.writeFileSync(archivoAv, JSON.stringify(todos, null, 1) + '\n');
    }
    const url = av.url.replace(/\/\d+px-/, `/${px || 500}px-`);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      const b = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      if (!esJPEG(b)) return null;
      fs.mkdirSync(DIR_FOTOS, { recursive: true });
      fs.writeFileSync(local, b);
    } catch { return null; }
  }
  const b = fs.readFileSync(local);
  return esJPEG(b) ? `data:image/jpeg;base64,${b.toString('base64')}` : null;
}

const fuente = (p) => `file://${path.join(ROOT, 'node_modules/@fontsource', p)}`;
export const CSS_BASE = `
@font-face{font-family:Inter;font-weight:400;src:url(${fuente('inter/files/inter-latin-400-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:800;src:url(${fuente('montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:900;font-style:italic;src:url(${fuente('montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:RC;font-weight:700;src:url(${fuente('roboto-condensed/files/roboto-condensed-latin-700-normal.woff2')})}
body{margin:0;background:#000}
.s{width:1080px;height:1350px;background:#12161B;color:#F2F4F5;font-family:Inter;position:relative;overflow:hidden}
.chip{position:absolute;left:64px;top:56px;background:#C6F432;color:#12161B;font:800 30px Montserrat;padding:12px 20px;border-radius:10px;letter-spacing:.04em}
.marca{position:absolute;right:64px;top:62px;font:italic 900 40px Montserrat;letter-spacing:-.02em}.marca b{color:#C6F432;font-weight:900}
.pie{position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;font-size:28px;color:#9AA5B1}.pie b{font:800 28px Montserrat;color:#F2F4F5}
.lima{color:#C6F432}.gris{color:#9AA5B1}
`;
export const cabecera = (chip) => `<div class="chip">${esc(chip)}</div><div class="marca">A Todo <b>Tenis</b></div>`;
export const pie = (izq, der) => `<div class="pie"><span>${izq}</span><b>${esc(der)}</b></div>`;

// Recibe el HTML de cada placa (<div class="s">…</div>) y devuelve los JPEG escritos, o null si algo falló.
export async function dibujar(placas, salidas) {
  const { chromium } = await import('playwright-core');
  const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  try {
    const p = await nav.newPage({ viewport: { width: 1080, height: 1350 } });
    const tmp = path.join(ROOT, 'node_modules', '.ig-serie.html');
    fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_BASE}</style></head><body>${placas.map((h, i) => `<div id="s${i}">${h}</div>`).join('')}</body></html>`);
    await p.goto('file://' + tmp, { waitUntil: 'networkidle', timeout: 60000 });
    await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
    // Ninguna imagen rota y todas las fuentes cargadas: si no, no se genera nada.
    const control = await p.evaluate(async () => {
      const urls = [...document.querySelectorAll('*')].map((x) => getComputedStyle(x).backgroundImage).filter((b) => b.startsWith('url(')).map((b) => b.slice(5, -2));
      const r = await Promise.all(urls.map((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0 ? 0 : 1); i.onerror = () => ok(1); i.src = u; })));
      return { rotas: r.reduce((a, b) => a + b, 0), fuentes: [...document.fonts].filter((f) => f.status !== 'loaded').length };
    });
    if (control.rotas || control.fuentes) { log('Placa descartada: imágenes rotas', control.rotas, 'fuentes sin cargar', control.fuentes); return null; }
    for (let i = 0; i < placas.length; i++) {
      fs.mkdirSync(path.dirname(salidas[i]), { recursive: true });
      await p.locator(`#s${i} > .s`).screenshot({ path: salidas[i], type: 'jpeg', quality: 92 });
    }
    return salidas;
  } catch (err) { log('No se pudo dibujar:', err.message); return null; }
  finally { await nav.close(); }
}
