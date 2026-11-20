import fs from 'node:fs';
const UA = { 'User-Agent': 'ATodoTenis/1.0 (https://atodotenis.vercel.app)' };
fs.mkdirSync('media/nalbandian/hd', { recursive: true });
for (const t of ['David_Nalbandian_at_the_2008_BNP_Paribas_Masters2.jpg', 'David_Nalbandian_at_the_2008_BNP_Paribas_Masters.jpg', 'David_Nalbandian_at_the_2010_US_Open_03.jpg', 'David_Nalbandian_-_US_Open_2006.jpg']) {
  const p = new URLSearchParams({ action: 'query', format: 'json', titles: 'File:' + t, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1800' });
  const j = await (await fetch(`https://commons.wikimedia.org/w/api.php?${p}`, { headers: UA })).json();
  const u = Object.values(j.query.pages)[0].imageinfo[0].thumburl;
  fs.writeFileSync('media/nalbandian/hd/' + t, Buffer.from(await (await fetch(u, { headers: UA })).arrayBuffer()));
  console.log('OK', t); await new Promise((r) => setTimeout(r, 800));
}
