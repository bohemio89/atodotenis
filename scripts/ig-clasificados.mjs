// Placa de Instagram "¡CLASIFICADOS!" cuando se cierra un grupo de las ATP Finals (mismo estilo "estadio" de las placas
// de resultado). Calcula la tabla con los partidos confirmados y el reglamento de desempate de las Finals:
// 1) partidos ganados; 2) empate de dos: enfrentamiento directo; 3) empate de tres: % de sets ganados, luego % de games
// (si después quedan dos empatados, enfrentamiento directo).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, IOC_ISO2, conGrafia } from './lib/util.mjs';

const F = (p) => `file://${p}`;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ape = (s) => norm(s).split(/\s+/).pop();
const slugJ = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DIR_RECORTES = path.join(ROOT, 'scripts/ig-recortes');

function setsDe(p) {
  const g = p.score?.games || [[], []];
  return (g[0] || []).map((a, i) => [Number(a), Number((g[1] || [])[i] ?? 0)]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && (a || b));
}

// Grupos de ATP Finals con sus 6 partidos confirmados → [{ grupo, tabla, clasificados: [1.º, 2.º] }]
export function gruposCerrados() {
  const ev = (leerJSON('content/finales.json', { eventos: [] }).eventos || []).find((e) => e.tour === 'atp');
  const partidos = Object.values(leerJSON('data/partidos.json', {}));
  const salida = [];
  for (const gr of ev?.grupos || []) {
    const miembros = gr.jugadores.map(ape);
    const ps = partidos.filter((p) => !p.dobles && p.confirmado && p.ganador && /finals/i.test(`${p.tier} ${p.torneo}`) && !/wta|next ?gen/i.test(`${p.tier} ${p.torneo}`) &&
      miembros.includes(ape(p.j1?.nombre)) && miembros.includes(ape(p.j2?.nombre)));
    if (ps.length < 6) continue;
    const t = Object.fromEntries(gr.jugadores.map((n) => [ape(n), { nombre: n, g: 0, p: 0, sg: 0, sp: 0, jg: 0, jp: 0 }]));
    const gano = {}; // gano[a][b] = true si a le ganó a b
    for (const p of ps) {
      const a = ape(p.j1.nombre), b = ape(p.j2.nombre), w = p.ganador === 1 ? a : b, l = w === a ? b : a;
      t[w].g++; t[l].p++; (gano[w] ||= {})[l] = true;
      for (const [x, y] of setsDe(p)) {
        t[a].jg += x; t[a].jp += y; t[b].jg += y; t[b].jp += x;
        if (x > y) { t[a].sg++; t[b].sp++; } else { t[b].sg++; t[a].sp++; }
      }
    }
    const pct = (a, b) => (a + b ? a / (a + b) : 0);
    const directo = (x, y) => (gano[x.k]?.[y.k] ? -1 : gano[y.k]?.[x.k] ? 1 : 0);
    const filas = Object.entries(t).map(([k, v]) => ({ k, ...v }));
    const orden = [];
    for (const g of [...new Set(filas.map((f) => f.g))].sort((a, b) => b - a)) {
      let em = filas.filter((f) => f.g === g);
      if (em.length === 2) em.sort(directo);
      else if (em.length >= 3) {
        em.sort((x, y) => pct(y.sg, y.sp) - pct(x.sg, x.sp) || pct(y.jg, y.jp) - pct(x.jg, x.jp));
        for (let i = 0; i + 1 < em.length; i++) {
          if (pct(em[i].sg, em[i].sp) === pct(em[i + 1].sg, em[i + 1].sp) && pct(em[i].jg, em[i].jp) === pct(em[i + 1].jg, em[i + 1].jp) && directo(em[i], em[i + 1]) > 0) [em[i], em[i + 1]] = [em[i + 1], em[i]];
        }
      }
      orden.push(...em);
    }
    salida.push({ grupo: gr.nombre, tabla: orden, clasificados: orden.slice(0, 2), ultimo: ps.map((p) => p.horario).sort().pop() });
  }
  return salida;
}

