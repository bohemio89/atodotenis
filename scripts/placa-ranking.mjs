// Placa "Ranking ATP / WTA · Top 10" para las notas de ranking (estilo de la nota del 16/11/2026).
// ATP en azul y lima, WTA en violeta y amarillo. 1080x1350, en español y en inglés.
//   node scripts/placa-ranking.mjs atp|wta [es|en] [fecha AAAA-MM-DD] [salida.jpg]
// Datos: ranking oficial guardado en data/jugadores.json (puesto, puntos y cambio de la semana).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, IOC_ISO2, conGrafia } from './lib/util.mjs';
import { fotoJugador as fotoRemota, focoJugador, esc as esc0 } from './lib/ig-render.mjs';

const tour = (process.argv[2] || 'atp').toLowerCase();
const lang = process.argv[3] === 'en' ? 'en' : 'es';
const fecha = process.argv[4] || new Date().toISOString().slice(0, 10);
const salida = process.argv[5] || path.join(ROOT, 'static/notas', `ranking-${tour}-${fecha}${lang === 'en' ? '-en' : ''}.jpg`);
const esc = (t) => esc0(conGrafia(t));

const TEMAS = {
  atp: { fondo: 'radial-gradient(70% 30% at 15% 22%,rgba(120,190,255,.45),transparent 60%),radial-gradient(70% 30% at 85% 22%,rgba(120,190,255,.45),transparent 60%),radial-gradient(100% 70% at 50% 50%,#0B4BC4,#062A7A 60%,#03154A)', acento: '#D7FF2E', sombra: '#04205E', chispa: '#D7FF2E', marco: '#2EA8FF', pill: '#C6F432', pillTxt: '#0A1A40', fila: 'rgba(10,60,170,.85)', borde: '#2EA8FF', gris: '#A9C6F5', velo: 'rgba(3,21,74,.95)' },
  wta: { fondo: 'radial-gradient(60% 28% at 15% 20%,rgba(255,255,255,.35),transparent 60%),radial-gradient(60% 28% at 85% 20%,rgba(255,255,255,.35),transparent 60%),radial-gradient(100% 70% at 50% 50%,#4A1FA8,#24105E 60%,#12072F)', acento: '#FFE11A', sombra: '#2A0A5E', chispa: '#FFB347', marco: '#A855F7', pill: '#FFE11A', pillTxt: '#2A0A5E', fila: 'rgba(91,33,182,.8)', borde: '#A855F7', gris: '#C4B5FD', velo: 'rgba(18,7,47,.96)' },
};
const T = TEMAS[tour];
if (!T) { log('Circuito desconocido:', tour); process.exit(1); }

const lista = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/jugadores.json'), 'utf8')).lista || {})
  .filter((j) => j.tour === tour && j.ranking).sort((a, b) => a.ranking - b.ranking).slice(0, 10);
if (lista.length < 10) { log('Ranking incompleto, no se arma la placa.'); process.exit(1); }

