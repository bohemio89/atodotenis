// Búsqueda de fotos con licencia libre en Wikimedia Commons.
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LICENCIAS_OK = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const STOP = new Set(['file', 'portrait', 'tennis', 'player', 'photo', 'image']);

const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function buscar(nombre) {
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
    // Si el archivo empieza con el apellido de otra persona (ej. "Tauson_Mboko"), probablemente sea otro jugador
    const primera = titulo.replace(/^file:/, '').split(/[^a-z0-9]+/)[0];
    const tokens = norm(nombre).split(/\s+/);
    if (/^[a-z]{4,}$/.test(primera) && !primera.includes(ap) && !tokens.includes(primera) && !STOP.has(primera)) continue;
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

