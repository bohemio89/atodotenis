import { chromium } from 'playwright-core';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await nav.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', locale: 'en-US' });
const p = await ctx.newPage();
await p.goto('https://www.atptour.com/en/rankings/singles?rankRange=1-200', { waitUntil: 'domcontentloaded', timeout: 60000 });
for (let i = 0; i < 20; i++) { const t = await p.title(); console.log('PROBE title', t); if (!/moment/i.test(t)) break; await p.waitForTimeout(3000); }
const filas = await p.evaluate(() => [...document.querySelectorAll('table tbody tr')].slice(0, 12).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
console.log('PROBE filas', filas.length, JSON.stringify(filas));
const html = await p.content(); console.log('PROBE html', html.length);
require = null;
await nav.close();
