// Placa de resultado para Instagram en las ATP Finals (estilo "estadio" aprobado por Jonathan), 1080x1080.
// Jugador recortado (foto libre de Commons, recorte en scripts/ig-recortes), titular con datos, sin adjetivos.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, IOC_ISO2 } from './lib/util.mjs';

const F = (p) => `file://${p}`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slugJ = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const DIR_RECORTES = path.join(ROOT, 'scripts/ig-recortes');

export const esATPFinals = (n) => /finals/i.test(`${n.torneo} ${n.categoria}`) && !/wta/i.test(`${n.torneo} ${n.categoria}`);
export const tieneRecorte = (nombre) => fs.existsSync(path.join(DIR_RECORTES, `${slugJ(nombre)}.png`));

function jugadorOficial(nombre) {
  const lista = Object.values(leerJSON('data/jugadores.json', {}).lista || {});
  const ap = norm(nombre).split(' ').pop();
  return lista.find((j) => norm(j.nombre) === norm(nombre)) || lista.find((j) => norm(j.nombre).split(' ').pop() === ap && norm(j.nombre)[0] === norm(nombre)[0]) || {};
}

export function datosFinals(n) {
  const r = n.resultado, g = r.ganador.nombre, p = r.perdedor.nombre;
  const ev = (leerJSON('content/finales.json', { eventos: [] }).eventos || []).find((e) => e.tour === 'atp') || {};
  const grupo = (ev.grupos || []).find((gr) => gr.jugadores.some((x) => norm(x).split(' ').pop() === norm(g).split(' ').pop()));
  const ronda = String(r.ronda || '').toUpperCase();
  const of = jugadorOficial(g);
  const apG = g.trim().split(/\s+/).slice(-1)[0];
  const titular = ronda === 'F' ? '¡CAMPEÓN!' : ronda === 'SF' ? '¡A LA FINAL!' : Number(of.ranking) === 1 ? '¡GANÓ EL N° 1!' : `¡GANÓ ${apG.toUpperCase()}!`;
  const iso = (IOC_ISO2 || {})[String(of.pais || '').toLowerCase()] || (of.pais && String(of.pais).length === 2 ? of.pais : null);
  const bandera = iso && fs.existsSync(path.join(ROOT, 'static/banderas', `${iso}.svg`)) ? path.join(ROOT, 'static/banderas', `${iso}.svg`) : null;
  const fechaBase = n.fechaPartido || n.fecha;
  const fecha = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(new Date(fechaBase)).replace(',', '').toUpperCase();
  const cred = leerJSON('scripts/ig-recortes/creditos.json', {})[slugJ(g)] || {};
  return {
    fecha, bandera, titular,
    nombre: g.trim().split(/\s+/).slice(0, -1).join(' ').toUpperCase(), apellido: apG.toUpperCase(),
    marcador: r.sets.map((s) => `${s[0]}-${s[1]}`).join(' / '), rival: `VS. ${p.toUpperCase()}`,
    ronda: ronda === 'F' ? 'FINAL' : ronda === 'SF' ? 'SEMIFINALES' : 'FASE DE GRUPOS',
    grupo: ronda === 'F' || ronda === 'SF' ? 'TURÍN' : (grupo?.nombre || '').toUpperCase(),
    recorte: path.join(DIR_RECORTES, `${slugJ(g)}.png`),
    credito: cred.autor ? `Foto: ${cred.autor} / ${cred.licencia}` : '',
  };
}

