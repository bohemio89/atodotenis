import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
fs.mkdirSync('media/alcaraz', { recursive: true });
const lista = [];
for (const cat of ['Carlos Alcaraz in 2026', 'Carlos Alcaraz in 2025', 'Carlos Alcaraz']) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtype=file&gcmlimit=60&gcmsort=timestamp&gcmdir=desc&gcmtitle=' + encodeURIComponent('Category:' + cat) + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=600';
  const j = await (await fetch(u, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo?.[0]; if (!i) continue; const m = i.extmetadata || {};
    if (i.width < 1400 || lista.some((x) => x.t === p.title) || /\.(svg|gif|webm|ogv)$/i.test(p.title)) continue;
    lista.push({ t: p.title, w: i.width, h: i.height, thumb: i.thumburl, orig: i.url, lic: m.LicenseShortName?.value, autor: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 60) });
  }
}
const elegidas = lista.slice(0, 36);
for (const [k, x] of elegidas.entries()) {
  const b = Buffer.from(await (await fetch(x.thumb, { headers: UA })).arrayBuffer());
  fs.writeFileSync(`media/alcaraz/${String(k).padStart(2, '0')}.jpg`, b);
}
fs.writeFileSync('media/alcaraz/lista.json', JSON.stringify(elegidas, null, 1));
console.log(elegidas.length, 'fotos');