function oficial(nombre) {
  const lista = Object.values(leerJSON('data/jugadores.json', {}).lista || {});
  return lista.find((j) => norm(j.nombre) === norm(nombre)) || lista.find((j) => ape(j.nombre) === ape(nombre) && j.tour === 'atp') || {};
}
const bandera = (nombre) => {
  const of = oficial(nombre);
  const iso = (IOC_ISO2 || {})[String(of.pais || '').toLowerCase()] || (of.pais && String(of.pais).length === 2 ? of.pais : null);
  const f = iso && path.join(ROOT, 'static/banderas', `${iso}.svg`);
  return f && fs.existsSync(f) ? f : null;
};
export const recortesListos = (c) => c.clasificados.every((x) => fs.existsSync(path.join(DIR_RECORTES, `${slugJ(x.nombre)}.png`)));

export function textoClasificados(c) {
  const [a, b] = c.clasificados;
  const h = ['#ATPFinals', '#tenis', '#tennis', '#' + a.nombre.split(/\s+/).pop().normalize('NFD').replace(/[^A-Za-z]/g, ''), '#' + b.nombre.split(/\s+/).pop().normalize('NFD').replace(/[^A-Za-z]/g, '')];
  return conGrafia([
    `${a.nombre.split(/\s+/).pop()} y ${b.nombre.split(/\s+/).pop()}, los clasificados del ${c.grupo.replace(/^Grupo /, 'grupo ')} a las semifinales de las ATP Finals.`,
    `${a.nombre.split(/\s+/).pop()} terminó primero (${a.g}-${a.p}) y ${b.nombre.split(/\s+/).pop()}, segundo (${b.g}-${b.p}).`,
    'Más en atodotenis.vercel.app',
    h.join(' '),
  ].join('\n\n'));
}

