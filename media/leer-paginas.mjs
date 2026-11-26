// Abre cada URL oficial con Chromium, espera a que cargue y guarda el texto visible en media/paginas/<n>.txt
import { chromium } from 'playwright';
import fs from 'node:fs';
const urls = fs.readFileSync('media/leer-paginas.txt', 'utf8').split(/\s+/).filter(Boolean);
fs.rmSync('media/paginas', { recursive: true, force: true }); fs.mkdirSync('media/paginas', { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 2000 } });
for (const [i, u] of urls.entries()) {
  try { await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 }); } catch {}
  await p.waitForTimeout(3000);
  const t = await p.evaluate(() => document.body.innerText).catch(() => '');
  fs.writeFileSync(`media/paginas/${String(i).padStart(2, '0')}.txt`, u + '\n\n' + t);
}
await b.close();
