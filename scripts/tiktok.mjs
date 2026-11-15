// Videos para TikTok: cada resultado importante con foto revisada del ganador se convierte en un video vertical
// de ~9 segundos, con los textos dentro de la zona libre de TikTok. Quedan en /tiktok (página sin indexar)
// para descargarlos y programarlos. TikTok no permite publicar por API sin app aprobada.
//   node scripts/tiktok.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, leerJSON, log } from './lib/util.mjs';
import { fotoJugador, focoJugador, esc, slug } from './lib/ig-render.mjs';

const MAX_POR_DIA = 2, HORAS = 36, DIAS_GUARDAR = 1, IMPORTANCIA_MIN = 50;
const ESTADO = path.join(ROOT, 'data/tiktok.json');
const estado = leerJSON('data/tiktok.json', { videos: [] });
const hoy = new Date().toISOString().slice(0, 10);

// Limpieza: los videos de más de 10 días se borran (ya se publicaron o perdieron vigencia)
estado.videos = estado.videos.filter((v) => {
  const viejo = Date.now() - new Date(v.fecha).getTime() > DIAS_GUARDAR * 864e5;
  if (viejo) {
    fs.rmSync(path.join(ROOT, 'static', v.video), { force: true });
    if (v.imagen) fs.rmSync(path.join(ROOT, 'static', v.imagen), { force: true });
    for (const imagen of v.imagenes || []) fs.rmSync(path.join(ROOT, 'static', imagen), { force: true });
  }
  return !viejo;
});

const hechos = new Set(estado.videos.map((v) => v.slug));
const notas = fs.readdirSync(path.join(ROOT, 'content/notas')).filter((f) => f.endsWith('.json'))
  .map((f) => leerJSON(`content/notas/${f}`, null)).filter(Boolean)
  .filter((n) => n.estado === 'publicada' && typeof n.resultado === 'object' && n.resultado?.ganador?.nombre && n.resultado?.sets?.length)
  .filter((n) => Date.now() - new Date(n.fecha).getTime() < HORAS * 3600e3 && (n.importancia || 0) >= IMPORTANCIA_MIN && !hechos.has(n.slug))
  .sort((a, b) => (b.importancia || 0) - (a.importancia || 0));

let deHoy = estado.videos.filter((v) => v.fecha.slice(0, 10) === hoy).length;
const overlay = (fondo) => `<div style="position:absolute;inset:0;background:linear-gradient(rgba(4,8,20,.28),rgba(4,8,20,.04) 22%,rgba(4,8,20,.78) 55%,${fondo} 72%)"></div>`;
const marca = (acento) => `<div class="marca" style="top:72px;right:120px;color:#fff">A Todo <b style="color:${acento}">Tenis</b></div>`;
const chip = (texto, top, tema) => `<div class="chip" style="top:${top}px;background:${tema.primario};color:#fff;box-shadow:0 0 24px ${tema.brillo}88">${esc(texto)}</div>`;
const ape = (s) => String(s).trim().split(/\s+/).slice(-1)[0];

function temaTorneo(nombre, esWTA) {
  const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const temas = [
    [/wta finals/, { fondo:'#17072D', panel:'#2A1048', primario:'#8B45D6', brillo:'#C17BFF', acento:'#D9FF42' }],
    [/atp finals|nitto/, { fondo:'#06152E', panel:'#10294B', primario:'#087BFF', brillo:'#39B9FF', acento:'#D9FF42' }],
    [/indian wells/, { fondo:'#24103B', panel:'#3B1D5A', primario:'#8F4BCB', brillo:'#F4A14D', acento:'#D9FF42' }],
    [/roland garros|french open/, { fondo:'#291009', panel:'#4A2117', primario:'#D9572B', brillo:'#FF9C53', acento:'#F8E4BD' }],
    [/wimbledon/, { fondo:'#071F18', panel:'#123D2B', primario:'#6C3D91', brillo:'#B58BDB', acento:'#E1EBAA' }],
    [/us open/, { fondo:'#07152D', panel:'#142A4A', primario:'#D9364B', brillo:'#FF7180', acento:'#F4D36B' }],
    [/australian open/, { fondo:'#061A43', panel:'#0B3470', primario:'#009DD8', brillo:'#4DEBFF', acento:'#D9FF42' }],
    [/miami open/, { fondo:'#062B35', panel:'#07505B', primario:'#00AFA5', brillo:'#FF7A78', acento:'#F8E36A' }]
  ];
  const match = temas.find(([rx]) => rx.test(t));
  if (match) return match[1];
  return esWTA ? { fondo:'#17072D', panel:'#2A1048', primario:'#8B45D6', brillo:'#C17BFF', acento:'#D9FF42' }
    : { fondo:'#06152E', panel:'#10294B', primario:'#087BFF', brillo:'#39B9FF', acento:'#D9FF42' };
}

