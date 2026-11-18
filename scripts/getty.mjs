// Fotos de Getty Images para las notas nuevas, con su código oficial para incrustar (gratuito, con crédito de Getty).
// Busca en Getty (vía Firecrawl, plan gratuito) fotos editoriales del ganador en ese partido y pide el código con firma (oEmbed oficial).
// Solo toca notas publicadas de los últimos 3 días que todavía no tienen foto de Getty.
//   node scripts/getty.mjs            (SLUGS="a,b" para forzar notas puntuales)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './lib/util.mjs';

const DIR = path.join(ROOT, 'content/notas');
const DIAS = 3, MAX = 3; // notas por corrida (cada una usa 1 o 2 búsquedas)
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

// Elige la foto leyendo la descripción oficial de Getty, no el nombre del enlace:
// - la descripción tiene que EMPEZAR con el nombre del ganador (él es el protagonista, no el rival ni el público);
// - tiene que nombrar al rival o al torneo (es de ese partido) y ser de la fecha del partido en adelante;
// - se prefieren festejos del triunfo, después festejos, después juego; se descartan público, entrenadores, detalles.
function candidatas(meta, n, ganador, perdedor) {
  const caps = [].concat(meta?.caption || []), urls = [].concat(meta?.acquireLicensePage || []), subidas = [].concat(meta?.uploadDate || []);
  const g = norm(ganador), p = perdedor ? ape(perdedor) : null, sitio = norm(lugar(n));
  const desde = new Date(n.fechaPartido || n.fecha).getTime() - 3 * 3600e3;
  const vistos = new Set(), lista = [];
  caps.forEach((c, i) => {
    const id = String(urls[i] || '').match(/\/(\d{6,})(?:$|[/?#])/)?.[1];
    if (!id || vistos.has(id)) return; vistos.add(id);
    const t = norm(c);
    if (!t.startsWith(g)) return;
    if (!((p && t.includes(p)) || (sitio && t.includes(sitio)))) return;
    if (subidas[i] && new Date(subidas[i]).getTime() < desde) return;
    if (/fans|crowd|spectator|coach|team-member|tattoo|shoe|detail|ball-kid|umpire|logo|general-view|practi[cs]e|training|press-conference|media|portrait|arrives|warm/.test(t)) return;
    let s = 0;
    if (/celebrates-(victory|winning|the-win|after-winning|match-point)|match-point|celebrates-after|wins/.test(t)) s = 10;
    else if (/celebrates|fist|roars|shouts/.test(t)) s = 7;
    else if (/in-action|plays|serves|forehand|backhand|returns|hits/.test(t)) s = 5;
    else if (/reacts|looks|acknowledges|waves|applauds/.test(t)) s = 3;
    else s = 2;
    if (/prior-to|before-the|walks-out|makes-his-way|makes-her-way/.test(t)) s -= 3;
    if (s > 0) lista.push({ id, s, caption: c, orden: i });
  });
  return lista.sort((a, b) => b.s - a.s || a.orden - b.orden);
}

// Búsqueda en Getty a través de Firecrawl (plan gratuito; funciona incluso sin clave). Sin costo: si falla, se reintenta luego.
const USO = path.join(ROOT, 'data/getty-uso.json');
const LIMITE_MES = 900; // el plan gratuito trae 1.000 créditos por mes; cada búsqueda usa 1
const mes = new Date().toISOString().slice(0, 7);
const uso = (() => { try { const u = JSON.parse(fs.readFileSync(USO, 'utf8')); return u.mes === mes ? u : { mes, busquedas: 0 }; } catch { return { mes, busquedas: 0 }; } })();
async function buscar(frase) {
  if (uso.busquedas >= LIMITE_MES) throw new Error('cupo mensual gratuito alcanzado');
  uso.busquedas++;
  const url = `https://www.gettyimages.com/search/2/image?phrase=${encodeURIComponent(frase)}&sort=newest&family=editorial`;
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json', ...(process.env.FIRECRAWL_API_KEY ? { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` } : {}) },
    body: JSON.stringify({ url, formats: ['links'], onlyMainContent: false, maxAge: 0 }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(`Firecrawl ${r.status} ${d.error || ''}`.trim());
  return d.data?.metadata || {};
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

for (const { f, n } of pendientes) {
  const ganador = n.resultado?.ganador?.nombre || n.jugadores[0];
  const perdedor = n.resultado?.perdedor?.nombre || n.jugadores?.[1];
  let elegida = null;
  try {
    for (const frase of [`${ganador} ${perdedor || ''}`.trim(), `${ganador} ${lugar(n)}`]) {
      const lista = candidatas(await buscar(frase), n, ganador, perdedor);
      if (process.env.DEPURAR) log('Getty:', frase, '→', lista.slice(0, 3).map((x) => `${x.id}(${x.s})`).join(' '));
      // Entre las mejores, la primera apaisada (en las tarjetas de la portada una foto vertical queda recortada).
      for (const c of lista.slice(0, 30)) { // algunas colecciones asociadas no se pueden incrustar: se prueban varias
        const g = await embed(c.id).catch(() => null);
        if (!g && process.env.DEPURAR) log('Getty: no se puede incrustar', c.id);
        if (g && g.w >= g.h) { elegida = { ...c, g }; break; }
        if (g && !elegida?.g) elegida = { ...c, g, vertical: true };
      }
      if (elegida && !elegida.vertical) break;
    }
  } catch (e) { log('Getty: búsqueda no disponible,', e.message, '- se reintenta en la próxima corrida'); break; }
  if (!elegida) { log('Getty: todavía no hay una foto buena del ganador para', n.slug, '- se reintenta luego'); continue; }
  n.getty = elegida.g;
  fs.writeFileSync(path.join(DIR, f), JSON.stringify(n, null, 2) + '\n');
  log(`Getty: ${n.slug} → ${elegida.id}: ${elegida.caption.slice(0, 110)}`);
}
fs.writeFileSync(USO, JSON.stringify(uso) + '\n');
