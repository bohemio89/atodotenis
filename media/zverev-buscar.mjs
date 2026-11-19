import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
fs.mkdirSync('media/zverev', { recursive: true });
const lista = [];
for (const q of ['Alexander Zverev 2026', 'Alexander Zverev 2025', 'Zverev portrait', 'Alexander Zverev celebrates']) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=600';
  const j = await (await fetch(u, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo[0], m = i.extmetadata || {};
    if (!/zverev/i.test(p.title) || i.width < 1500 || lista.some((x) => x.t === p.title)) continue;
    if (/mischa|doubles|and |vs\.?|with/i.test(p.title)) continue;
    lista.push({ t: p.title, w: i.width, h: i.height, thumb: i.thumburl, orig: i.url, lic: m.LicenseShortName?.value, autor: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 60) });
  }
}
const elegidas = lista.slice(0, 24);
for (const [k, x] of elegidas.entries()) {
  const b = Buffer.from(await (await fetch(x.thumb, { headers: UA })).arrayBuffer());
  fs.writeFileSync(`media/zverev/${String(k).padStart(2, '0')}.jpg`, b);
}
fs.writeFileSync('media/zverev/lista.json', JSON.stringify(elegidas, null, 1));
console.log(elegidas.length, 'fotos');
