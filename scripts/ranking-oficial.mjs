// Ranking oficial: toma el Top 200 de singles de las páginas oficiales de la ATP y la WTA
// y lo vuelca en data/jugadores.json (puntos, puesto y puestos que subió o bajó).
// Uso: node scripts/ranking-oficial.mjs [probar]
import fs from 'node:fs';
const ARCH = 'data/jugadores.json';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', accept: 'application/json,text/html;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();

async function traer(url, extra = {}) {
  const r = await fetch(url, { headers: { ...UA, ...extra } });
  const t = await r.text();
  log(r.status, url.slice(0, 90), t.length, 'bytes');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return t;
}

// ---------- WTA: API pública del sitio oficial (wtatennis.com) ----------
async function wta() {
  const out = [];
  for (let page = 0; page < 2; page++) {
    const t = await traer(`https://api.wtatennis.com/tennis/players/ranked?page=${page}&pageSize=100&type=rankSingles&sort=asc&name=&metric=SINGLES&at=&nationality=`, { origin: 'https://www.wtatennis.com', referer: 'https://www.wtatennis.com/' });
    const d = JSON.parse(t);
    for (const x of d) {
      const p = x.player || {};
      out.push({ nombre: p.fullName || `${p.firstName} ${p.lastName}`, pais: (p.countryCode || '').toLowerCase(), ranking: x.ranking, puntos: x.points, cambio: x.movement ?? (x.previousRanking ? x.previousRanking - x.ranking : null), tour: 'wta' });
    }
  }
  return out;
}

// ---------- ATP: listado oficial de atptour.com ----------
async function atp() {
  // 1) JSON que usa el propio sitio
  try {
    const t = await traer('https://www.atptour.com/en/-/www/rank/sglroll/250?v=1', { referer: 'https://www.atptour.com/en/rankings/singles' });
    const d = JSON.parse(t);
    if (Array.isArray(d) && d.length) return d.map((x) => ({ nombre: `${x.FirstName} ${x.LastName}`, pais: (x.PlayerCountry || x.NatlId || '').toLowerCase(), ranking: x.RankNo, puntos: x.Points, cambio: x.Movement ?? (x.PrvRankNo ? x.PrvRankNo - x.RankNo : null), tour: 'atp' }));
  } catch (e) { log('ATP JSON:', e.message); }
  // 2) Página HTML del ranking
  const h = await traer('https://www.atptour.com/en/rankings/singles?rankRange=1-200');
  const out = [];
  const filas = h.split(/<tr[\s>]/).slice(1);
  for (const f of filas) {
    const rank = f.match(/class="rank[^"]*"[^>]*>\s*(\d+)/);
    const nombre = f.match(/class="name[^"]*"[\s\S]*?<span[^>]*>([^<]+)<\/span>/) || f.match(/data-ga-label="([^"]+)"/);
    const pts = f.match(/class="points[^"]*"[\s\S]*?>\s*([\d,.]+)\s*</);
    if (!rank || !nombre || !pts) continue;
    const up = f.match(/rank-up[^>]*>\s*(\d+)/), down = f.match(/rank-down[^>]*>\s*(\d+)/);
    out.push({ nombre: nombre[1].trim(), ranking: +rank[1], puntos: +pts[1].replace(/[,.]/g, ''), cambio: up ? +up[1] : down ? -down[1] : 0, tour: 'atp' });
  }
  return out;
}

const probar = process.argv[2] === 'probar';
const res = {};
for (const [k, fn] of [['atp', atp], ['wta', wta]]) {
  try { res[k] = await fn(); log(k, res[k].length, 'jugadores', JSON.stringify(res[k].slice(0, 3))); }
  catch (e) { log(k, 'ERROR', e.message); }
}
if (probar) process.exit(0);

const jug = JSON.parse(fs.readFileSync(ARCH, 'utf8'));
const lista = jug.lista || {};
let cambios = 0;
for (const tour of ['atp', 'wta']) {
  const of = res[tour];
  if (!of || of.length < 50) { log(tour, 'sin datos oficiales suficientes, se deja como estaba'); continue; }
  const idx = new Map(Object.entries(lista).filter(([, j]) => j.tour === tour).map(([id, j]) => [norm(j.nombre), id]));
  const apell = new Map(); for (const [id, j] of Object.entries(lista)) if (j.tour === tour) { const a = norm(j.nombre).split(' ').pop(); apell.set(a, apell.has(a) ? null : id); }
  // Quien no aparece en el oficial pierde el puesto (sale del Top 200)
  const vistos = new Set();
  for (const o of of) {
    let id = idx.get(norm(o.nombre));
    if (!id) { const a = norm(o.nombre).split(' ').pop(); id = apell.get(a) || null; }
    if (!id) id = `${tour}-${norm(o.nombre).replace(/ /g, '-')}`;
    const v = lista[id] || {};
    lista[id] = { ...v, nombre: v.nombre || o.nombre, pais: v.pais || o.pais, tour, ranking: o.ranking, puntos: o.puntos, cambio: o.cambio || null, rankAnterior: o.cambio ? o.ranking + o.cambio : null, mov: o.cambio > 0 ? 'up' : o.cambio < 0 ? 'down' : null, fuente: tour === 'atp' ? 'atptour.com' : 'wtatennis.com' };
    vistos.add(id); cambios++;
  }
  for (const [id, j] of Object.entries(lista)) if (j.tour === tour && !vistos.has(id) && j.ranking && j.ranking <= 200) lista[id] = { ...j, ranking: null, cambio: null };
}
if (cambios) { jug.lista = lista; jug.actualizado = new Date().toISOString(); jug.fuenteRanking = 'oficial'; fs.writeFileSync(ARCH, JSON.stringify(jug, null, 1) + '\n'); }
log('Actualizados:', cambios);
