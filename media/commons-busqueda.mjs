// Busca fotos en Wikimedia Commons por texto (varias consultas) y baja miniaturas para elegir.
// Uso: node media/commons-busqueda.mjs carpeta "consulta 1" "consulta 2" ...
import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
const [dir, ...qs] = process.argv.slice(2);
fs.mkdirSync(`media/${dir}`, { recursive: true });
const lista = [];
for (const q of qs) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500';
  const j = await (await fetch(u, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo?.[0]; if (!i) continue; const m = i.extmetadata || {};
    if (i.width < 1200 || lista.some((x) => x.t === p.title)) continue;
    lista.push({ t: p.title, w: i.width, h: i.height, thumb: i.thumburl, orig: i.url, lic: m.LicenseShortName?.value, autor: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 60), fecha: (m.DateTimeOriginal?.value || '').replace(/<[^>]+>/g, '').slice(0, 20) });
  }
}
const sel = lista.slice(0, 60);
for (const [k, x] of sel.entries()) {
  try { const b = Buffer.from(await (await fetch(x.thumb, { headers: UA })).arrayBuffer()); fs.writeFileSync(`media/${dir}/${String(k).padStart(2, '0')}.jpg`, b); } catch {}
}
fs.writeFileSync(`media/${dir}/lista.json`, JSON.stringify(sel, null, 1));
console.log(dir, sel.length);