export function htmlFinals(d) {
  const tam = Math.min(116, Math.floor(1450 / d.titular.length));
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:M;font-weight:900;font-style:italic;src:url(${F(ROOT + '/node_modules/@fontsource/montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:M;font-weight:800;src:url(${F(ROOT + '/node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:A;src:url(${F(ROOT + '/node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2')})}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1080px;overflow:hidden;background:#03123a}
#p{position:relative;width:1080px;height:1080px;overflow:hidden;font-family:M;color:#fff;
 background:radial-gradient(ellipse 60% 45% at 50% 52%,#3aa0ff 0%,#0d5be0 32%,#06307f 64%,#020d33 100%)}
.gradas{position:absolute;left:0;right:0;top:380px;height:420px;background:repeating-linear-gradient(0deg,#ffffff0a 0 3px,transparent 3px 14px);filter:blur(1px);opacity:.8}
.luz{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#fff 0 30%,#9fd3ff 55%,transparent 72%);box-shadow:0 0 22px 8px #7cc4ff77}
.haz{position:absolute;top:60px;width:300px;height:760px;background:linear-gradient(180deg,#cfe9ff44,transparent 75%);filter:blur(10px)}
.rayos{position:absolute;left:50%;top:600px;width:1400px;height:1400px;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,#ffe95c33 0 4deg,transparent 4deg 14deg);-webkit-mask-image:radial-gradient(circle,#000 0 18%,transparent 52%)}
.brillo{position:absolute;left:50%;top:560px;width:620px;height:620px;transform:translate(-50%,-50%);background:radial-gradient(circle,#fff6a8aa 0,#ffe95c44 30%,transparent 65%)}
.marco{position:absolute;inset:34px;border:5px solid #38d0ff;box-shadow:0 0 26px #38d0ffcc, inset 0 0 26px #38d0ff88}
.top{position:absolute;top:58px;left:0;right:0;text-align:center}
.torneo{font:900 italic 104px/1 M;letter-spacing:-.04em;text-shadow:0 6px 16px #000a}
.chip{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:6px}
.chip i{display:block;width:190px;height:4px;background:linear-gradient(90deg,transparent,#c8ff2e)}.chip i:last-child{transform:scaleX(-1)}
.chip b{background:linear-gradient(180deg,#e2ff52,#a6e600);color:#06230a;font:900 italic 46px/1 M;padding:6px 36px;border-radius:10px;box-shadow:0 0 18px #c8ff2e88}
.fecha{margin-top:12px;font:900 italic 40px/1 M;text-shadow:0 3px 10px #000b}
.jugador{position:absolute;left:44%;top:300px;height:720px;transform:translateX(-50%);filter:drop-shadow(0 14px 26px #000a);-webkit-mask-image:linear-gradient(180deg,#000 72%,transparent 96%)}
.id{position:absolute;right:58px;top:330px;display:flex;align-items:center;gap:14px;transform:rotate(-4deg)}
.id img{width:120px;height:80px;object-fit:cover;border:4px solid #fff;border-radius:6px;box-shadow:0 6px 18px #000a}
.id div{font:54px/.95 A;transform:skewX(-10deg);text-shadow:0 4px 10px #000c}.id b{display:block;font-weight:400;color:#e8ff2a;font-size:64px}
.tit{position:absolute;left:0;right:0;top:580px;text-align:center;white-space:nowrap;font:${tam}px/1 A;color:#e8ff2a;transform:skewX(-8deg);-webkit-text-stroke:4px #071a4d;paint-order:stroke fill;text-shadow:0 8px 0 #071a4d,0 14px 26px #000c}
.score{position:absolute;left:0;right:0;top:${580 + tam + 6}px;text-align:center;white-space:nowrap;font:78px/1 A;transform:skewX(-8deg);-webkit-text-stroke:3px #071a4d;paint-order:stroke fill;text-shadow:0 6px 14px #000c}
.score span{color:#e8ff2a}
.ronda{position:absolute;left:0;right:0;top:${580 + tam + 94}px;text-align:center;font:900 italic 54px/1 M;color:#e8ff2a;text-shadow:0 4px 0 #071a4d,0 8px 18px #000b}
.grupo{position:absolute;left:0;right:0;top:${580 + tam + 152}px;text-align:center;font:900 italic 38px/1 M;text-shadow:0 3px 10px #000c}
.logo{position:absolute;left:0;right:0;bottom:52px;text-align:center;font:900 italic 38px/.95 M;text-shadow:0 4px 10px #000c}
.logo span{display:inline-block;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f6ff8a,#c8f032 55%,#8db400);vertical-align:-14px;margin-left:8px;box-shadow:0 0 18px #c8f032aa}
.cred{position:absolute;right:46px;bottom:44px;font:800 13px M;color:#ffffff80}
</style><div id="p">
<div class="gradas"></div><div class="haz" style="left:-40px;transform:rotate(22deg)"></div><div class="haz" style="right:-40px;transform:rotate(-22deg)"></div>
${[[90, 300], [150, 250], [210, 210], [930, 300], [870, 250], [810, 210], [60, 380], [1020, 380]].map(([x, y]) => `<i class="luz" style="left:${x}px;top:${y}px"></i>`).join('')}
<div class="rayos"></div><div class="brillo"></div>
<div class="top"><div class="torneo">ATP FINALS</div><div class="chip"><i></i><b>SINGLES</b><i></i></div><div class="fecha">${esc(d.fecha)}</div></div>
<img class="jugador" src="${F(d.recorte)}">
<div class="id">${d.bandera ? `<img src="${F(d.bandera)}">` : ''}<div>${esc(d.nombre)}<b>${esc(d.apellido)}</b></div></div>
<div class="tit">${esc(d.titular)}</div>
<div class="score">${esc(d.marcador)} <span>${esc(d.rival)}</span></div>
<div class="ronda">${esc(d.ronda)}</div>${d.grupo ? `<div class="grupo">${esc(d.grupo)}</div>` : ''}
<div class="logo">A TODO<br>TENIS<span></span></div>
<div class="marco"></div>${d.credito ? `<div class="cred">${esc(d.credito)}</div>` : ''}
</div>`;
}
