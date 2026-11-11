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
const marca = '<div class="marca" style="top:230px;right:150px">A Todo <b>Tenis</b></div>';
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
  if (!(await fotoJugador(g, 1280))) { log('TikTok: sin foto revisada de', g); continue; }
  const foto = `static/ig/fotos/${slug(g)}-1280.jpg`;
  if (!fs.existsSync(path.join(ROOT, foto))) { log('TikTok: falta la foto grande de', g); continue; }
  const sets = r.sets.map((s) => `${s[0]}-${s[1]}`).join('  ');
  const torneo = String(n.torneo || n.categoria || '').toUpperCase();
  const frase = n.declaracion?.texto && n.declaracion.texto.length < 130 ? `«${n.declaracion.texto}»` : n.bajada;
  const guion = { escenas: [
    { foto, foco: focoJugador(g), segundos: 3.4, html: `${G}${marca}<div class="chip" style="top:224px">RESULTADO · ${esc(torneo)}</div>
      <div style="position:absolute;left:72px;right:150px;bottom:640px"><div style="font:800 120px/0.95 Montserrat;letter-spacing:-.03em">${esc(g.split(' ').slice(0, -1).join(' '))}<br>${esc(ape(g))}</div>
      <div style="font-size:42px;margin-top:22px" class="gris">le ganó a ${esc(p)}</div>
      <div style="font:700 96px RC;margin-top:14px" class="lima">${esc(sets)}</div></div>` },
    { foto: null, segundos: 3.6, html: `${marca}<div style="position:absolute;left:72px;right:150px;top:470px">
      <div style="font:800 34px Montserrat;letter-spacing:.06em" class="lima">${esc(ape(n.declaracion?.texto && n.declaracion.texto.length < 130 ? n.declaracion.jugador || g : g).toUpperCase())}</div>
      <p style="margin:24px 0 0;font:800 64px/1.15 Montserrat">${esc(frase || n.titulo)}</p>
      <div style="font-size:36px;margin-top:50px" class="gris">La nota completa, en atodotenis.vercel.app</div></div>` },
    { foto: null, segundos: 2.2, html: `${marca}<div style="position:absolute;left:72px;right:150px;top:560px">
      <div style="font:800 130px/0.95 Montserrat;letter-spacing:-.03em">¿Lo<br><span class="lima">viste?</span></div>
      <div style="font-size:44px;margin-top:40px">Seguinos para más tenis.</div></div>
      <div style="position:absolute;left:72px;right:150px;bottom:560px;font-size:24px;color:#6B7785">Foto: Wikimedia Commons, licencia libre. Autor en atodotenis.vercel.app/creditos</div>` },
  ] };
  const guionArch = path.join(ROOT, 'node_modules', '.tiktok-guion.json');
  fs.writeFileSync(guionArch, JSON.stringify(guion));
  const video = `tiktok/${n.slug}.mp4`;
  try {
    execFileSync('node', [path.join(ROOT, 'scripts/ig-reel.mjs'), guionArch, path.join(ROOT, 'static', video)], { stdio: 'inherit', env: { ...process.env, REEL_CRF: '23' } });
  } catch { log('TikTok: no se pudo armar el video de', n.slug); continue; }
  const pregunta = n.torneo && /Finals/i.test(n.torneo) ? '¿Quién gana el título?' : '¿Lo viste?';
  const tags = ['#tenis', '#tennis', /WTA/i.test(`${n.categoria} ${n.torneo}`) ? '#WTA' : '#ATP', '#' + ape(g).normalize('NFD').replace(/[^A-Za-z]/g, ''), '#tenisentiktok'];
  estado.videos.unshift({ slug: n.slug, video, fecha: new Date().toISOString(), texto: `${n.titulo} 🎾 ${sets}. ${pregunta}\n\n${tags.join(' ')}` });
  deHoy++;
  log('TikTok: video listo', video);
}
fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 1) + '\n');
