// Declaraciones de jugadores para las notas de duelos importantes.
// Solo fuentes oficiales que permiten la lectura: el canal de noticias de la WTA, el sitio de las ATP Finals
// y los sitios de los Grand Slam. La frase se toma textual de la fuente (en inglés), se atribuye al jugador
// solo si el mismo párrafo dice que la dijo él o ella, y se traduce sin agregar nada.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, log } from './lib/util.mjs';

const CONFIG = leerJSON('config.json', {});
const KEY = process.env.GEMINI_API_KEY;
const DIR = path.join(ROOT, 'content/notas');
const UA = { 'User-Agent': 'AtodoTenis/1.0 (+https://atodotenis.vercel.app)' };
const HORAS_MAX = 72;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const apellido = (n) => String(n || '').trim().split(/\s+/).pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decod = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&hellip;/g, '…').replace(/\s+/g, ' ').trim();
export const parrafos = (html) => [...String(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => decod(m[1])).filter((t) => t.length > 20);
async function traer(url, tipo = 'text') {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return tipo === 'json' ? r.json() : r.text();
}

// ---------- Fuentes ----------
let wtaCache = null;
async function articulosWTA() {
  if (wtaCache) return wtaCache;
  const j = await traer('https://api.wtatennis.com/content/wta/text/EN/?pageSize=60', 'json');
  const color = /social buzz|lifestyle|fashion|photos|style/i;
  wtaCache = (j.content || []).filter((a) => a.body && !(a.tags || []).some((t) => color.test(t.label || ''))).map((a) => ({
    fecha: a.date, titulo: a.title || '', parrafos: parrafos(a.body),
    url: `https://www.wtatennis.com/news/${a.id}/${a.titleUrlSegment || ''}`, fuente: 'la WTA'
  }));
  return wtaCache;
}
// Sitios con lista de noticias en HTML: se leen los artículos más recientes
const SITIOS = [
  { re: /finals/i, tour: 'atp', lista: 'https://www.nittoatpfinals.com/en/news', base: 'https://www.nittoatpfinals.com', link: /href="(\/en\/news\/[a-z0-9-]+)"/gi, fuente: 'el sitio oficial de las ATP Finals' },
  { re: /australian open|melbourne/i, lista: 'https://ausopen.com/news', base: 'https://ausopen.com', link: /href="(\/articles\/news\/[a-z0-9-]+)"/gi, fuente: 'el sitio oficial del Abierto de Australia' },
  { re: /roland garros|french open/i, lista: 'https://www.rolandgarros.com/en-us/news', base: 'https://www.rolandgarros.com', link: /href="(\/en-us\/article\/[a-z0-9-]+)"/gi, fuente: 'el sitio oficial de Roland Garros' },
  { re: /wimbledon/i, lista: 'https://www.wimbledon.com/en_GB/news/index.html', base: 'https://www.wimbledon.com', link: /href="(\/en_GB\/news\/articles\/[^"]+\.html)"/gi, fuente: 'el sitio oficial de Wimbledon' }
];
const sitioCache = {};
async function articulosSitio(s) {
  if (sitioCache[s.lista]) return sitioCache[s.lista];
  const html = await traer(s.lista);
  const links = [...new Set([...html.matchAll(s.link)].map((m) => s.base + m[1]))].slice(0, 12);
  const arts = [];
  for (const url of links) {
    try {
      const h = await traer(url);
      const fecha = (h.match(/"datePublished"\s*:\s*"([^"]+)"/) || h.match(/article:published_time"\s+content="([^"]+)"/) || [])[1] || null;
      arts.push({ fecha, titulo: decod((h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ''), parrafos: parrafos(h), url, fuente: s.fuente });
    } catch (e) { log('No se pudo leer', url, e.message); }
  }
  return (sitioCache[s.lista] = arts);
}

