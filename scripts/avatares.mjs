// Fotos para el ranking: una foto con licencia libre de cada jugador del top,
// tomada de Wikimedia Commons, con el crédito que pide la licencia.
import { leerJSON, guardarJSON, log } from './lib/util.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LICENCIAS_OK = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const TOP = 20, MAX_POR_CORRIDA = 45, RENOVAR_DIAS = 60;

const jugadores = leerJSON('data/jugadores.json', { lista: {} });
const avatares = leerJSON('data/avatares.json', {});
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function buscar(nombre) {
  const q = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '30',
    gsrsearch: `"${nombre}" filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '240' });
  const r = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const ap = norm(nombre).split(' ').pop();
  const opciones = [];
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const m = ii.extmetadata || {};
    const lic = limpiar(m.LicenseShortName?.value);
    if (!LICENCIAS_OK.test(lic) || /non-?free|fair use/i.test(lic)) continue;
    const titulo = norm(p.title);
    if (!titulo.includes(ap)) continue;                       // el apellido tiene que estar en el nombre del archivo
    if (/(and|vs|with|doubles|trophy|team|signature|autograph)/i.test(titulo)) continue; // evitar fotos grupales
    if (ii.width < 300) continue;
    const fecha = (limpiar(m.DateTimeOriginal?.value).match(/\d{4}/) || ['0'])[0];
    const vertical = ii.height >= ii.width;
    opciones.push({ url: ii.thumburl || ii.url, autor: limpiar(m.Artist?.value) || 'Autor desconocido', licencia: lic,
      pagina: ii.descriptionurl, fecha, foco: vertical ? 'center 15%' : 'center 25%',
      puntaje: +fecha + (vertical ? 3 : 0) + (/portrait|headshot|face|press/i.test(titulo) ? 5 : 0) });
  }
  opciones.sort((a, b) => b.puntaje - a.puntaje);
  return opciones[0] || null;
}

async function main() {
  const top = ['atp', 'wta'].flatMap((t) => Object.values(jugadores.lista).filter((j) => j.tour === t).sort((a, b) => a.ranking - b.ranking).slice(0, TOP));
  const pendientes = top.filter((j) => { const a = avatares[j.nombre]; return !a || Date.now() - new Date(a.revisado || 0).getTime() > RENOVAR_DIAS * 864e5; })
    .slice(0, MAX_POR_CORRIDA);
  let con = 0;
  for (const j of pendientes) {
    try {
      const f = await buscar(j.nombre);
      avatares[j.nombre] = f ? { ...f, revisado: new Date().toISOString() } : { url: null, revisado: new Date().toISOString() };
      if (f) con++;
    } catch (e) { log('Commons falló:', j.nombre, e.message); }
    await new Promise((s) => setTimeout(s, 700));
  }
  guardarJSON('data/avatares.json', avatares);
  log(`Fotos de ranking: ${con} encontradas de ${pendientes.length} buscadas`);
}
main().catch((e) => { console.error('ERROR avatares:', e.message); process.exit(0); });
