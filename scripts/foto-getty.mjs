// Pone una foto de Getty Images (código oficial para incrustar) en una nota.
// Lo usa el formulario "Foto de Getty para una nota" (issues de GitHub). Solo acepta códigos de embed.gettyimages.com.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/util.mjs';

const cuerpo = process.env.CUERPO || '';
const salida = (ok, msg) => { fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `ok=${ok}\nmsg=${msg.replace(/\n/g, ' ')}\n`); console.log(msg); process.exit(0); };

// Link de la nota → slug
const link = cuerpo.match(/\/nota\/([a-z0-9-]+)/i);
if (!link) salida(false, 'No encontré el link de la nota. Tiene que ser de la forma https://atodotenis.vercel.app/nota/...');
const slug = link[1].toLowerCase();
const archivo = path.join(ROOT, 'content/notas', `${slug}.json`);
if (!fs.existsSync(archivo)) salida(false, `No existe la nota "${slug}".`);

// Código de Getty: el del widget (items, id, sig) o la dirección del iframe
const txt = cuerpo.replace(/&amp;/g, '&');
let src = null, w = 594, h = 396;
const iframe = txt.match(/https?:\/\/embed\.gettyimages\.com\/embed\/(\d+)\?[^"'\s<>]*/);
const items = txt.match(/items\s*:\s*'(\d+)'/), et = txt.match(/\bid\s*:\s*'([A-Za-z0-9_-]+)'/), sig = txt.match(/\bsig\s*:\s*'([A-Za-z0-9_=-]+)'/);
const tld = (txt.match(/tld\s*:\s*'([a-z.]+)'/) || [, 'com'])[1];
if (items && et && sig) src = `https://embed.gettyimages.com/embed/${items[1]}?et=${et[1]}&tld=${tld}&sig=${encodeURIComponent(sig[1])}&caption=true&ver=1`;
else if (iframe && /[?&]et=/.test(iframe[0]) && /[?&]sig=/.test(iframe[0])) src = iframe[0].replace(/^http:/, 'https:');
if (!src) salida(false, 'No reconocí el código de Getty. Copialo completo desde el botón "</>" (Embed) de la foto.');
const mw = txt.match(/\bw\s*:\s*'(\d+)px'/), mh = txt.match(/\bh\s*:\s*'(\d+)px'/);
if (mw && mh) { w = +mw[1]; h = +mh[1]; }

const n = JSON.parse(fs.readFileSync(archivo, 'utf8'));
n.getty = { src, w, h, fecha: new Date().toISOString() };
fs.writeFileSync(archivo, JSON.stringify(n, null, 2) + '\n');
salida(true, `Listo: la nota "${n.titulo}" ya tiene la foto de Getty. En unos minutos se ve en el sitio.`);
