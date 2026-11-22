// Busca fotos editoriales recientes en Getty (frase en media/getty-buscar.txt), guarda IDs + descripción y miniaturas.
import fs from 'node:fs';
import { chromium } from 'playwright';
const frase = fs.readFileSync('media/getty-buscar.txt', 'utf8').split('\n')[0].trim();
const dir = 'media/getty-buscar'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const nav = await chromium.launch();
const pg = await nav.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', locale: 'en-US' });
await pg.goto(`https://www.gettyimages.com/search/2/image?phrase=${encodeURIComponent(frase)}&sort=newest&family=editorial`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await pg.waitForTimeout(6000);
const items = await pg.$$eval('a[href*="/detail/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), alt: a.querySelector('img')?.getAttribute('alt') || '' })));
await nav.close();
const vistos = new Set(), out = [];
for (const it of items) {
  const id = it.href.match(/\/(\d{6,})(?:$|[/?#])/)?.[1];
  if (!id || vistos.has(id) || out.length >= 16) continue; vistos.add(id);
  try {
    const d = await (await fetch(`https://embed.gettyimages.com/oembed?url=${encodeURIComponent(`https://gty.im/${id}`)}`)).json();
    const html = d.html || '';
    const x = { id, alt: it.alt, titulo: d.title, et: html.match(/id:'([^']+)'/)?.[1], sig: html.match(/sig:'([^']+)'/)?.[1], w: +(html.match(/w:'(\d+)px'/)?.[1] || 0), h: +(html.match(/h:'(\d+)px'/)?.[1] || 0) };
    if (d.thumbnail_url) fs.writeFileSync(`${dir}/${id}.jpg`, Buffer.from(await (await fetch(d.thumbnail_url)).arrayBuffer()));
    out.push(x);
  } catch (e) { console.log(id, e.message); }
}
fs.writeFileSync(`${dir}/lista.json`, JSON.stringify(out, null, 1)); console.log(out.length, 'fotos');
