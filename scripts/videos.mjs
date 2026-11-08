// Highlights para las notas: busca en los canales oficiales de YouTube (lista pública de últimos videos,
// sin clave ni costo) un video cuyo título nombre a los dos jugadores del partido, y lo guarda para insertarlo.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './lib/util.mjs';

// Canales oficiales (IDs verificados en youtube.com)
const CANALES = {
  atp: [['Tennis TV', 'UCbcxFkd6B9xUU54InHv4Tig'], ['ATP Tour', 'UCY_5h5zaSwN7Or4kIJDYNXA']],
  wta: [['WTA', 'UCaBIVVpHjq6j3tSyxwTE-8Q']]
};
const DIAS_MAX = 5;
const dir = path.join(ROOT, 'content/notas');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const apellido = (n) => norm(String(n || '').trim().split(/\s+/).pop());
const des = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function feed(nombre, id) {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
      id: (e.match(/<yt:videoId>([^<]+)/) || [])[1],
      titulo: des((e.match(/<title>([^<]*)/) || [])[1] || ''),
      publicado: (e.match(/<published>([^<]+)/) || [])[1],
      canal: nombre
    })).filter((v) => v.id);
  } catch (e) { log(`YouTube ${nombre} falló: ${e.message}`); return []; }
}

async function main() {
  const notas = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, n: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
    .filter(({ n }) => n.estado === 'publicada' && !n.video && n.fechaPartido && Date.now() - new Date(n.fechaPartido) < DIAS_MAX * 864e5 && (n.jugadores || []).length === 2);
  if (!notas.length) { log('Videos: no hay notas recientes sin video'); return; }
  const cache = {};
  let puestos = 0;
  for (const { f, n } of notas) {
    if (n.jugadores.some((j) => j.includes('/'))) continue; // dobles: los highlights suelen no existir
    const lista = [];
    for (const [nombre, id] of [...CANALES.atp, ...CANALES.wta]) lista.push(...(cache[id] ||= await feed(nombre, id)));
    const [a, b] = n.jugadores.map(apellido);
    const desde = new Date(n.fechaPartido).getTime() - 2 * 3600e3;
    const opciones = lista.filter((v) => {
      const t = norm(v.titulo);
      return t.includes(a) && t.includes(b) && new Date(v.publicado).getTime() >= desde && !/press conference|interview|reacts|on-court interview/i.test(v.titulo);
    }).sort((x, y) => (/highlight/i.test(y.titulo) - /highlight/i.test(x.titulo)) || String(x.publicado).localeCompare(String(y.publicado)));
    const v = opciones[0];
    if (!v) continue;
    n.video = { youtube: v.id, titulo: v.titulo, canal: v.canal, publicado: v.publicado };
    fs.writeFileSync(path.join(dir, f), JSON.stringify(n, null, 1) + '\n');
    log(`Video para "${n.titulo}": ${v.titulo} (${v.canal})`);
    puestos++;
  }
  log(`Videos encontrados: ${puestos} de ${notas.length} notas recientes`);
}

main().catch((e) => { console.error('ERROR videos:', e.message); process.exit(0); });
