// Fotos en alta resolución para videos: busca en Wikimedia Commons (licencias libres),
// prioriza resolución y fotos recientes, y descarga a 2160 px de ancho con su crédito.
// Uso: JUGADORES="Mirra Andreeva,Carlos Alcaraz" node scripts/fotos-hd.mjs
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LICENCIAS_OK = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const POR_JUGADOR = +(process.env.POR_JUGADOR || 10);
const ANIOS = +(process.env.ANIOS || 3);
const SALIDA = 'media/hd';

const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function fecha(meta) {
  const m = limpiar(meta.DateTimeOriginal?.value || meta.DateTime?.value).match(/(\d{4})[-:/](\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : null;
}

async function buscar(jugador) {
  const paginas = {};
  const y = new Date().getFullYear();
  for (const extra of [` ${y}`, ` ${y - 1}`, ` ${y - 2}`, '']) {
    const q = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '50',
      gsrsearch: `"${jugador}"${extra} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '2160' });
    const r = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } });
    if (r.ok) Object.assign(paginas, (await r.json()).query?.pages || {});
    await espera(500);
  }
  const limite = new Date(); limite.setFullYear(limite.getFullYear() - ANIOS);
  const apellido = norm(jugador).split(' ').pop();
  const c = [];
  for (const p of Object.values(paginas)) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const meta = ii.extmetadata || {};
    const lic = limpiar(meta.LicenseShortName?.value);
    if (!LICENCIAS_OK.test(lic) || /non-?free|fair use/i.test(lic)) continue;
    if (!norm(p.title).includes(apellido)) continue;
    const f = fecha(meta); if (!f || f < limite) continue;
    const vertical = ii.height > ii.width;
    if (vertical ? ii.width < 1600 : ii.height < 1600) continue; // alta resolución: el lado corto manda
    if (ii.size && ii.size / (ii.width * ii.height) < 0.12) continue; // descarta fotos muy comprimidas
    const titulo = limpiar(meta.ObjectName?.value || p.title);
    if (/\b(and|y|vs\.?|with|&|doubles|dobles|team|ceremony|trophy ceremony)\b/i.test(titulo)) continue;
    c.push({ titulo: p.title, url: ii.thumburl || ii.url, ancho: ii.width, alto: ii.height, fecha: f.toISOString().slice(0, 7),
      autor: limpiar(meta.Artist?.value) || 'Autor desconocido', licencia: lic, licenciaUrl: limpiar(meta.LicenseUrl?.value) || null,
      pagina: ii.descriptionurl, puntaje: f.getTime() / 864e5 / 30 + Math.min(ii.width, ii.height) / 400 + (vertical ? 3 : 0) });
  }
  return c.sort((a, b) => b.puntaje - a.puntaje).slice(0, POR_JUGADOR);
}

const jugadores = String(process.env.JUGADORES || '').split(',').map((s) => s.trim()).filter(Boolean);
for (const j of jugadores) {
  const dir = path.join(SALIDA, slug(j));
  fs.mkdirSync(dir, { recursive: true });
  const lista = await buscar(j);
  const creditos = [];
  let i = 0;
  for (const f of lista) {
    const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) continue;
    const archivo = `${String(++i).padStart(2, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, archivo), Buffer.from(await r.arrayBuffer()));
    creditos.push({ archivo, ...f });
    await espera(800);
  }
  fs.writeFileSync(path.join(dir, 'creditos.json'), JSON.stringify(creditos, null, 2));
  console.log(`${j}: ${creditos.length} fotos`);
}