async function crearPosterTikTok({ n, foto, tema, torneo, gancho, ag, ap, sets, pregunta }) {
  const { chromium } = await import('playwright-core');
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  try {
    const p = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    const archivo = path.join(ROOT, 'node_modules', '.tiktok-poster.html');
    const rutaFoto = `file://${path.join(ROOT, foto)}`;
    const slides = [
      { archivo: `${n.slug}-1.jpg`, titulo: gancho, subtitulo: tema.etiqueta, linea: n.resultado.ganador.nombre, modo: 'hero' },
      { archivo: `${n.slug}-2.jpg`, titulo: 'MARCADOR FINAL', subtitulo: `${ag} vs. ${ap}`, linea: sets, modo: 'score' },
    ];
    const salidas = [];
    for (const slide of slides) {
      const contenido = slide.modo === 'hero'
        ? `<div class="heroTitle">${esc(slide.titulo)}<span>${esc(slide.subtitulo)}</span></div><div class="winner">${esc(slide.linea)}</div>`
        : `<div class="scoreTitle">${esc(slide.titulo)}</div><div class="versus">${esc(slide.subtitulo)}</div><div class="score">${esc(slide.linea)}</div><div class="winner">${esc(n.resultado.ganador.nombre)}</div><div class="question">${esc(pregunta)}</div>`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(file://${path.join(ROOT,'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:800;src:url(file://${path.join(ROOT,'node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:900;font-style:italic;src:url(file://${path.join(ROOT,'node_modules/@fontsource/montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:RC;font-weight:700;src:url(file://${path.join(ROOT,'node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2')})}
*{box-sizing:border-box}body{margin:0}#p{width:1080px;height:1920px;position:relative;overflow:hidden;background:${tema.fondo};color:#fff;font-family:Inter}
.hero{position:absolute;inset:0;background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.10) 34%,${tema.fondo} 100%),linear-gradient(115deg,${tema.primario}77,transparent 65%),url('${rutaFoto}');background-size:cover;background-position:center 18%;filter:saturate(1.14) contrast(1.08)}.hero:after{content:'';position:absolute;right:-230px;top:430px;width:680px;height:680px;border:44px solid ${tema.primario}88;border-radius:50%;box-shadow:0 0 0 36px ${tema.brillo}22}
.brand{position:absolute;top:82px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font:900 italic 44px Montserrat;text-shadow:0 3px 18px #000}.brand b{color:${tema.acento}}
.event{font:800 27px Montserrat;letter-spacing:.08em;background:${tema.primario};padding:15px 22px;border-radius:9px}
.heroTitle{position:absolute;z-index:2;left:68px;right:68px;bottom:300px;font:900 italic 154px/.86 Montserrat;letter-spacing:-.06em;text-shadow:0 5px 30px #000;max-width:940px}.heroTitle span{display:block;color:${tema.acento};font-size:56px;letter-spacing:.05em;margin-top:24px}
.winner{position:absolute;left:68px;right:68px;bottom:110px;font:900 50px Montserrat;text-shadow:0 3px 20px #000}
.scoreTitle{position:absolute;left:68px;right:68px;top:520px;text-align:center;font:900 italic 94px Montserrat;color:${tema.acento}}
.versus{position:absolute;left:68px;right:68px;top:690px;text-align:center;font:800 54px Montserrat}
.score{position:absolute;left:50px;right:50px;top:840px;text-align:center;font:700 150px RC;color:${tema.acento};padding:50px 10px;border-top:5px solid ${tema.primario};border-bottom:5px solid ${tema.primario}}
.question{position:absolute;left:70px;right:70px;top:1220px;text-align:center;font:800 42px Montserrat;color:#e5eaf2}
</style></head><body><div id="p"><div class="hero"><div class="brand"><span class="event">${esc(torneo)}</span><span>A Todo <b>Tenis</b></span></div>${contenido}</div></div></body></html>`;
      fs.writeFileSync(archivo, html);
      await p.goto('file://' + archivo, { waitUntil: 'networkidle', timeout: 60000 });
      await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
      const imagenOk = await p.evaluate(async () => {
        const u=getComputedStyle(document.querySelector('.hero')).backgroundImage;
        const m=u.match(/url\\([\"']?(.*?)[\"']?\\)/);
        if (!m) return false;
        return await new Promise((ok) => { const i=new Image(); i.onload=()=>ok(i.naturalWidth>=1000); i.onerror=()=>ok(false); i.src=m[1]; });
      });
      if (!imagenOk) throw new Error('La foto del ganador no pasó la validación');
      const salida = path.join(ROOT, 'static', 'tiktok', slide.archivo);
      fs.mkdirSync(path.dirname(salida), { recursive: true });
      await p.locator('#p').screenshot({ path: salida, type: 'jpeg', quality: 94 });
      salidas.push(`tiktok/${slide.archivo}`);
    }
    return salidas;
  } finally { await navegador.close(); }
}

// ffmpeg: el del sistema o, si no está (los servidores de GitHub ya no lo traen), ffmpeg-static, solo cuando hace falta
function conseguirFfmpeg() {
  if (process.env.FFMPEG_PATH) return true;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch {}
  try {
    // npm --no-save borra los otros paquetes sin guardar: se reinstalan todos juntos
    execFileSync('npm', ['i', '--no-save', '--no-audit', '--no-fund', '--silent', 'ffmpeg-static', 'playwright-core', '@fontsource/inter', '@fontsource/montserrat', '@fontsource/roboto-condensed'], { cwd: ROOT, stdio: 'inherit' });
    const ruta = path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg');
    if (fs.existsSync(ruta)) { process.env.FFMPEG_PATH = ruta; return true; }
  } catch {}
  return false;
}

for (const n of notas) {
  if (deHoy >= MAX_POR_DIA) break;
  if (!conseguirFfmpeg()) { log('TikTok: no hay ffmpeg, se reintenta en la próxima corrida'); break; }
  const r = n.resultado, g = r.ganador.nombre, p = r.perdedor?.nombre || '';
  const esWTA = /WTA/i.test(`${n.categoria} ${n.torneo}`);
  const tema = { ...temaTorneo(torneo, esWTA), etiqueta: esWTA ? 'WTA' : 'ATP' };
  // Exigir una foto editorial elegida para el ganador; el rival es secundario y su foto es opcional.
  const fotosEditoriales = leerJSON('scripts/ig-fotos.json', {});
  if (!fotosEditoriales[slug(g)]?.url) { log('TikTok: se posterga, falta foto editorial seleccionada del ganador:', g); continue; }
  const fotoG = await fotoJugador(g, 1280);
  if (!fotoG) { log('TikTok: se posterga, no hay foto grande del ganador:', g); continue; }
  const fotoP = p ? await fotoJugador(p, 1280) : null;
  const foto = `static/ig/fotos/${slug(g)}-1280.jpg`;
  const fotoRival = fotoP && fs.existsSync(path.join(ROOT, `static/ig/fotos/${slug(p)}-1280.jpg`)) ? `static/ig/fotos/${slug(p)}-1280.jpg` : foto;
  if (!fs.existsSync(path.join(ROOT, foto)) || !fs.existsSync(path.join(ROOT, fotoRival))) { log('TikTok: faltan retratos grandes de ambos jugadores'); continue; }
  const sets = r.sets.map((s) => `${s[0]}-${s[1]}`).join('  ');
  const torneo = String(n.torneo || n.categoria || '').toUpperCase();
  const frase = n.declaracion?.texto && n.declaracion.texto.length < 130 ? `«${n.declaracion.texto}»` : n.bajada;
  // Gancho editorial basado en la ronda, sin exagerar el marcador ni etiquetar como paliza un 6-2, 6-1.
  const ag = ape(g), ap = ape(p), rg = r.ganador.ranking, rp = r.perdedor?.ranking;
  const ronda = String(r.ronda || '').toUpperCase();
  const esFinals = /Finals/i.test(`${n.torneo} ${n.categoria}`);
  const genero = esWTA ? 'CAMPEONA' : 'CAMPEÓN';
  const gancho = ronda === 'SF' ? '¡A LA FINAL!' : ronda === 'F' ? `¡${genero}!` : '¡GRAN VICTORIA!';
  const sub = rg && rp ? `N° ${rg} vs N° ${rp}` : `${ag} superó a ${ap}`;
  const pregunta = ronda === 'SF' && esFinals ? '¿Quién se queda con el título?' : '¿Qué te pareció este resultado?';
  const guion = { escenas: [
    { foto, foco: focoJugador(g), segundos: 2.2, html: `<div style="position:absolute;inset:0;background:linear-gradient(rgba(4,8,20,.16),${tema.fondo}dd)"></div>${marca(tema.acento)}${chip(torneo,184,tema)}
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:900 132px/.94 Montserrat;letter-spacing:-.04em" class="lima">${esc(gancho)}</div>
      <div style="font:800 54px/1.1 Montserrat;margin-top:26px">${esc(ag)} avanzó tras vencer a ${esc(ap)}</div></div>` },
    { foto: fotoRival, foco: focoJugador(p), segundos: 2.4, html: `<div style="position:absolute;inset:0;background:linear-gradient(rgba(4,8,20,.18),${tema.fondo}ee)"></div>${marca(tema.acento)}${chip('EL PARTIDO',224,tema)}
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:800 78px/.98 Montserrat">${esc(ap)}</div>
      <div style="font:800 48px/1.1 Montserrat;margin-top:24px" class="gris">Fue el rival de ${esc(ag)}</div></div>` },
    { foto, foco: focoJugador(g), segundos: 3.2, html: `${overlay(tema.fondo)}${marca(tema.acento)}${chip(`MARCADOR FINAL · ${torneo}`,224,tema)}
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:800 112px/.95 Montserrat">${esc(g)}</div>
      <div style="font-size:42px;margin-top:22px" class="gris">superó a ${esc(p)}</div>
      <div style="font:700 112px RC;margin-top:24px" class="lima">${esc(sets)}</div></div>` },
    { foto: null, segundos: 3.2, html: `${marca(tema.acento)}<div style="position:absolute;left:72px;right:120px;top:560px">
      <div style="font:900 108px/.98 Montserrat;letter-spacing:-.04em">${esc(pregunta)}</div>
      <div style="font-size:48px;margin-top:46px" class="lima">Te leemos en comentarios</div></div>
      <div style="position:absolute;left:72px;right:120px;bottom:560px;font-size:24px;color:#6B7785">A Todo Tenis · ${esc(torneo)}</div>` },
  ] };
  const duracionTotal = guion.escenas.reduce((total, escena) => total + (escena.segundos || 0), 0);
  if (duracionTotal > 15) { log('TikTok: video descartado, supera los 15 segundos:', duracionTotal); continue; }
  const guionArch = path.join(ROOT, 'node_modules', '.tiktok-guion.json');
  fs.writeFileSync(guionArch, JSON.stringify(guion));
  const video = `tiktok/${n.slug}.mp4`;
  try {
    execFileSync('node', [path.join(ROOT, 'scripts/ig-reel.mjs'), guionArch, path.join(ROOT, 'static', video)], { stdio: 'inherit', env: { ...process.env, REEL_CRF: '23' } });
  } catch { log('TikTok: no se pudo armar el video de', n.slug); continue; }
  const imagenes = await crearPosterTikTok({ n, foto, tema, torneo, gancho, ag, ap, sets, pregunta }).catch((err) => { log('TikTok: no se pudo crear el carrusel vertical:', err.message); return []; });
  const tags = ['#tenis', '#tennis', esFinals ? (esWTA ? '#WTAFinals' : '#ATPFinals') : (esWTA ? '#WTA' : '#ATP'), '#' + ape(g).normalize('NFD').replace(/[^A-Za-z]/g, ''), '#tenisentiktok'];
  estado.videos.unshift({ slug: n.slug, video, imagen: imagenes[0] || null, imagenes, fecha: new Date().toISOString(), texto: `${gancho.replace(/[¡!]/g, '')} 🎾 ${n.titulo}. Marcador: ${sets}. ${pregunta}\n\n${tags.join(' ')}` });
  deHoy++;
  log('TikTok: video listo', video);
}
fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 1) + '\n');
