// Reel vertical (1080x1920) de datos animados: cada escena es una foto con zoom lento y un texto encima.
//   node scripts/ig-reel.mjs <archivo-de-guion.json> <salida.mp4>
// Guion: { "escenas": [ { "foto": "static/ig/fotos/x-1280.jpg" | null, "foco": "center 20%", "segundos": 1.6, "html": "<div>…</div>" } ] }
// Antes de armar el video se controla que todas las fotos existan y que el texto se haya dibujado con sus fuentes.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, log } from './lib/util.mjs';
import { CSS_BASE } from './lib/ig-render.mjs';

const [guionArchivo, salida] = process.argv.slice(2);
const guion = JSON.parse(fs.readFileSync(guionArchivo, 'utf8'));
const W = 1080, H = 1920, FPS = 30;
const tmp = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.reel-'));

for (const e of guion.escenas) if (e.foto && !fs.existsSync(path.join(ROOT, e.foto))) { console.error('Falta la foto', e.foto); process.exit(1); }

// 1) Capas de texto con fondo transparente
const { chromium } = await import('playwright-core');
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
const p = await nav.newPage({ viewport: { width: W, height: H } });
const css = CSS_BASE.replace('body{margin:0;background:#000}', 'body{margin:0;background:transparent}') +
  `.capa{width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:Inter;color:#F2F4F5}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${guion.escenas.map((e, i) => `<div id="c${i}" class="capa">${e.html}</div>`).join('')}</body></html>`;
const pag = path.join(tmp, 'capas.html');
fs.writeFileSync(pag, html);
await p.goto('file://' + pag, { waitUntil: 'networkidle' });
await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
const sinCargar = await p.evaluate(() => [...document.fonts].filter((f) => f.status !== 'loaded').length);
if (sinCargar) { console.error('Fuentes sin cargar:', sinCargar); process.exit(1); }
for (let i = 0; i < guion.escenas.length; i++) await p.locator(`#c${i}`).screenshot({ path: path.join(tmp, `t${i}.png`), omitBackground: true });
await nav.close();

// 2) Cada escena: foto con zoom lento (o fondo liso) + texto que entra con un fundido
const partes = [];
guion.escenas.forEach((e, i) => {
  const d = e.segundos || 1.6, n = Math.round(d * FPS), out = path.join(tmp, `e${i}.mp4`);
  const fondo = e.foto
    ? ['-i', path.join(ROOT, e.foto)]
    : ['-f', 'lavfi', '-t', String(d), '-i', `color=c=0x12161B:s=${W}x${H}:r=${FPS}`];
  const [fx, fy] = (e.foco || 'center 20%').split(' ');
  const y = fy?.endsWith('%') ? Number(fy.slice(0, -1)) / 100 : 0.2;
  const zoom = e.foto
    ? `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}:(iw-ow)/2:(ih-oh)*${y},zoompan=z='1+0.06*on/${n}':x='iw/2-(iw/zoom/2)':y='ih*${y}-(ih/zoom*${y})':d=${n}:s=${W}x${H}:fps=${FPS},format=yuv420p[f];`
    : '[0:v]format=yuv420p[f];';
  const filtro = `${zoom}[1:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[t];[f][t]overlay=0:0:format=auto,format=yuv420p[v]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...fondo, '-loop', '1', '-t', String(d), '-i', path.join(tmp, `t${i}.png`),
    '-filter_complex', filtro, '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', out]);
  partes.push(out);
});

// 3) Unir las escenas
const lista = path.join(tmp, 'lista.txt');
fs.writeFileSync(lista, partes.map((x) => `file '${x}'`).join('\n'));
fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), path.resolve(salida)]);
fs.rmSync(tmp, { recursive: true, force: true });
log('Reel listo:', salida);