export function htmlClasificados(c) {
  const [a, b] = c.clasificados;
  const cred = leerJSON('scripts/ig-recortes/creditos.json', {});
  const credito = [a, b].map((x) => cred[slugJ(x.nombre)]).filter((x) => x?.autor).map((x) => `${x.autor} / ${x.licencia}`).join(' · ');
  const jug = (x, lado) => {
    const nom = conGrafia(x.nombre), partes = nom.trim().split(/\s+/), bnd = bandera(x.nombre);
    return `<img class="j ${lado}" src="${F(path.join(DIR_RECORTES, `${slugJ(x.nombre)}.png`))}">
<div class="id ${lado}">${bnd ? `<img src="${F(bnd)}">` : ''}<div>${esc(partes.slice(0, -1).join(' ').toUpperCase())}<b>${esc(partes.at(-1).toUpperCase())}</b><small>${lado === 'izq' ? '1.º' : '2.º'} · ${x.g}-${x.p}</small></div></div>`;
  };
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:M;font-weight:900;font-style:italic;src:url(${F(ROOT + '/node_modules/@fontsource/montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:A;src:url(${F(ROOT + '/node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2')})}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1080px;overflow:hidden;background:#03123a}
#p{position:relative;width:1080px;height:1080px;overflow:hidden;font-family:M;color:#fff;
 background:radial-gradient(ellipse 60% 45% at 50% 52%,#3aa0ff 0%,#0d5be0 32%,#06307f 64%,#020d33 100%)}
.gradas{position:absolute;left:0;right:0;top:380px;height:420px;background:repeating-linear-gradient(0deg,#ffffff0a 0 3px,transparent 3px 14px);filter:blur(1px);opacity:.8}
.luz{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#fff 0 30%,#9fd3ff 55%,transparent 72%);box-shadow:0 0 22px 8px #7cc4ff77}
.haz{position:absolute;top:60px;width:300px;height:760px;background:linear-gradient(180deg,#cfe9ff44,transparent 75%);filter:blur(10px)}
.rayos{position:absolute;left:50%;top:600px;width:1400px;height:1400px;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,#ffe95c33 0 4deg,transparent 4deg 14deg);-webkit-mask-image:radial-gradient(circle,#000 0 18%,transparent 52%)}
.marco{position:absolute;inset:34px;border:5px solid #38d0ff;box-shadow:0 0 26px #38d0ffcc, inset 0 0 26px #38d0ff88}
.top{position:absolute;top:58px;left:0;right:0;text-align:center;z-index:3}
.torneo{font:900 italic 104px/1 M;letter-spacing:-.04em;text-shadow:0 6px 16px #000a}
.chip{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:6px}
.chip i{display:block;width:190px;height:4px;background:linear-gradient(90deg,transparent,#c8ff2e)}.chip i:last-child{transform:scaleX(-1)}
.chip b{background:linear-gradient(180deg,#e2ff52,#a6e600);color:#06230a;font:900 italic 46px/1 M;padding:6px 36px;border-radius:10px;box-shadow:0 0 18px #c8ff2e88}
.j{position:absolute;top:340px;height:540px;filter:drop-shadow(0 14px 26px #000a);-webkit-mask-image:linear-gradient(180deg,#000 70%,transparent 95%)}
.j.izq{left:24%;transform:translateX(-50%)}.j.der{left:76%;transform:translateX(-50%)}
.id{position:absolute;top:262px;display:flex;align-items:center;gap:12px;transform:rotate(-4deg);z-index:3}
.id.izq{left:58px}.id.der{right:58px;flex-direction:row-reverse;text-align:right}
.id img{width:92px;height:62px;object-fit:cover;border:4px solid #fff;border-radius:6px;box-shadow:0 6px 18px #000a}
.id div{font:40px/.95 A;transform:skewX(-10deg);text-shadow:0 4px 10px #000c}.id b{display:block;font-weight:400;color:#e8ff2a;font-size:56px}
.id small{display:block;font:900 italic 26px/1.3 M;color:#fff;margin-top:4px}
.tit{position:absolute;left:0;right:0;top:700px;text-align:center;white-space:nowrap;font:118px/1 A;color:#e8ff2a;transform:skewX(-8deg);-webkit-text-stroke:4px #071a4d;paint-order:stroke fill;text-shadow:0 8px 0 #071a4d,0 14px 26px #000c;z-index:3}
.sub{position:absolute;left:0;right:0;top:828px;text-align:center;font:900 italic 50px/1 M;text-shadow:0 4px 0 #071a4d,0 8px 18px #000b;z-index:3}
.grupo{position:absolute;left:0;right:0;top:890px;text-align:center;font:900 italic 36px/1 M;color:#e8ff2a;text-shadow:0 3px 10px #000c;z-index:3}
.logo{position:absolute;left:0;right:0;bottom:52px;text-align:center;font:900 italic 30px/.95 M;text-shadow:0 4px 10px #000c;z-index:3}
.logo span{display:inline-block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f6ff8a,#c8f032 55%,#8db400);vertical-align:-10px;margin-left:8px;box-shadow:0 0 18px #c8f032aa}
.cred{position:absolute;right:46px;bottom:44px;font:800 12px M;color:#ffffff80;z-index:3}
</style><div id="p">
<div class="gradas"></div><div class="haz" style="left:-40px;transform:rotate(22deg)"></div><div class="haz" style="right:-40px;transform:rotate(-22deg)"></div>
${[[90, 300], [150, 250], [210, 210], [930, 300], [870, 250], [810, 210], [60, 380], [1020, 380]].map(([x, y]) => `<i class="luz" style="left:${x}px;top:${y}px"></i>`).join('')}
<div class="rayos"></div>
<div class="top"><div class="torneo">ATP FINALS</div><div class="chip"><i></i><b>SINGLES</b><i></i></div></div>
${jug(a, 'izq')}${jug(b, 'der')}
<div class="tit">¡CLASIFICADOS!</div>
<div class="sub">A SEMIFINALES</div>
<div class="grupo">${esc(c.grupo.toUpperCase())}</div>
<div class="logo">A TODO<br>TENIS<span></span></div>
<div class="marco"></div>${credito ? `<div class="cred">Fotos: ${esc(credito)}</div>` : ''}
</div>`;
}
