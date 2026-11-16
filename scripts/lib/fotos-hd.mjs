// Fotos en alta resolución de Wikimedia Commons (licencias libres) para los videos.
// Se descargan a node_modules/.fotos-hd (no se suben al repositorio ni al sitio).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './util.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LICENCIAS_OK = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function fecha(meta) {
  const m = limpiar(meta.DateTimeOriginal?.value || meta.DateTime?.value).match(/(\d{4})[-:/](\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : null;
}

export async function buscarHD(jugador, { anios = 3, cuantas = 6 } = {}) {
  const paginas = {};
  const y = new Date().getFullYear();
  for (const extra of [` ${y}`, ` ${y - 1}`, '']) {
    const q = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '50',
      gsrsearch: `"${jugador}"${extra} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '2160' });
    try {
      const r = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } });
      if (r.ok) Object.assign(paginas, (await r.json()).query?.pages || {});
    } catch {}
    await espera(400);
  }
  const limite = new Date(); limite.setFullYear(limite.getFullYear() - anios);
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
    if (!vertical) continue; // para 9:16 solo sirven fotos verticales
    if (ii.width < 1600) continue;
    if (ii.size && ii.size / (ii.width * ii.height) < 0.12) continue;
    const titulo = limpiar(meta.ObjectName?.value || p.title);
    if (/\b(and|y|vs\.?|with|&|doubles|dobles|team|ceremony|crowd|fans|spectators)\b/i.test(titulo)) continue;
    c.push({ url: ii.thumburl || ii.url, autor: limpiar(meta.Artist?.value).slice(0, 60) || 'Wikimedia Commons', licencia: lic,
      puntaje: f.getTime() / 864e5 / 30 + ii.width / 400 });
  }
  return c.sort((a, b) => b.puntaje - a.puntaje).slice(0, cuantas);
}

// Devuelve hasta `cuantas` fotos locales [{archivo, autor, licencia}] o [] si no hay.
export async function fotosHD(jugador, cuantas = 2) {
  const dir = path.join(ROOT, 'node_modules/.fotos-hd', slug(jugador));
  const indice = path.join(dir, 'indice.json');
  if (fs.existsSync(indice)) {
    const previas = JSON.parse(fs.readFileSync(indice, 'utf8')).filter((f) => fs.existsSync(f.archivo));
    if (previas.length >= cuantas) return previas.slice(0, cuantas);
  }
  fs.mkdirSync(dir, { recursive: true });
  const lista = await buscarHD(jugador, { cuantas: cuantas + 2 });
  const salida = [];
  for (const f of lista) {
    if (salida.length >= cuantas) break;
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) continue;
      const archivo = path.join(dir, `${salida.length + 1}.jpg`);
      fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()));
      salida.push({ archivo, autor: f.autor, licencia: f.licencia });
    } catch {}
    await espera(500);
  }
  fs.writeFileSync(indice, JSON.stringify(salida));
  return salida;
}
