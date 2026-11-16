// Fotos de Getty Images para las notas nuevas, con su código oficial para incrustar (gratuito, con crédito de Getty).
// Busca fotos editoriales recientes del ganador en ese torneo y pide el código con firma (oEmbed oficial).
// Solo toca notas publicadas de los últimos 3 días que todavía no tienen foto de Getty.
//   node scripts/getty.mjs            (SLUGS="a,b" para forzar notas puntuales)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './lib/util.mjs';

const DIR = path.join(ROOT, 'content/notas');
const DIAS = 3, MAX = 4;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const ape = (s) => norm(String(s).trim().split(/\s+/).slice(-1)[0]);
const forzar = String(process.env.SLUGS || '').split(',').map((s) => s.trim()).filter(Boolean);

const pendientes = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, n: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }))
  .filter(({ n }) => forzar.length ? forzar.includes(n.slug) : (n.estado === 'publicada' && !n.getty && !n.manual && Date.now() - new Date(n.fecha).getTime() < DIAS * 864e5))
  .filter(({ n }) => n.resultado?.ganador?.nombre || n.jugadores?.length)
  .sort((a, b) => new Date(b.n.fecha) - new Date(a.n.fecha)).slice(0, MAX);

if (!pendientes.length) { log('Getty: no hay notas nuevas sin foto'); process.exit(0); }

function lugar(n) {
  const t = `${n.torneo || ''} ${n.categoria || ''}`;
  if (/ATP Finals|Turin/i.test(t)) return 'Turin';
  if (/WTA Finals/i.test(t)) return 'WTA Finals';
  return String(n.torneo || '').replace(/Masters 1000 de |Abierto de /i, '').trim();
}

// Elige la foto donde el ganador es el protagonista: su apellido aparece en la descripción, antes que el del rival.
function elegir(enlaces, ganador, perdedor) {
  const g = ape(ganador), p = perdedor ? ape(perdedor) : null;
  const vistos = new Set();
  const lista = enlaces.map((h) => h.match(/\/detail\/news-photo\/([a-z0-9-]+)\/(\d{6,})/)).filter(Boolean)
    .map((m) => ({ slug: m[1], id: m[2] })).filter((x) => !vistos.has(x.id) && vistos.add(x.id));
  const puntaje = (x) => {
    const ig = x.slug.indexOf(g); if (ig < 0) return -1;
    const ip = p ? x.slug.indexOf(p) : -1;
    let s = 10 - Math.min(ig, 40) / 8;
    if (ip >= 0 && ip < ig) s -= 6; // el rival es el protagonista
    if (/celebrat|reacts|trophy|wins|victory/.test(x.slug)) s += 3;
    if (/fans|crowd|spectator|coach|tattoo|shoe|detail|ball-kid|umpire|logo|general-view/.test(x.slug)) s -= 8;
    return s;
  };
  return lista.map((x) => ({ ...x, s: puntaje(x) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0] || null;
}

async function embed(id) {
  const r = await fetch(`https://embed.gettyimages.com/oembed?url=${encodeURIComponent(`https://gty.im/${id}`)}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const html = (await r.json()).html || '';
  const et = html.match(/id:'([^']+)'/)?.[1], sig = html.match(/sig:'([^']+)'/)?.[1];
  const w = +(html.match(/w:'(\d+)px'/)?.[1] || 0), h = +(html.match(/h:'(\d+)px'/)?.[1] || 0);
  if (!et || !sig || !w || !h) return null;
  return { src: `https://embed.gettyimages.com/embed/${id}?et=${et}&tld=com&sig=${encodeURIComponent(sig)}&caption=true&ver=1`, w, h, id, fecha: new Date().toISOString() };
}

const { chromium } = await import('playwright-core');
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
try {
  const pg = await nav.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', locale: 'en-US' });
  for (const { f, n } of pendientes) {
    const ganador = n.resultado?.ganador?.nombre || n.jugadores[0];
    const perdedor = n.resultado?.perdedor?.nombre || n.jugadores?.[1];
    let elegida = null;
    for (const frase of [`${ganador} ${lugar(n)}`, `${ganador} ${perdedor || ''}`, ganador]) {
      try {
        await pg.goto(`https://www.gettyimages.com/search/2/image?phrase=${encodeURIComponent(frase.trim())}&sort=newest&family=editorial`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await pg.waitForTimeout(3500);
        const enlaces = await pg.$$eval('a[href*="/detail/news-photo/"]', (as) => as.slice(0, 40).map((a) => a.getAttribute('href')));
        elegida = elegir(enlaces, ganador, perdedor);
      } catch (e) { log('Getty: falló la búsqueda', frase, e.message); }
      if (elegida) break;
    }
    if (!elegida) { log('Getty: sin foto adecuada para', n.slug); continue; }
    const g = await embed(elegida.id).catch(() => null);
    if (!g) { log('Getty: no se obtuvo el código para', elegida.id); continue; }
    n.getty = g;
    fs.writeFileSync(path.join(DIR, f), JSON.stringify(n, null, 2) + '\n');
    log(`Getty: ${n.slug} → ${elegida.id} (${elegida.slug})`);
  }
} finally { await nav.close(); }
