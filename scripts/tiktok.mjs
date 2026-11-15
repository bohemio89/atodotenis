// Videos para TikTok: cada resultado importante con foto revisada del ganador se convierte en un video vertical
// de ~9 segundos, con los textos dentro de la zona libre de TikTok. Quedan en /tiktok (página sin indexar)
// para descargarlos y programarlos. TikTok no permite publicar por API sin app aprobada.
//   node scripts/tiktok.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, leerJSON, log } from './lib/util.mjs';
import { fotoJugador, focoJugador, esc, slug } from './lib/ig-render.mjs';

const MAX_POR_DIA = 2, HORAS = 36, DIAS_GUARDAR = 10, IMPORTANCIA_MIN = 50;
const ESTADO = path.join(ROOT, 'data/tiktok.json');
const estado = leerJSON('data/tiktok.json', { videos: [] });
const hoy = new Date().toISOString().slice(0, 10);

// Limpieza: los videos de más de 10 días se borran (ya se publicaron o perdieron vigencia)
estado.videos = estado.videos.filter((v) => {
  const viejo = Date.now() - new Date(v.fecha).getTime() > DIAS_GUARDAR * 864e5;
  if (viejo) fs.rmSync(path.join(ROOT, 'static', v.video), { force: true });
  return !viejo;
});

const hechos = new Set(estado.videos.map((v) => v.slug));
const notas = fs.readdirSync(path.join(ROOT, 'content/notas')).filter((f) => f.endsWith('.json'))
  .map((f) => leerJSON(`content/notas/${f}`, null)).filter(Boolean)
  .filter((n) => n.estado === 'publicada' && typeof n.resultado === 'object' && n.resultado?.ganador?.nombre && n.resultado?.sets?.length)
  .filter((n) => Date.now() - new Date(n.fecha).getTime() < HORAS * 3600e3 && (n.importancia || 0) >= IMPORTANCIA_MIN && !hechos.has(n.slug))
  .sort((a, b) => (b.importancia || 0) - (a.importancia || 0));

