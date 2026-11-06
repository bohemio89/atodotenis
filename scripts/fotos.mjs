// Fotos para las notas: busca en Wikimedia Commons fotos con licencia libre del jugador,
// sacadas en los últimos meses, y guarda el crédito que exige la licencia.
// Si no hay una foto reciente, la nota queda con la ilustración de cancha.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, log } from './lib/util.mjs';

const MESES_MAX = 12;
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LICENCIAS_OK = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;

const partidos = leerJSON('data/partidos.json', {});
const dir = path.join(ROOT, 'content/notas');
const notas = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

const limpiar = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function fechaFoto(meta) {
  const crudo = limpiar(meta.DateTimeOriginal?.value || meta.DateTime?.value || '');
  const m = crudo.match(/(\d{4})[-:/](\d{2})(?:[-:/](\d{2}))?/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1))) : null;
}

async function buscar(jugador, fechaNota) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '40',
    gsrsearch: `"${jugador}" filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1920'
  });
  const r = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Commons HTTP ${r.status}`);
  const j = await r.json();
  const limite = new Date(fechaNota); limite.setMonth(limite.getMonth() - MESES_MAX);
  const apellido = norm(jugador).split(' ').pop();
  const candidatas = [];
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const meta = ii.extmetadata || {};
    const lic = limpiar(meta.LicenseShortName?.value);
    if (!LICENCIAS_OK.test(lic) || /non-?free|fair use/i.test(lic)) continue;
    const f = fechaFoto(meta);
    if (!f || f < limite || f > new Date(fechaNota)) continue; // solo fotos recientes
    const texto = norm(`${p.title} ${limpiar(meta.ImageDescription?.value)}`);
    if (!texto.includes(apellido)) continue;
    // Calidad: fotos grandes (no se estiran en pantalla) y sin compresión excesiva
    const apaisada = ii.width >= ii.height;
    if (apaisada ? (ii.width < 1600 || ii.height < 900) : ii.width < 1400) continue;
    if (ii.size && ii.size / (ii.width * ii.height) < 0.1) continue;
    // Evitar fotos grupales o de otros temas (trofeos con varios, autógrafos, etc.)
    const varios = /(and|y|vs\.?|with|&)\s+[a-z]+/i.test(limpiar(meta.ObjectName?.value || p.title).replace(/\.(jpe?g|png|webp)$/i, ''));
    candidatas.push({
      url: ii.thumburl || ii.url, ancho: ii.thumbwidth || ii.width, alto: ii.thumbheight || ii.height, original: ii.width,
      autor: limpiar(meta.Artist?.value) || 'Autor desconocido', licencia: lic,
      licenciaUrl: limpiar(meta.LicenseUrl?.value) || null, pagina: ii.descriptionurl, fecha: f.toISOString().slice(0, 10),
      puntaje: f.getTime() / 864e5 + (apaisada ? 120 : 0) - (varios ? 200 : 0)
    });
  }
  candidatas.sort((a, b) => b.puntaje - a.puntaje);
  return candidatas[0] || null;
}

async function main() {
  let cambios = 0;
  for (const f of notas) {
    const ruta = path.join(dir, f);
    const n = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (n.getty) continue;
    if (n.imagen?.url && n.imagen.calidad === 2) continue;
    const anterior = n.imagen?.url ? n.imagen : null; // foto elegida con el criterio viejo: se vuelve a evaluar
    if (anterior) { delete n.imagen; n.fotoBuscada = null; }
    // reintentar como mucho una vez por semana
    if (n.fotoBuscada && Date.now() - new Date(n.fotoBuscada).getTime() < 7 * 864e5 && !process.env.FORZAR_FOTOS) continue;
    const p = partidos[n.partidoId];
    const jugadores = n.jugadores || (p ? [p.ganador === 2 ? p.j2 : p.j1, p.ganador === 2 ? p.j1 : p.j2].filter(Boolean).map((j) => j.nombre) : []);
    let foto = null;
    for (const nombre of jugadores.filter((x) => x && !x.includes('/'))) {
      try { foto = await buscar(nombre, n.fechaPartido || n.fecha); } catch (e) { log('Commons falló:', e.message); }
      if (foto) { foto.jugador = nombre; break; }
      await new Promise((s) => setTimeout(s, 1000));
    }
    n.fotoBuscada = new Date().toISOString();
    if (foto) {
      n.imagen = {
        url: foto.url, credito: `${foto.autor} / ${foto.licencia}, vía Wikimedia Commons`, enlace: foto.pagina,
        licenciaUrl: foto.licenciaUrl, fechaFoto: foto.fecha, jugador: foto.jugador, alt: `${foto.jugador}`,
        ancho: foto.ancho, alto: foto.alto, calidad: 2
      };
      log(`Foto para "${n.titulo}": ${foto.jugador}, ${foto.fecha}, ${foto.licencia}`);
    } else log(`Sin foto reciente de buena calidad para "${n.titulo}"${anterior ? ' (se quita la anterior)' : ''}`);
    fs.writeFileSync(ruta, JSON.stringify(n, null, 1) + '\n');
    cambios++;
  }
  log(`Notas revisadas: ${cambios}`);
}

main().catch((e) => { console.error('ERROR fotos:', e.message); process.exit(0); });