const d = new Date(`${fecha}T12:00:00Z`);
const MES = { es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
const DIA = { es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const fechaTxt = lang === 'en' ? `${DIA.en[d.getUTCDay()]}, ${MES.en[d.getUTCMonth()]} ${d.getUTCDate()}` : `${DIA.es[d.getUTCDay()]} ${d.getUTCDate()} de ${MES.es[d.getUTCMonth()]}`;
const puntos = (n) => Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'es-AR');

const slugN = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
async function foto(n, ancho) {
  for (const c of [`${slugN(n)}-1280.jpg`, `${slugN(n)}.jpg`]) { const f = path.join(ROOT, 'static/ig/fotos', c); if (fs.existsSync(f)) return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'); }
  return fotoRemota(n, ancho);
}
const bandera = (p) => { const iso = IOC_ISO2[String(p || '').toLowerCase()]; const f = iso && path.join(ROOT, 'static/banderas', `${iso}.svg`); return f && fs.existsSync(f) ? 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64') : null; };
const imgBandera = (p, w, h) => { const b = bandera(p); return b ? `<img src="${b}" style="width:${w}px;height:${h}px;border-radius:4px;flex:none">` : `<span style="width:${w}px;flex:none"></span>`; };
const fnt = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', f)).toString('base64');
const mov = (c) => c > 0 ? `<span style="color:#3DF06B">▲<b style="font-size:.9em;margin-left:4px">${c}</b></span>` : c < 0 ? `<span style="color:#FF5A5A">▼<b style="font-size:.9em;margin-left:4px">${-c}</b></span>` : `<span style="color:${T.gris}">=</span>`;

const css = `@font-face{font-family:RCI;font-weight:900;font-style:italic;src:url(${fnt('roboto-condensed/files/roboto-condensed-latin-900-italic.woff2')})}
@font-face{font-family:RC;font-weight:700;src:url(${fnt('roboto-condensed/files/roboto-condensed-latin-700-normal.woff2')})}
*{margin:0;box-sizing:border-box}body{width:1080px;height:1350px;overflow:hidden;font-family:RC;color:#fff}
.t{font-family:RCI;font-weight:900;font-style:italic;text-transform:uppercase;line-height:.9}
.am{color:${T.acento};text-shadow:0 5px 0 ${T.sombra};-webkit-text-stroke:2px ${T.sombra};paint-order:stroke fill}
.bl{text-shadow:0 5px 0 ${T.sombra};-webkit-text-stroke:2px ${T.sombra};paint-order:stroke fill}`;
const chispas = Array.from({ length: 50 }, (_, i) => `<div style="position:absolute;left:${(i * 211) % 1080}px;top:${(i * 331) % 1350}px;width:5px;height:5px;border-radius:50%;background:${T.chispa};box-shadow:0 0 10px ${T.chispa};opacity:.8"></div>`).join('');

const [p1, ...resto] = lista;
const f1 = await foto(p1.nombre, 1280);
let filas = '';
for (const j of resto) {
  const f = await foto(j.nombre, 500);
  filas += `<div style="display:flex;align-items:center;gap:20px;height:70px;margin-top:6px;padding:0 26px;background:linear-gradient(90deg,${T.fila},rgba(0,0,0,.25));border-left:7px solid ${j.cambio ? T.acento : T.borde};transform:skewX(-6deg)">
<span class="t ${j.cambio ? 'am' : 'bl'}" style="width:70px;font-size:44px;transform:skewX(6deg)">${j.ranking}</span>
<div style="width:58px;height:58px;border-radius:50%;background:#223 ${f ? `url('${f}') ${focoJugador(j.nombre)}/cover` : ''};border:3px solid ${T.acento};flex:none"></div>
${imgBandera(j.pais, 36, 27)}
<span class="t bl" style="flex:1;font-size:40px;white-space:nowrap">${esc(j.nombre.split(' ').slice(-1)[0])}</span>
<span style="font:700 26px RC;color:${T.gris};width:120px;text-align:right">${puntos(j.puntos)}</span>
<span class="t" style="width:90px;text-align:right;font-size:40px">${mov(j.cambio)}</span></div>`;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div style="position:absolute;inset:0;background:${T.fondo}"></div>${chispas}
<div style="position:absolute;inset:18px;border:4px solid ${T.marco};box-shadow:0 0 30px ${T.marco},inset 0 0 30px ${T.marco};border-radius:6px"></div>
<div style="position:absolute;top:40px;left:0;right:0;text-align:center"><div class="t bl" style="font-size:92px">${lang === 'en' ? `<span class="am">${tour.toUpperCase()}</span> Rankings` : `Ranking <span class="am">${tour.toUpperCase()}</span>`}</div>
<div style="display:inline-block;margin-top:10px;background:${T.pill};color:${T.pillTxt};padding:6px 40px;border-radius:14px;transform:skewX(-8deg)"><span class="t" style="font-size:38px">Top 10</span></div>
<div class="t bl" style="font-size:34px;margin-top:8px">${esc(fechaTxt)}</div></div>
<div style="position:absolute;top:262px;left:60px;right:60px;height:250px;border-radius:14px;overflow:hidden;background:${T.velo};border:4px solid ${T.acento};box-shadow:0 0 40px ${T.marco}">
${f1 ? `<div style="position:absolute;right:0;top:0;bottom:0;width:470px;background:url('${f1}') ${focoJugador(p1.nombre)}/cover"></div><div style="position:absolute;inset:0;background:linear-gradient(90deg,${T.velo} 48%,rgba(0,0,0,0) 72%)"></div>` : ''}
<div style="position:absolute;left:36px;top:24px"><div class="t am" style="font-size:100px">${lang === 'en' ? 'No. 1' : 'N° 1'}</div>
<div style="display:flex;align-items:center;gap:16px;margin-top:14px">${imgBandera(p1.pais, 54, 40)}<span class="t bl" style="font-size:${p1.nombre.length > 18 ? 44 : 52}px;white-space:nowrap">${esc(p1.nombre)}</span></div>
<div style="font:700 36px RC;margin-top:12px;color:#fff">${puntos(p1.puntos)} ${lang === 'en' ? 'points' : 'puntos'} &nbsp;<span class="t" style="font-size:44px">${mov(p1.cambio)}</span></div></div></div>
<div style="position:absolute;top:522px;left:60px;right:60px">${filas}</div>
<div style="position:absolute;bottom:30px;left:0;right:0;text-align:center"><span class="t bl" style="font-size:50px">A Todo </span><span class="t am" style="font-size:50px">Tenis</span><span style="display:inline-block;width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#E8FF6A,#C6F432 60%,#8DB015);margin-left:10px;vertical-align:-4px;box-shadow:0 0 16px #C6F432"></span></div>
</body></html>`;

const tmp = path.join(ROOT, 'node_modules', '.placa-ranking.html');
fs.writeFileSync(tmp, html);
const { chromium } = await import('playwright-core');
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
try {
  const p = await nav.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const rotas = await p.evaluate(async () => {
    const u = [...document.querySelectorAll('div')].map((x) => getComputedStyle(x).backgroundImage).filter((b) => b.startsWith('url(')).map((b) => b.slice(5, -2));
    const r = await Promise.all(u.map((x) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(0); i.onerror = () => ok(1); i.src = x; })));
    return r.reduce((a, b) => a + b, 0) + [...document.images].filter((i) => !i.naturalWidth).length;
  });
  if (rotas) throw new Error(`imágenes rotas: ${rotas}`);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  await p.screenshot({ path: salida, type: 'jpeg', quality: 92 });
  log('Placa lista:', path.relative(ROOT, salida));
} finally { await nav.close(); }
