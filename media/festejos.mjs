// Busca en Commons fotos recientes de festejo (alta resolución, licencia libre) para las placas de Instagram.
import fs from 'node:fs';
const API = 'https://commons.wikimedia.org/w/api.php', UA = 'AToDoTenisBot/1.0 (https://atodotenis.vercel.app)';
const LIC = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const limpiar = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const salida = {};
for (const j of process.env.JUGADORES.split(',')) {
  const ap = norm(j).split(' ').pop(), pags = {};
  for (const q of [`"${j}" celebrates`, `"${j}" celebrating`, `"${j}" 2026`, `"${j}" 2025`, `"${j}"`]) {
    const p = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '50', gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1600' });
    const r = await fetch(`${API}?${p}`, { headers: { 'User-Agent': UA } }); if (r.ok) Object.assign(pags, (await r.json()).query?.pages || {});
    await espera(400);
  }
  const c = [];
  for (const p of Object.values(pags)) {
    const ii = p.imageinfo?.[0]; if (!ii) continue; const m = ii.extmetadata || {};
    const lic = limpiar(m.LicenseShortName?.value); if (!LIC.test(lic)) continue;
    if (!norm(p.title).includes(ap)) continue;
    const f = limpiar(m.DateTimeOriginal?.value || m.DateTime?.value).match(/(\d{4})/); const anio = f ? +f[1] : 0; if (anio < 2024) continue;
    if (Math.min(ii.width, ii.height) < 1500) continue;
    const t = norm(limpiar(m.ImageDescription?.value) + ' ' + p.title);
    if (/\b(and|vs|doubles|team|crowd|fans|press conference)\b/.test(t) || /gonzalez/.test(t)) continue;
    const festejo = /(celebrat|fist|reacts|jubel|trophy|victory|winning|wins)/.test(t);
    c.push({ titulo: p.title, url: ii.thumburl || ii.url, ancho: ii.width, alto: ii.height, anio, festejo, autor: limpiar(m.Artist?.value).slice(0, 60), licencia: lic, puntaje: (festejo ? 100 : 0) + anio + (ii.height > ii.width ? 2 : 0) });
  }
  salida[j] = c.sort((a, b) => b.puntaje - a.puntaje).slice(0, 6);
  fs.mkdirSync(`media/festejos/${norm(j).replace(/[^a-z0-9]+/g, '-')}`, { recursive: true });
  let i = 0;
  for (const f of salida[j]) {
    const r = await fetch(f.url, { headers: { 'User-Agent': UA } }); if (!r.ok) continue;
    fs.writeFileSync(`media/festejos/${norm(j).replace(/[^a-z0-9]+/g, '-')}/${++i}.jpg`, Buffer.from(await r.arrayBuffer())); f.archivo = `${i}.jpg`; await espera(600);
  }
  console.log(j, salida[j].map((x) => `${x.archivo} ${x.festejo ? 'FESTEJO' : ''} ${x.anio} ${x.titulo}`).join('\n  '));
}
fs.writeFileSync('media/festejos/indice.json', JSON.stringify(salida, null, 1));
