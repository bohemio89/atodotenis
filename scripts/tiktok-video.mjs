// Video TikTok (formato 2026-11): "Ellos" (ATP, oscuro) y "Ellas" (WTA, claro editorial).
// Primer cuadro con foto y gancho ya visibles; 12 s a 30 fps; sin música (se agrega en la app).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/util.mjs';
const R = ROOT;
const F = (p) => `file://${p}`;
const NM = path.join(ROOT, 'node_modules/@fontsource');
const FPS = 30;
const fuentes = `
@font-face{font-family:Anton;src:url(${F(NM + '/anton/files/anton-latin-400-normal.woff2')})}
@font-face{font-family:Serif;font-style:italic;src:url(${F(NM + '/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2')})}
@font-face{font-family:M;font-weight:800;src:url(${F(R + '/node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:M;font-weight:900;font-style:italic;src:url(${F(R + '/node_modules/@fontsource/montserrat/files/montserrat-latin-900-italic.woff2')})}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1920px;overflow:hidden;background:#000}
#p{position:relative;width:1080px;height:1920px;overflow:hidden}
.esc{position:absolute;inset:0;opacity:0}
@keyframes ver{from{opacity:1}to{opacity:1}}
@keyframes punch{0%{transform:scale(1.35)}12%{transform:scale(1.06)}100%{transform:scale(1.0)}}
@keyframes drift{from{transform:scale(1.12) translateY(0)}to{transform:scale(1.2) translateY(-30px)}}
@keyframes flash{0%{opacity:.95}100%{opacity:0}}
@keyframes entra{0%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes slam{0%{transform:scale(2.2);opacity:0}60%{transform:scale(.96);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes subir{0%{transform:translateY(120px);opacity:0}100%{transform:none;opacity:1}}
@keyframes izq{0%{transform:translateX(-1100px)}100%{transform:none}}
@keyframes pop{0%{transform:scale(0);opacity:0}70%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes sello{0%{transform:scale(0) rotate(-60deg)}70%{transform:scale(1.15) rotate(-6deg)}100%{transform:scale(1) rotate(-10deg)}}
@keyframes arco{0%{clip-path:inset(100% 0 0 0 round 470px 470px 28px 28px)}100%{clip-path:inset(0 0 0 0 round 470px 470px 28px 28px)}}
@keyframes barra{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
@keyframes latir{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`;
const A = (nombre, ini, dur, extra = '') => `animation:${nombre} ${dur}s ${extra || 'cubic-bezier(.2,.8,.2,1)'} ${ini}s both`;
const escena = (ini, fin, html) => `<div class="esc" style="animation:ver ${fin - ini}s linear ${ini}s">${html}</div>`;
const foto = (src, pos = 'center 30%') => `background:url(${F(src)}) ${pos}/cover`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const credito = (d, color) => d.credito ? `<div style="position:absolute;right:24px;bottom:22px;font:800 17px M;color:${color};opacity:.6">${esc(d.credito)}</div>` : '';