// ---------- Extracción ----------
const VERBOS = '(?:said|told|added|explained|admitted|reflected|noted|insisted|smiled|laughed|joked)';
export function citasDe(arts, quien, rival, desde, hasta) {
  const ap = apellido(quien), apR = apellido(rival);
  const out = [];
  for (const a of arts) {
    if (a.fecha) { const f = new Date(a.fecha).getTime(); if (f < desde || f > hasta) continue; }
    const todo = norm([a.titulo, ...a.parrafos].join(' '));
    if (!todo.includes(norm(ap)) || !todo.includes(norm(apR))) continue; // el artículo tiene que hablar de este partido
    for (const p of a.parrafos) {
      const atrib = new RegExp(`(${VERBOS}\\s+(?:[\\w.'-]+\\s+){0,4}?${ap}\\b|\\b${ap}\\s+${VERBOS}|\\b(?:the\\s+)?[\\w.'-]+\\s+${VERBOS}\\s+${ap}\\b)`, 'i');
      if (!atrib.test(p)) continue;
      // si el párrafo nombra al rival como quien habla, se descarta por ambigüedad
      if (new RegExp(`(${VERBOS}\\s+${apR}\\b|\\b${apR}\\s+${VERBOS})`, 'i').test(p)) continue;
      const m = p.match(/["“]([^"”]{25,320})["”]/);
      if (!m) continue;
      const frase = m[1].trim().replace(/,$/, '.');
      const palabras = frase.split(/\s+/).length;
      if (palabras < 6 || palabras > 45) continue;
      // puntaje: crónica del partido (título con ambos apellidos) y frase que habla del juego
      const tituloN = norm(a.titulo);
      const juego = (frase.match(/\b(match|set|sets|serve|serving|return|point|points|break|game|games|win|won|lose|lost|opponent|final|semifinal|semi-final|quarterfinal|tournament|level|tennis|rally|rallies|confidence|played|play|playing|pressure|body|tired|happy|proud)\b/gi) || []).length;
      if (!juego) continue;
      const puntaje = juego + (tituloN.includes(norm(ap)) && tituloN.includes(norm(apR)) ? 3 : 0);
      out.push({ frase, url: a.url, fuente: a.fuente, fecha: a.fecha, puntaje });
    }
  }
  return out;
}

// ---------- Traducción ----------
async function traducir(frase, femenino) {
  const prompt = `Traducí al español rioplatense neutro, de forma fiel, esta declaración de ${femenino ? 'una tenista del circuito femenino (si habla de ella y su rival, usá el femenino: "las dos", "rivales")' : 'un tenista'}. No agregues ni quites información, no expliques nada, mantené la primera persona. Devolvé SOLO JSON {"traduccion": "..."}.\n\nDeclaración: "${frase}"`;
  for (const modelo of CONFIG.notas?.modelos || ['gemini-flash-latest']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
      });
      if (!r.ok) { log(`Gemini ${modelo} HTTP ${r.status}`); continue; }
      const j = await r.json();
      const t = JSON.parse((j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '{}').replace(/^```json\s*|```\s*$/g, '')).traduccion;
      if (!t) continue;
      // controles: los números tienen que ser los mismos y el largo razonable
      const nums = (s) => (s.match(/\d+/g) || []).sort().join(',');
      if (nums(t) !== nums(frase)) { log('Traducción descartada: cambian los números'); continue; }
      if (t.length > frase.length * 1.8 || t.length < frase.length * 0.5) { log('Traducción descartada: largo raro'); continue; }
      return t.replace(/^["“«]|["”»]$/g, '').trim();
    } catch (e) { log('Gemini falló:', e.message); }
  }
  return null;
}

// ---------- Principal ----------
async function main() {
  if (!KEY) { log('Sin GEMINI_API_KEY: no se buscan declaraciones'); return; }
  const notas = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, n: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }))
    .filter(({ n }) => n.estado === 'publicada' && !n.declaracion && (n.importancia ?? 0) >= 65 && n.fechaPartido && (n.jugadores || []).length === 2
      && Date.now() - new Date(n.fechaPartido).getTime() < HORAS_MAX * 3600e3 && !n.jugadores.some((j) => j.includes('/')));
  if (!notas.length) { log('Declaraciones: no hay notas importantes recientes sin declaración'); return; }
  for (const { f, n } of notas) {
    const [ganador, perdedor] = n.jugadores;
    const desde = new Date(n.fechaPartido).getTime() - 3600e3, hasta = desde + HORAS_MAX * 3600e3;
    const esWTA = /wta/i.test(`${n.categoria} ${(n.etiquetas || []).join(' ')}`);
    let arts = [];
    try {
      const sitio = SITIOS.find((s) => s.re.test(`${n.torneo} ${n.categoria}`) && (!s.tour || !esWTA));
      if (sitio) arts = await articulosSitio(sitio);
      if (esWTA) arts = [...arts, ...(await articulosWTA())];
    } catch (e) { log('Fuente no disponible:', e.message); }
    if (!arts.length) continue;
    const citas = [...citasDe(arts, ganador, perdedor, desde, hasta).map((c) => ({ ...c, jugador: ganador })),
      ...citasDe(arts, perdedor, ganador, desde, hasta).map((c) => ({ ...c, jugador: perdedor }))];
    citas.sort((x, y) => y.puntaje - x.puntaje || (x.jugador === ganador ? -1 : 1));
    const c = citas[0];
    if (!c) { log(`Sin declaración verificable para "${n.titulo}"`); continue; }
    const texto = await traducir(c.frase, esWTA);
    if (!texto) continue;
    n.declaracion = { jugador: c.jugador, texto, original: c.frase, fuente: c.fuente, url: c.url, fecha: c.fecha || null };
    fs.writeFileSync(path.join(DIR, f), JSON.stringify(n, null, 1) + '\n');
    log(`Declaración para "${n.titulo}": ${c.jugador} (${c.fuente})`);
  }
}

main().catch((e) => { console.log('::warning::Declaraciones:', e.message); process.exit(0); });
