import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
fs.rmSync('media/nalbandian', { recursive: true, force: true }); fs.mkdirSync('media/nalbandian', { recursive: true });
const pags = {};
for (const q of ['Nalbandian', 'David Nalbandian tennis', 'Nalbandian Davis Cup', 'Nalbandian 2005', 'Nalbandian 2007', 'Nalbandian 2008']) {
  const p = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '50', gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '700' });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${p}`, { headers: UA }); if (r.ok) Object.assign(pags, (await r.json()).query?.pages || {});
}
const lista = [];
for (const p of Object.values(pags)) {
  const i = p.imageinfo?.[0]; if (!i) continue; const m = i.extmetadata || {};
  if (!/nalbandian/i.test(p.title + (m.ImageDescription?.value || ''))) continue;
  lista.push({ t: p.title, w: i.width, h: i.height, thumb: i.thumburl, orig: i.url, lic: (m.LicenseShortName?.value || ''), autor: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 80), fecha: (m.DateTimeOriginal?.value || '').replace(/<[^>]+>/g, '').slice(0, 20) });
}
lista.sort((a, b) => b.w * b.h - a.w * a.h);
for (const [k, x] of lista.slice(0, 40).entries()) {
  x.f = String(k).padStart(2, '0') + '.jpg';
  fs.writeFileSync(`media/nalbandian/${x.f}`, Buffer.from(await (await fetch(x.thumb, { headers: UA })).arrayBuffer())); await new Promise((r) => setTimeout(r, 300));
}
fs.writeFileSync('media/nalbandian/lista.json', JSON.stringify(lista.slice(0, 40), null, 1));
console.log('COMMONS', lista.length);
