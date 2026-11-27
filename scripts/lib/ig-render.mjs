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
    // Fotos cargadas a mano solo para el sitio (sin licencia para redes): Instagram no las usa
    if (av.soloSitio) return null;
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


// Tamaño real de un JPEG (ancho, alto), leyendo su encabezado.
export function medidasJPEG(b) {
  let i = 2;
  while (b && i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], largo = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  return null;
}

// Foto elegida a mano en Commons (por ejemplo, la de una efeméride), bajada al ancho pedido y guardada.
// Devuelve { data, ancho, alto } o null. No hay estiramiento: si Commons no la tiene a ese ancho, no sirve.
export async function fotoElegida(url, clave, ancho = 1600) {
  const local = path.join(DIR_FOTOS, `${clave}-${ancho}.jpg`);
  if (!fs.existsSync(local)) {
    const archivo = decodeURIComponent(String(url).split('?')[0].split('/').pop());
    const directa = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(archivo)}?width=${ancho}`;
    try {
      const r = await fetch(directa, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      const b = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      if (!esJPEG(b)) return null;
      fs.mkdirSync(DIR_FOTOS, { recursive: true });
      fs.writeFileSync(local, b);
    } catch { return null; }
  }
  const b = fs.readFileSync(local);
  const m = medidasJPEG(b);
  return esJPEG(b) && m ? { data: `data:image/jpeg;base64,${b.toString('base64')}`, ...m } : null;
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
// ---------- Diseño v2 (desde nov 2026): foto protagonista, cajas inclinadas azul marino y dorado, Barlow Condensed ----------
const ORO = 'linear-gradient(180deg,#F8DD95 0%,#D3A443 55%,#A87C25 100%)';
export const CSS_V2 = `
@font-face{font-family:BC;font-weight:900;font-style:italic;src:url(${fuente('barlow-condensed/files/barlow-condensed-latin-900-italic.woff2')})}
@font-face{font-family:BC;font-weight:800;font-style:italic;src:url(${fuente('barlow-condensed/files/barlow-condensed-latin-800-italic.woff2')})}
@font-face{font-family:BC;font-weight:700;src:url(${fuente('barlow-condensed/files/barlow-condensed-latin-700-normal.woff2')})}
@font-face{font-family:Inter;font-weight:700;src:url(${fuente('inter/files/inter-latin-700-normal.woff2')})}
.s.n{background:radial-gradient(120% 70% at 50% 0%,#1D3352,#0B1320 70%);box-sizing:border-box}.s.n *{box-sizing:border-box}
.nfoto{position:absolute;left:0;right:0;top:0;background-size:cover;background-repeat:no-repeat}
.nsombra{position:absolute;left:0;right:0;top:0;background:linear-gradient(180deg,rgba(6,10,18,.55) 0%,rgba(6,10,18,0) 18%,rgba(6,10,18,0) 55%,rgba(11,19,32,.92) 85%,#0B1320 100%)}
.nlogo{position:absolute;left:0;top:0;width:230px;height:210px;background:${ORO};clip-path:polygon(0 0,100% 0,72% 100%,0 100%);z-index:5}
.nlogo b{position:absolute;left:34px;top:40px;font:900 italic 54px/0.86 BC;color:#0B1320;letter-spacing:.01em}
.nlogo i{position:absolute;left:34px;top:150px;width:56px;height:10px;background:#0B1320}
.ncont{position:absolute;right:44px;top:44px;z-index:5;background:rgba(11,19,32,.75);border:2px solid rgba(217,178,94,.5);border-radius:40px;padding:8px 24px;font:700 30px BC;color:#fff}
.netq{display:inline-block;background:${ORO};color:#0B1320;font:900 italic 38px/1 BC;padding:14px 26px;letter-spacing:.03em;transform:skewX(-10deg);text-transform:uppercase}
.netq span{display:inline-block;transform:skewX(10deg)}
.ncaja{position:relative;background:linear-gradient(160deg,#1E3350 0%,#16263C 45%,#0B1320 100%);color:#fff;border:5px solid #D9B25E;padding:28px 40px 32px;transform:skewX(-6deg);box-shadow:16px 16px 0 #A87C25,0 30px 60px rgba(0,0,0,.55)}
.ncaja h1{margin:0;transform:skewX(6deg);font:900 italic 100px/0.92 BC;text-transform:uppercase;text-align:center}
.ncaja.oro{background:${ORO};color:#0B1320;border-color:#F8DD95;box-shadow:16px 16px 0 #16263C,0 30px 60px rgba(0,0,0,.55)}
.nbarra{position:absolute;left:0;right:0;bottom:0;height:92px;background:linear-gradient(90deg,#16263C,#0B1320);border-top:6px solid #D9B25E;clip-path:polygon(140px 0,100% 0,100% 100%,0 100%,0 60%);z-index:5}
.nbarra span{position:absolute;right:44px;bottom:22px;font:800 italic 40px BC;color:#E2B85C;letter-spacing:.04em}
.nbarra em{position:absolute;left:170px;bottom:26px;font:700 28px BC;color:#9AA5B1;font-style:normal;letter-spacing:.06em;text-transform:uppercase}
.ncred{position:absolute;left:44px;right:44px;bottom:104px;font:400 19px Inter;color:#8E9BAD;z-index:4}
.noro{background:${ORO};-webkit-background-clip:text;background-clip:text;color:transparent}
.ndor{color:#E2B85C}.ngris{color:#9AA5B1}
.ntarj{background:linear-gradient(180deg,#17263C,#0E1828);border:2px solid #2A3B54;border-top:6px solid #D9B25E}
`;
// Marco común: bloque de marca, contador n/total, crédito opcional y barra inferior con el usuario
export const marco = (n, total, cred = '', aviso = '') => `<div class="nlogo"><b>A TODO<br>TENIS</b><i></i></div><div class="ncont">${n}/${total}</div>${cred ? `<div class="ncred">${cred}</div>` : ''}<div class="nbarra">${aviso ? `<em>${esc(aviso)}</em>` : ''}<span>@ATODOTENIS_WEB</span></div>`;
// Caja de título inclinada; el tamaño baja solo con textos largos
export const caja = (txt, { size, oro = false } = {}) => { const t = String(txt); const z = size || (t.length <= 22 ? 112 : t.length <= 40 ? 96 : t.length <= 60 ? 82 : 70); return `<div class="ncaja${oro ? ' oro' : ''}"><h1 style="font-size:${z}px">${esc(t)}</h1></div>`; };
export const etiqueta = (txt) => `<div class="netq"><span>${esc(txt)}</span></div>`;
export const fondoFoto = (url, foco = 'center 30%', alto = 1000) => `<div class="nfoto" style="height:${alto}px;background-image:url('${url}');background-position:${foco}"></div><div class="nsombra" style="height:${alto}px"></div>`;

export const cabecera = (chip) => `<div class="chip">${esc(chip)}</div><div class="marca">A Todo <b>Tenis</b></div>`;
export const pie = (izq, der) => `<div class="pie"><span>${izq}</span><b>${esc(der)}</b></div>`;

// Recibe el HTML de cada placa (<div class="s">…</div>) y devuelve los JPEG escritos, o null si algo falló.
export async function dibujar(placas, salidas) {
  const { chromium } = await import('playwright-core');
  const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  try {
    const p = await nav.newPage({ viewport: { width: 1080, height: 1350 } });
    const tmp = path.join(ROOT, 'node_modules', '.ig-serie.html');
    fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_BASE}${placas.some((h) => h.includes('class="s n')) ? CSS_V2 : ''}</style></head><body>${placas.map((h, i) => `<div id="s${i}">${h}</div>`).join('')}</body></html>`);
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
      await p.locator(`#s${i} > .s`).screenshot({ path: salidas[i], type: 'jpeg', quality: 95 });
    }
    return salidas;
  } catch (err) { log('No se pudo dibujar:', err.message); return null; }
  finally { await nav.close(); }
}
