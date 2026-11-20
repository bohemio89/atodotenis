// Baja miniaturas de Getty (vía oEmbed oficial) para elegir foto a ojo, y deja el código de incrustación.
import fs from 'node:fs';
const dir = process.env.DIR || 'media/getty-ver'; fs.mkdirSync(dir, { recursive: true });
const out = [];
for (const id of process.argv.slice(2)) {
  try {
    const d = await (await fetch(`https://embed.gettyimages.com/oembed?url=${encodeURIComponent(`https://gty.im/${id}`)}`)).json();
    const html = d.html || '';
    const x = { id, et: html.match(/id:'([^']+)'/)?.[1], sig: html.match(/sig:'([^']+)'/)?.[1], w: +(html.match(/w:'(\d+)px'/)?.[1] || 0), h: +(html.match(/h:'(\d+)px'/)?.[1] || 0), thumb: d.thumbnail_url };
    if (d.thumbnail_url) fs.writeFileSync(`${dir}/${id}.jpg`, Buffer.from(await (await fetch(d.thumbnail_url)).arrayBuffer()));
    out.push(x); console.log(JSON.stringify(x));
  } catch (e) { console.log(id, 'ERR', e.message); }
}
fs.writeFileSync(`${dir}/lista.json`, JSON.stringify(out, null, 1));
