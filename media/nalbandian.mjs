import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
for (const id of ['EJPgunRWZIY', 'Kiz3s14H8RE', '0AkltUBhLxk', 'QjFi5aS_zNo', 'iOXhqvD0iA4']) {
  try { const d = await (await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)).json(); console.log('YT', id, '|', d.author_name, '|', d.title); } catch (e) { console.log('YT', id, 'ERR', e.message); }
}
fs.mkdirSync('media/nalbandian', { recursive: true });
const lista = [];
for (const cat of ['David Nalbandian', 'Tennis Masters Cup 2005']) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtype=file&gcmlimit=80&gcmtitle=' + encodeURIComponent('Category:' + cat) + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800';
  const j = await (await fetch(u, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo?.[0]; if (!i || /\.(svg|gif|webm|ogv|pdf)$/i.test(p.title)) continue; const m = i.extmetadata || {};
    lista.push({ t: p.title, w: i.width, h: i.height, thumb: i.thumburl, orig: i.url, lic: m.LicenseShortName?.value, autor: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 80), fecha: (m.DateTimeOriginal?.value || '').replace(/<[^>]+>/g, '').slice(0, 20), desc: (m.ImageDescription?.value || '').replace(/<[^>]+>/g, '').slice(0, 120) });
  }
}
for (const [k, x] of lista.entries()) {
  const b = Buffer.from(await (await fetch(x.thumb, { headers: UA })).arrayBuffer()); x.f = String(k).padStart(2, '0') + '.jpg';
  fs.writeFileSync(`media/nalbandian/${x.f}`, b); await new Promise((r) => setTimeout(r, 300));
}
fs.writeFileSync('media/nalbandian/lista.json', JSON.stringify(lista, null, 1));
console.log('COMMONS', lista.length);