export function ellos(d) {
  const c = d.color, b = d.base || '#0B0D10';
  const filas = d.filas.map((f, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:30px 0;border-bottom:2px solid #ffffff22;${A('izq', 3.5 + i * .25, .5)}">
    <span style="font:800 54px M;color:${f.g ? c : '#fff'}">${f.j}</span><span style="display:flex;gap:44px">${f.s.map((s, k) => `<b style="font:120px/1 Anton;color:${f.g ? c : '#fff'};display:inline-block;${A('pop', 4.2 + k * .45 + i * .12, .35)}">${s}</b>`).join('')}</span></div>`).join('');
  return `<div id="p" style="background:${b};color:#fff">
  ${escena(0, 3.4, `<div style="position:absolute;inset:-40px;${foto(d.f1, d.p1)};transform-origin:50% 20%;${A('punch', 0, 3.4, 'cubic-bezier(.1,.7,.2,1)')}"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${b}cc 0,${b}00 18%,${b}00 48%,${b}f2 78%)"></div>
    <div style="position:absolute;top:150px;right:-14px;writing-mode:vertical-rl;transform:rotate(180deg);font:250px/.82 Anton;color:${c};text-transform:uppercase;">${d.ape}</div>
    <div style="position:absolute;top:66px;left:66px;display:flex;gap:18px;align-items:center;font:800 30px M;letter-spacing:.14em">A TODO <b style="color:${c}">TENIS</b><span style="background:${c};color:${b};padding:10px 20px;font-size:24px">${d.torneo}</span></div>
    <div style="position:absolute;left:66px;right:66px;bottom:330px;font:900 italic 150px/.86 M;letter-spacing:-.05em;text-transform:uppercase;transform-origin:left bottom;${A('entra', 0, .5)}">${d.hook}</div>
    <div style="position:absolute;left:66px;right:66px;bottom:220px;font:800 48px M;${A('subir', .45, .4)}">${d.sub}</div>
    `)}
  ${escena(3.4, 8.0, `<div style="position:absolute;inset:0;${foto(d.f2, d.p2)};${A('drift', 3.4, 4.6, 'linear')};filter:grayscale(.3) brightness(.5)"></div>
    <div style="position:absolute;top:300px;left:66px;right:66px;font:900 italic 96px/.9 M;text-transform:uppercase;white-space:nowrap;${A('slam', 3.4, .4)}">Marcador <span style="color:${c}">final</span></div>
    <div style="position:absolute;top:470px;left:66px;font:800 32px M;letter-spacing:.2em;color:#ffffffaa;${A('subir', 3.6, .4)}">${d.ronda}</div>
    <div style="position:absolute;left:66px;right:66px;top:580px;border-top:8px solid ${c};transform-origin:left;${A('barra', 3.5, .5)}">${filas}</div>
    <div style="position:absolute;left:66px;right:66px;bottom:240px;font:800 50px/1.2 M;${A('subir', 6.0, .5)}">${d.dato}</div>`)}
  ${escena(8.0, 12.0, `<div style="position:absolute;inset:-40px;${foto(d.f3, d.p3)};${A('drift', 8.0, 4, 'linear')}"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${b}00 35%,${b}f5 75%)"></div>
    <div style="position:absolute;left:66px;right:66px;bottom:470px;font:900 italic 112px/.9 M;text-transform:uppercase;letter-spacing:-.04em;${A('slam', 8.1, .45)}">${d.pregunta}</div>
    <div style="position:absolute;left:66px;bottom:300px;background:${c};color:${b};font:900 italic 54px M;padding:18px 34px;${A('pop', 8.7, .4)}">COMENTÁ</div>
    <div style="position:absolute;left:66px;bottom:170px;font:800 32px M;letter-spacing:.16em;${A('subir', 9.0, .4)}">A TODO <b style="color:${c}">TENIS</b></div>
    <div style="position:absolute;inset:0;background:#fff;${A('flash', 8.0, .15, 'linear')}"></div>`)}
  ${credito(d, '#fff')}</div>`;
}

export function ellas(d) {
  const c = d.color, b = '#FFF1E8', t = '#2B0A1A';
  const filas = d.filas.map((f, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:3px solid ${t}22;${A('subir', 3.6 + i * .25, .5)}">
    <span style="font:800 52px M;color:${f.g ? c : t}">${f.j}</span><span style="display:flex;gap:44px">${f.s.map((s, k) => `<b style="font:120px/1 Anton;color:${f.g ? c : t};display:inline-block;${A('pop', 4.2 + k * .45 + i * .12, .35)}">${s}</b>`).join('')}</span></div>`).join('');
  return `<div id="p" style="background:${b};color:${t}">
  ${escena(0, 3.4, `<div style="position:absolute;top:66px;left:70px;right:70px;display:flex;justify-content:space-between;font:800 30px M;letter-spacing:.14em">A TODO <b style="color:${c};margin-right:auto;margin-left:12px">TENIS</b><span style="border:3px solid ${t};border-radius:40px;padding:8px 22px;font-size:24px">${d.torneo}</span></div>
    <div style="position:absolute;top:150px;left:70px;right:70px;height:1060px;border-radius:470px 470px 28px 28px;overflow:hidden;"><div style="position:absolute;inset:-30px;${foto(d.f1, d.p1)};transform-origin:50% 20%;${A('punch', 0, 3.4, 'cubic-bezier(.1,.7,.2,1)')}"></div></div>
    <div style="position:absolute;top:1080px;right:100px;width:240px;height:240px;border-radius:50%;background:${c};color:${b};display:flex;align-items:center;justify-content:center;text-align:center;font:900 italic 38px/1.05 M;${A('sello', .0, .4)}">${d.sello}</div>
    <div style="position:absolute;left:70px;top:1250px;font:italic 130px/1 Serif;">${d.nom}</div>
    <div style="position:absolute;left:70px;top:1380px;font:215px/.9 Anton;color:${c};text-transform:uppercase;transform-origin:left;${A('entra', 0, .5)}">${d.ape}</div>
    <div style="position:absolute;left:70px;right:70px;bottom:150px;font:800 52px/1.2 M">${d.hook}</div>
    `)}
  ${escena(3.4, 8.0, `<div style="position:absolute;top:160px;left:70px;right:70px;height:560px;border-radius:28px;overflow:hidden;${A('arco', 3.4, .45)}"><div style="position:absolute;inset:-30px;${foto(d.f2, d.p2)};${A('drift', 3.4, 4.6, 'linear')}"></div></div>
    <div style="position:absolute;top:780px;left:70px;font:italic 96px/1 Serif;${A('subir', 3.5, .4)}">Marcador <span style="color:${c}">final</span></div>
    <div style="position:absolute;top:900px;left:70px;font:800 30px M;letter-spacing:.2em;opacity:.7">${d.ronda}</div>
    <div style="position:absolute;left:70px;right:70px;top:980px;border-top:8px solid ${c};transform-origin:left;${A('barra', 3.5, .5)}">${filas}</div>
    <div style="position:absolute;left:70px;right:70px;bottom:150px;font:800 50px/1.2 M;${A('subir', 6.0, .5)}">${d.dato}</div>`)}
  ${escena(8.0, 12.0, `<div style="position:absolute;inset:0;background:${c}"></div>
    <div style="position:absolute;top:150px;left:150px;right:150px;height:900px;border-radius:390px 390px 28px 28px;overflow:hidden;${A('arco', 8.0, .45)}"><div style="position:absolute;inset:-30px;${foto(d.f3, d.p3)};${A('drift', 8, 4, 'linear')}"></div></div>
    <div style="position:absolute;left:70px;right:70px;top:1120px;text-align:center;font:italic 120px/1 Serif;color:${b};${A('slam', 8.2, .45)}">${d.pregunta}</div>
    <div style="position:absolute;left:50%;top:1500px;transform:translateX(-50%);"><div style="background:${b};color:${c};font:900 italic 54px M;padding:18px 40px;border-radius:60px;white-space:nowrap;${A('pop', 8.8, .4)}">COMENTÁ</div></div>
    <div style="position:absolute;left:0;right:0;bottom:150px;text-align:center;font:800 32px M;letter-spacing:.16em;color:${b}">A TODO TENIS</div>`)}
  ${credito(d, t)}</div>`;
}

export async function renderTikTok(d, salida, dur = 12) {
  const html = d.formato === 'ellas' ? ellas(d) : ellos(d);
  const dir = path.join(ROOT, 'node_modules', `.tiktok-cuadros-${Date.now()}`); fs.mkdirSync(dir, { recursive: true });
  const pagina = path.join(ROOT, 'node_modules', '.tiktok-video.html');
  fs.writeFileSync(pagina, `<meta charset="utf-8"><style>${fuentes}</style>${html}`);
  const { chromium } = await import('playwright-core');
  const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const pg = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.goto(F(pagina), { waitUntil: 'networkidle', timeout: 60000 });
  await pg.evaluate(() => document.fonts.ready);
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await pg.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (i / FPS) * 1000);
    await pg.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  await nav.close();
  const ff = process.env.FFMPEG_PATH || 'ffmpeg';
  execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%04d.jpg`, '-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', salida]);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', salida, '-frames:v', '1', salida.replace(/\.mp4$/, '-portada.jpg')]);
  fs.rmSync(dir, { recursive: true });
  return salida.replace(/\.mp4$/, '-portada.jpg');
}