let deHoy = estado.videos.filter((v) => v.fecha.slice(0, 10) === hoy).length;
const G = '<div style="position:absolute;inset:0;background:linear-gradient(rgba(18,22,27,.5),rgba(18,22,27,0) 22%,rgba(18,22,27,0) 30%,rgba(18,22,27,.82) 50%,#12161B 68%)"></div>';
const marca = '<div class="marca" style="top:72px;right:120px">A Todo <b>Tenis</b></div>';
const ape = (s) => String(s).trim().split(/\s+/).slice(-1)[0];

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
  // Foto revisada del ganador, guardada en grande. Sin foto buena, no hay video.
  const [fotoG, fotoP] = await Promise.all([fotoJugador(g, 1280), fotoJugador(p, 1280)]);
  if (!fotoG || !fotoP) { log('TikTok: se posterga, falta foto de calidad de ambos protagonistas:', g, '/', p); continue; }
  const foto = `static/ig/fotos/${slug(g)}-1280.jpg`;
  const fotoRival = `static/ig/fotos/${slug(p)}-1280.jpg`;
  if (!fs.existsSync(path.join(ROOT, foto)) || !fs.existsSync(path.join(ROOT, fotoRival))) { log('TikTok: faltan retratos grandes de ambos jugadores'); continue; }
  const sets = r.sets.map((s) => `${s[0]}-${s[1]}`).join('  ');
  const torneo = String(n.torneo || n.categoria || '').toUpperCase();
  const frase = n.declaracion?.texto && n.declaracion.texto.length < 130 ? `«${n.declaracion.texto}»` : n.bajada;
  // Gancho editorial basado en la ronda, sin exagerar el marcador ni etiquetar como paliza un 6-2, 6-1.
  const ag = ape(g), ap = ape(p), rg = r.ganador.ranking, rp = r.perdedor?.ranking;
  const ronda = String(r.ronda || '').toUpperCase();
  const esWTA = /WTA/i.test(`${n.categoria} ${n.torneo}`);
  const esFinals = /Finals/i.test(`${n.torneo} ${n.categoria}`);
  const genero = esWTA ? 'CAMPEONA' : 'CAMPEÓN';
  const gancho = ronda === 'SF' ? '¡A LA FINAL!' : ronda === 'F' ? `¡${genero}!` : '¡GRAN VICTORIA!';
  const sub = rg && rp ? `N° ${rg} vs N° ${rp}` : `${ag} superó a ${ap}`;
  const pregunta = ronda === 'SF' && esFinals ? '¿Quién se queda con el título?' : '¿Qué te pareció este resultado?';
  const guion = { escenas: [
    { foto, foco: focoJugador(g), segundos: 2.2, html: `<div style="position:absolute;inset:0;background:linear-gradient(rgba(18,22,27,.18),rgba(18,22,27,.82))"></div>${marca}<div class="chip" style="top:184px">${esc(torneo)}</div>
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:900 132px/.94 Montserrat;letter-spacing:-.04em" class="lima">${esc(gancho)}</div>
      <div style="font:800 54px/1.1 Montserrat;margin-top:26px">${esc(ag)} avanzó tras vencer a ${esc(ap)}</div></div>` },
    { foto: fotoRival, foco: focoJugador(p), segundos: 2.4, html: `<div style="position:absolute;inset:0;background:linear-gradient(rgba(18,22,27,.22),rgba(18,22,27,.88))"></div>${marca}<div class="chip" style="top:224px">EL PARTIDO</div>
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:800 78px/.98 Montserrat">${esc(ap)}</div>
      <div style="font:800 48px/1.1 Montserrat;margin-top:24px" class="gris">Fue el rival de ${esc(ag)}</div></div>` },
    { foto, foco: focoJugador(g), segundos: 3.2, html: `${G}${marca}<div class="chip" style="top:224px">MARCADOR FINAL · ${esc(torneo)}</div>
      <div style="position:absolute;left:72px;right:120px;bottom:620px"><div style="font:800 112px/.95 Montserrat">${esc(g)}</div>
      <div style="font-size:42px;margin-top:22px" class="gris">superó a ${esc(p)}</div>
      <div style="font:700 112px RC;margin-top:24px" class="lima">${esc(sets)}</div></div>` },
    { foto: null, segundos: 3.2, html: `${marca}<div style="position:absolute;left:72px;right:120px;top:560px">
      <div style="font:900 108px/.98 Montserrat;letter-spacing:-.04em">${esc(pregunta)}</div>
      <div style="font-size:48px;margin-top:46px" class="lima">Te leemos en comentarios</div></div>
      <div style="position:absolute;left:72px;right:120px;bottom:560px;font-size:24px;color:#6B7785">A Todo Tenis · ${esc(torneo)}</div>` },
  ] };
  const guionArch = path.join(ROOT, 'node_modules', '.tiktok-guion.json');
  fs.writeFileSync(guionArch, JSON.stringify(guion));
  const video = `tiktok/${n.slug}.mp4`;
  try {
    execFileSync('node', [path.join(ROOT, 'scripts/ig-reel.mjs'), guionArch, path.join(ROOT, 'static', video)], { stdio: 'inherit', env: { ...process.env, REEL_CRF: '23' } });
  } catch { log('TikTok: no se pudo armar el video de', n.slug); continue; }
  const wta = /WTA/i.test(`${n.categoria} ${n.torneo}`);
  const tags = ['#tenis', '#tennis', esFinals ? (wta ? '#WTAFinals' : '#ATPFinals') : (wta ? '#WTA' : '#ATP'), '#' + ape(g).normalize('NFD').replace(/[^A-Za-z]/g, ''), '#tenisentiktok'];
  estado.videos.unshift({ slug: n.slug, video, fecha: new Date().toISOString(), texto: `${gancho.replace(/[¡!]/g, '')} 🎾 ${n.titulo}. Marcador: ${sets}. ${pregunta}\n\n${tags.join(' ')}` });
  deHoy++;
  log('TikTok: video listo', video);
}
fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 1) + '\n');
