// Capturas del sitio en vivo (celular, página completa) para videos promocionales.
import fs from 'node:fs';
import { chromium } from 'playwright';
const rutas = fs.readFileSync('media/sitio-capturas.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const dir = 'media/sitio-capturas'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-AR' });
const p = await ctx.newPage();
for (const r of rutas) {
  const [nombre, ruta] = r.split('|');
  await p.goto('https://atodotenis.vercel.app' + ruta, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(4000);
  await p.evaluate(() => document.querySelectorAll('[class*=cookie],[id*=cookie]').forEach((e) => e.remove()));
  await p.screenshot({ path: `${dir}/${nombre}.jpg`, type: 'jpeg', quality: 88, fullPage: true });
  console.log('ok', nombre);
}
await b.close();
