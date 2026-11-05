// Generador del sitio estático (carpeta dist/) a partir de data/ y content/.
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, ROOT, leerJSON, tourBase, nombreRonda, nombreCategoria, sets, marcadorTexto, apellido, fechaArg, nombrePais, nombreTorneo, IOC_ISO2, NEUTRALES
} from './lib/util.mjs';
import { generarTorneos } from './torneos-paginas.mjs';
import { generarGrandSlams } from './grand-slams-paginas.mjs';

const S = CONFIG.sitio;
const DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'nota'), { recursive: true });
fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

const partidos = Object.values(leerJSON('data/partidos.json', {}));
const jugadores = leerJSON('data/jugadores.json', { lista: {} });
const estado = leerJSON('data/estado.json', {});
const torneos = leerJSON('data/torneos.json', {});
const notas = fs.readdirSync(path.join(ROOT, 'content/notas')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/notas', f), 'utf8')))
  .filter((n) => n.estado === 'publicada')
  .sort((a, b) => b.fecha.localeCompare(a.fecha));

// Hora que el navegador convierte a la zona del visitante (respaldo: hora Argentina)
const hora = (iso, opciones) => `<time datetime="${esc(iso)}" data-local='${JSON.stringify(opciones)}'>${fechaArg(iso, opciones)}</time>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARG = CONFIG.notas.paisDestacado;

// ---------- Piezas ----------
const pelota = (t = 24) => `<svg width="${t}" height="${t}" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#C6F432"/><path d="M3 7C10 11 10 15 3 19M23 7C16 11 16 15 23 19" fill="none" stroke="#fff" stroke-width="1.8"/></svg>`;
const logo = `<a class="logo" href="/" aria-label="${esc(S.nombre)}, inicio">A<small> Todo </small><b>Tenis</b>${pelota()}</a>`;

function cancha(sup) {
  // Ilustración de cancha (no es una foto): color según superficie
  return `<div class="fondo sup-${esc(sup || 'hard')}"><svg class="cancha" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="110" fill="#000" opacity=".18"/><g fill="none" stroke="#fff" stroke-width="3" opacity=".38"><path d="M40 300 120 150h160l80 150"/><path d="M75 235h250M200 235v-85M95 190h210"/></g><circle cx="300" cy="95" r="10" fill="#C6F432" opacity=".9"/></svg></div>`;
}
function imagenNota(n) {
  if (n.imagen?.url) return `<div class="fondo"><img src="${esc(n.imagen.url)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`;
  return cancha(n.superficie);
}

function pagina({ titulo, descripcion, ruta, activo, cuerpo, extraHead = '' }) {
  const t = titulo ? `${titulo} | ${S.nombre}` : `${S.nombre} | Todo el tenis`;
  const actualizado = estado.ultimaCorrida ? `Actualizado ${hora(estado.ultimaCorrida, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
  const item = (href, txt, clave) => `<a href="${href}"${activo === clave ? ' class="activo" aria-current="page"' : ''}>${txt}</a>`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(descripcion || S.descripcion)}">
<link rel="canonical" href="${S.url}${ruta}">
<meta property="og:title" content="${esc(titulo || S.nombre)}">
<meta property="og:description" content="${esc(descripcion || S.descripcion)}">
<meta property="og:url" content="${S.url}${ruta}">
<meta property="og:site_name" content="${esc(S.nombre)}">
<meta name="theme-color" content="#12161B">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(pelota(26).replace(' aria-hidden="true"', ' xmlns="http://www.w3.org/2000/svg"'))}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,800;0,900;1,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/estilos.css">
<link rel="alternate" type="application/rss+xml" title="${esc(S.nombre)}" href="/rss.xml">
${extraHead}
</head>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera"><div class="contenedor">
<div class="cab-lado izq"><svg width="38" height="25" viewBox="0 0 40 26" role="img" aria-label="Argentina"><rect width="40" height="26" rx="3" fill="#74ACDF"/><rect y="8.66" width="40" height="8.68" fill="#fff"/><circle cx="20" cy="13" r="2.6" fill="#F6B40E"/></svg>
<a class="icono-btn" href="#" aria-label="Instagram de A Todo Tenis"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg></a></div>
${logo}
<div class="cab-lado der"><a class="pill" href="/noticias">Noticias</a></div>
</div></header>
<nav class="menu" aria-label="Principal"><div class="contenedor">
${item('/', 'Inicio', 'inicio')}${item('/noticias', 'Noticias', 'noticias')}${item('/resultados', 'Resultados', 'resultados')}${item('/torneos', 'Torneos', 'torneos')}${item('/grand-slams', 'Grand Slam', 'grand-slam')}${item('/ranking', 'Ranking', 'ranking')}
<span class="actualizado">${actualizado}</span>
</div></nav>
<main id="contenido" class="contenedor">
${cuerpo}
</main>
<footer class="pie"><div class="contenedor">
<div>${logo}<p style="color:#C9D1D9;font-size:14px;max-width:380px">En la red desde 2007. Resultados, ranking y noticias de todo el circuito.</p></div>
<nav aria-label="Pie">${['/noticias|Noticias', '/resultados|Resultados', '/torneos|Torneos', '/grand-slams|Grand Slam', '/ranking|Ranking', '/argentinos|Argentinos', '/acerca|Acerca del sitio'].map((x) => { const [h, t] = x.split('|'); return `<a href="${h}">${t}</a>`; }).join('')}</nav>
</div><div class="legal">© ${new Date().getFullYear()} ${esc(S.nombre)} · Datos de partidos: Live Tennis API · Las notas se elaboran con asistencia de inteligencia artificial a partir de resultados oficiales.</div></footer>
<script>
try{var fl={};document.querySelectorAll('time[data-local]').forEach(function(t){var o=JSON.parse(t.getAttribute('data-local'));var k=t.getAttribute('data-local');fl[k]=fl[k]||new Intl.DateTimeFormat('es-AR',o);t.textContent=fl[k].format(new Date(t.getAttribute('datetime')));});}catch(e){}
document.querySelectorAll('[data-cuadro]').forEach(function(c){
var sc=c.querySelector('.cuadro-scroll');
c.querySelectorAll('[data-ir]').forEach(function(b){b.addEventListener('click',function(){var col=document.getElementById(b.getAttribute('data-ir'));sc.scrollTo({left:col.offsetLeft-sc.offsetLeft-8,behavior:'smooth'});c.querySelectorAll('.ronda-chip').forEach(function(x){x.classList.toggle('on',x===b)})})});
function marcar(id){c.classList.toggle('foco',!!id);c.querySelectorAll('.cj[data-j]').forEach(function(x){x.classList.toggle('sel',!!id&&x.getAttribute('data-j')===id)});c.querySelectorAll('.cm').forEach(function(m){m.classList.toggle('camino',!!id&&!!m.querySelector('.cj.sel'))})}
var actual=null;c.querySelectorAll('.cj[data-j]').forEach(function(x){x.addEventListener('click',function(){var id=x.getAttribute('data-j');actual=actual===id?null:id;marcar(actual)})});
var q=c.querySelector('[data-buscar]');if(q)q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();if(!v){actual=null;marcar(null);return}var h=[].find.call(c.querySelectorAll('.cj[data-j]'),function(x){return x.textContent.toLowerCase().indexOf(v)>=0});if(h){actual=h.getAttribute('data-j');marcar(actual);var col=h.closest('.rcol');sc.scrollTo({left:col.offsetLeft-sc.offsetLeft-8,behavior:'smooth'})}});
});
document.querySelectorAll('[data-tabs]').forEach(function(box){var bs=box.querySelectorAll('[role=tab]');bs.forEach(function(b){b.addEventListener('click',function(){bs.forEach(function(x){x.setAttribute('aria-selected',x===b);document.getElementById(x.getAttribute('aria-controls')).classList.toggle('oculto',x!==b)})})})});
</script>
</body>
</html>`;
}

// ---------- Partidos ----------
function banderaDe(c) {
  c = (c || '').toLowerCase();
  if (!c || c === 'sin') return '<span class="bandera vacia" aria-hidden="true"></span>';
  if (NEUTRALES.has(c)) return '<span class="bandera neutral" title="Atleta neutral" role="img" aria-label="Atleta neutral">N</span>';
  const iso = IOC_ISO2[c], nombre = esc(nombrePais(c));
  return iso ? `<img class="bandera" src="/banderas/${iso}.svg" width="20" height="15" alt="${nombre}" title="${nombre}" loading="lazy">` : `<span class="pais" title="${nombre}">${esc(c.toUpperCase())}</span>`;
}
function paisTag(j) {
  if (Array.isArray(j?.paises)) return j.paises.some(Boolean) ? `<span class="banderas2">${j.paises.map((c) => c ? banderaDe(c) : '<span class="bandera vacia2"></span>').join('')}</span>` : '<span class="bandera vacia" aria-hidden="true"></span>';
  const c = (j?.pais || '').toLowerCase();
  if (c === 'sin') return '<span class="bandera vacia" aria-hidden="true"></span>';
  if (!c) return '<span class="bandera vacia" aria-hidden="true"></span>';
  if (NEUTRALES.has(c)) return '<span class="bandera neutral" title="Atleta neutral" role="img" aria-label="Atleta neutral">N</span>';
  const iso = IOC_ISO2[c];
  const nombre = esc(nombrePais(c));
  if (!iso) return `<span class="pais" title="${nombre}">${esc(c.toUpperCase())}</span>`;
  return `<img class="bandera" src="/banderas/${iso}.svg" width="20" height="15" alt="${nombre}" title="${nombre}" loading="lazy">`;
}
const nombreCorto = (j) => esc(j?.nombre || 'A confirmar');

function filaPartido(p) {
  const sv = sets(p.score);
  const vivo = p.estado === 'en_vivo';
  const fin = p.confirmado && p.ganador;
  const fila = (j, k) => {
    const gana = fin && p.ganador === k;
    const celdas = sv.map(([a, b]) => { const mio = k === 1 ? a : b, otro = k === 1 ? b : a; return `<i class="${mio > otro ? 'g' : ''}">${mio}</i>`; }).join('');
    return `<div class="fila${gana ? ' gana' : ''}">${paisTag(j)}<span class="n">${nombreCorto(j)}</span><span class="sets">${(vivo || fin) ? celdas : ''}</span></div>`;
  };
  let info = nombreRonda(p.rondaCod, p.ronda);
  if (vivo) info = `<span class="vivo-dot"></span>En vivo · ${info}`;
  else if (p.estado === 'programado' && p.horario) info += ` · ${hora(p.horario, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  else if (p.estado === 'cancelado') info += ' · Cancelado';
  else if (!fin && ['finalizado', 'por_confirmar'].includes(p.estado)) info += ' · Finalizado (resultado a confirmar)';
  if (p.resultado && p.resultado !== 'completed') info += ` · ${{ retired: 'Retiro', walkover: 'W.O.' }[p.resultado] || p.resultado}`;
  return `<div class="partido"><div class="ronda">${info}</div>${fila(p.j1, 1)}${fila(p.j2, 2)}</div>`;
}

function porTorneo(lista, max = 999) {
  const grupos = new Map();
  for (const p of lista) {
    const k = p.torneo || 'Otros';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const NIVEL = { grand_slam: 0, atp_finals: 0, wta_finals: 0, davis_cup: 1, bjk_cup: 1, atp_1000: 2, wta_1000: 2, atp_500: 3, wta_500: 3, atp_250: 4, wta_250: 4 };
  const orden = (ps) => { const p = ps[0]; const n = NIVEL[p.tier] ?? (['atp', 'wta'].includes(tourBase(p.tour)) ? 5 : 8); return n * 10 + (ps.every((x) => x.dobles) ? 5 : 0); };
  let total = 0;
  return [...grupos.values()].sort((a, b) => orden(a) - orden(b)).map((ps) => {
    if (total >= max) return '';
    const vis = ps.slice(0, Math.max(0, max - total)); total += vis.length;
    const p = ps[0];
    return `<div class="grupo"><div class="grupo-tit">${esc(nombreTorneo(p.torneo))}<span>${esc(nombreCategoria(p.tier, p.tour, p.torneo))}</span></div>${vis.map(filaPartido).join('')}</div>`;
  }).join('');
}

// Los dobles de Challenger no se muestran (decisión editorial)
const visibles = partidos.filter((p) => !p.clasificacion && tourBase(p.tour) && !(p.dobles && tourBase(p.tour) === 'challenger'));
const enVivo = visibles.filter((p) => p.estado === 'en_vivo');
const terminados = visibles.filter((p) => p.confirmado && p.ganador).sort((a, b) => String(b.horario).localeCompare(String(a.horario)));
const proximos = visibles.filter((p) => p.estado === 'programado').sort((a, b) => String(a.horario).localeCompare(String(b.horario)));
const conArg = (p) => [p.j1, p.j2].some((j) => j?.pais === ARG);

function panelResultados(id, max) {
  const tab = (k, t, sel) => `<button role="tab" id="${id}-t-${k}" aria-controls="${id}-${k}" aria-selected="${sel}">${t}</button>`;
  const cont = (k, lista, vacio, sel) => `<div id="${id}-${k}" role="tabpanel" aria-labelledby="${id}-t-${k}"${sel ? '' : ' class="oculto"'}>${lista.length ? porTorneo(lista, max) : `<div class="vacio">${vacio}</div>`}</div>`;
  const hayVivo = enVivo.length > 0;
  return `<div class="panel" data-tabs><div class="tabs" role="tablist">${tab('v', 'En vivo', hayVivo)}${tab('r', 'Resultados', !hayVivo)}${tab('p', 'Próximos', false)}</div>
${cont('v', enVivo, 'No hay partidos en juego en este momento.', hayVivo)}${cont('r', terminados, 'Todavía no hay resultados confirmados.', !hayVivo)}${cont('p', proximos, 'No hay partidos programados.', false)}</div>`;
}

// ---------- Ranking ----------
const rankingDe = (tour) => Object.values(jugadores.lista).filter((j) => j.tour === tour).sort((a, b) => a.ranking - b.ranking);
function tablaRanking(tour, max) {
  const filas = rankingDe(tour).slice(0, max).map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug"><span class="mov ${j.mov === 'up' ? 'up' : j.mov === 'down' ? 'down' : ''}" aria-label="${j.mov === 'up' ? 'subió' : j.mov === 'down' ? 'bajó' : 'sin cambios'}">${j.mov === 'up' ? '▲' : j.mov === 'down' ? '▼' : '·'}</span>${paisTag(j)}<span class="n">${esc(j.nombre)}</span></span><span class="pts">${(j.puntos ?? '').toLocaleString('es-AR')}</span></div>`).join('');
  return `<div class="rk-cab"><span>#</span><span>Jugador${tour === 'wta' ? 'a' : ''}</span><span style="text-align:right">Puntos</span></div>${filas || '<div class="vacio">Ranking no disponible todavía.</div>'}`;
}
function panelRanking(id, max) {
  return `<div class="panel" data-tabs><div class="tabs" role="tablist"><button role="tab" id="${id}-ta" aria-controls="${id}-a" aria-selected="true">ATP</button><button role="tab" id="${id}-tw" aria-controls="${id}-w" aria-selected="false">WTA</button></div>
<div id="${id}-a" role="tabpanel" aria-labelledby="${id}-ta">${tablaRanking('atp', max)}</div><div id="${id}-w" role="tabpanel" aria-labelledby="${id}-tw" class="oculto">${tablaRanking('wta', max)}</div></div>`;
}

// ---------- Notas ----------
const fechaCorta = (iso) => fechaArg(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const cardNota = (n) => `<a class="card" href="/nota/${n.slug}"><div class="img">${imagenNota(n)}<span class="etiqueta">${esc(n.categoria)}</span></div><div class="txt"><h3>${esc(n.titulo)}</h3><span class="meta">${fechaCorta(n.fecha)}</span></div></a>`;

function hero() {
  const items = notas.slice(0, 5).map((n, i) => `<a class="tarjeta-foto" href="/nota/${n.slug}">${imagenNota(n)}<span class="etiqueta">${esc(n.categoria)}</span>${i === 0 ? `<h2>${esc(n.titulo)}</h2><p>${esc(n.bajada)}</p>` : `<h3>${esc(n.titulo)}</h3>`}</a>`);
  // Si todavía hay pocas notas, se completa con resultados destacados
  for (const p of terminados.filter((x) => x.importante)) {
    if (items.length >= 5) break;
    const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
    items.push(`<a class="tarjeta-foto" href="/resultados">${cancha(p.superficie)}<span class="etiqueta">${esc(nombreCategoria(p.tier, p.tour, p.torneo))}</span>${items.length === 0 ? '<h2>' : '<h3>'}${esc(apellido(g.nombre))} venció a ${esc(apellido(pe.nombre))} ${esc(marcadorTexto(p.score, p.ganador))}${items.length === 0 ? '</h2>' : '</h3>'}</a>`);
  }
  if (items.length === 0) items.push(`<div class="tarjeta-foto">${cancha('clay')}<h2>Todo el tenis, en un solo lugar</h2><p>Resultados, ranking y noticias del circuito ATP, WTA, Challenger, Copa Davis y Billie Jean King Cup.</p></div>`);
  while (items.length < 5) items.push(`<a class="tarjeta-foto" href="/resultados">${cancha(['hard', 'clay', 'grass', 'hard'][items.length % 4])}<h3>Todos los resultados del circuito</h3></a>`);
  return `<section class="hero" aria-label="Destacadas">${items.join('')}</section>`;
}

function escribir(rel, html) { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); }

// ---------- Páginas ----------
const T = generarTorneos({ torneos, partidos: visibles, esc, paisTag, filaPartido, hora, pagina, escribir: (rel, html) => escribir(rel, html), cancha, ARG });
const GS = generarGrandSlams({ datos: leerJSON('content/grand-slams.json', { torneos: [] }), esc, paisTag, pagina, escribir: (rel, html) => escribir(rel, html), cancha, htmlCuadro: T.htmlCuadro });
const torneosEnJuego = T.lista.filter((t) => t.enJuego).slice(0, 8);
escribir('index.html', pagina({ ruta: '/', activo: 'inicio', cuerpo: `
${hero()}
<div class="tres sec">
<section><div class="sec-tit"><h2>Últimas noticias</h2><a href="/noticias">Ver todas</a></div>
${notas.length ? `<div class="notas2">${notas.slice(0, 6).map(cardNota).join('')}</div>` : '<div class="panel"><div class="vacio" style="border:0">Las primeras notas se publican automáticamente a medida que terminan los partidos.</div></div>'}</section>
<section><div class="sec-tit"><h2>Torneos y resultados</h2></div>${panelResultados('home', 10)}<a class="ver-mas panel" href="/resultados" style="margin-top:8px">Ver todos los resultados →</a></section>
<section><div class="sec-tit"><h2>Ranking A Todo Tenis</h2></div>${panelRanking('rk', 10)}<a class="ver-mas panel" href="/ranking" style="margin-top:8px">Ranking completo →</a></section>
</div>
${torneosEnJuego.length ? `<section class="sec"><div class="sec-tit"><h2>Torneos en juego</h2><a href="/torneos">Ver todos</a></div><div class="tgrid fila-scroll">${torneosEnJuego.map(T.cardTorneo).join('')}</div></section>` : ''}
<section class="sec"><div class="sec-tit"><h2>Próximos partidos</h2><a href="/resultados">Ver todos</a></div>
<div class="panel">${porTorneo(proximos.filter((p) => !p.dobles), 12) || '<div class="vacio" style="border:0">No hay partidos programados por ahora.</div>'}</div></section>
<section class="franja" aria-label="Espacios publicitarios">${[1, 2, 3, 4, 5].map(() => '<div>Tu marca acá</div>').join('')}</section>
` }));

escribir('noticias.html', pagina({ titulo: 'Noticias', ruta: '/noticias', activo: 'noticias', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Noticias</h1></div>
${notas.length ? `<div class="lista-notas">${notas.map(cardNota).join('')}</div>` : '<div class="panel"><div class="vacio" style="border:0">Todavía no hay notas publicadas.</div></div>'}</div>` }));

escribir('resultados.html', pagina({ titulo: 'Resultados y partidos en vivo', descripcion: 'Resultados del día, partidos en vivo y próximos partidos del circuito ATP, WTA y Challenger.', ruta: '/resultados', activo: 'resultados', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Resultados</h1></div>${panelResultados('res', 999)}
<p class="meta" style="margin-top:10px">Los horarios se muestran en tu hora local. Los marcadores se actualizan cada hora. Los partidos "a confirmar" muestran el resultado apenas se verifica.</p></div>` }));

escribir('ranking.html', pagina({ titulo: 'Ranking ATP y WTA', descripcion: 'Ranking ATP y WTA actualizado.', ruta: '/ranking', activo: 'ranking', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Ranking</h1></div>${panelRanking('rkc', 200)}
<p class="meta" style="margin-top:10px">Actualizado una vez por día${jugadores.actualizado ? ` · última actualización ${fechaCorta(jugadores.actualizado)}` : ''}.</p></div>` }));

const argRank = (tour) => rankingDe(tour).filter((j) => j.pais === ARG).slice(0, 30);
escribir('argentinos.html', pagina({ titulo: 'Argentinos en el circuito', ruta: '/argentinos', activo: 'argentinos', cuerpo: `
<div class="tres sec" style="grid-template-columns:1.6fr 1fr">
<section><div class="sec-tit"><h1>Argentinos en el circuito</h1></div>
<div class="panel">${porTorneo([...visibles.filter((p) => conArg(p) && p.estado === 'en_vivo'), ...terminados.filter(conArg), ...proximos.filter(conArg)]) || '<div class="vacio" style="border:0">Sin partidos por ahora.</div>'}</div>
${notas.filter((n) => n.argentina).length ? `<div class="sec-tit sec"><h2>Notas</h2></div><div class="notas2">${notas.filter((n) => n.argentina).slice(0, 8).map(cardNota).join('')}</div>` : ''}</section>
<section><div class="sec-tit"><h2>Mejores rankeados</h2></div><div class="panel" data-tabs><div class="tabs" role="tablist"><button role="tab" id="ar-ta" aria-controls="ar-a" aria-selected="true">ATP</button><button role="tab" id="ar-tw" aria-controls="ar-w" aria-selected="false">WTA</button></div>
<div id="ar-a" role="tabpanel" aria-labelledby="ar-ta">${argRank('atp').map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug"><span>${esc(j.nombre)}</span></span><span class="pts">${j.puntos?.toLocaleString('es-AR') ?? ''}</span></div>`).join('') || '<div class="vacio">Sin datos.</div>'}</div>
<div id="ar-w" role="tabpanel" aria-labelledby="ar-tw" class="oculto">${argRank('wta').map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug"><span>${esc(j.nombre)}</span></span><span class="pts">${j.puntos?.toLocaleString('es-AR') ?? ''}</span></div>`).join('') || '<div class="vacio">Sin argentinas entre las primeras del listado.</div>'}</div></div></section>
</div>` }));

escribir('acerca.html', pagina({ titulo: 'Acerca del sitio', ruta: '/acerca', cuerpo: `
<article class="nota"><h1>Acerca de A Todo Tenis</h1><div class="cuerpo">
<p>A Todo Tenis nació en 2007 como un sitio argentino dedicado al tenis. Hoy vuelve con una nueva versión que sigue en tiempo real el circuito ATP, WTA, Challenger, la Copa Davis y la Billie Jean King Cup.</p>
<p>Los resultados, el calendario y el ranking provienen de Live Tennis API y se actualizan automáticamente. Las notas se redactan con asistencia de inteligencia artificial, siempre a partir de resultados verificados y sin declaraciones inventadas.</p>
<p>Las imágenes que acompañan las notas se publican con su crédito correspondiente. Cuando una nota no tiene foto, se muestra una ilustración de la cancha según la superficie del torneo.</p>
</div></article>` }));

for (const n of notas) {
  const p = partidos.find((x) => x.id === n.partidoId);
  const ficha = p && p.score ? `<div class="ficha"><div class="grupo-tit">${esc(n.torneo)}<span>${esc(nombreCategoria(p.tier, p.tour, p.torneo))}</span></div>${filaPartido(p)}</div>` : '';
  const relacionadas = notas.filter((x) => x.slug !== n.slug).slice(0, 3);
  const ld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.titulo, description: n.bajada, datePublished: n.fecha, author: { '@type': 'Organization', name: n.firma }, publisher: { '@type': 'Organization', name: S.nombre } };
  escribir(`nota/${n.slug}.html`, pagina({
    titulo: n.titulo, descripcion: n.bajada, ruta: `/nota/${n.slug}`, activo: 'noticias',
    extraHead: `<meta property="og:type" content="article"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    cuerpo: `<article class="nota"><span class="etiqueta">${esc(n.categoria)}</span>
<h1>${esc(n.titulo)}</h1><p class="bajada">${esc(n.bajada)}</p>
<div class="firma"><span>Por ${esc(n.firma)}</span><span>·</span>${hora(n.fecha, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
<figure><div class="img">${imagenNota(n)}</div>${n.imagen?.credito ? `<figcaption>Crédito de la imagen: ${n.imagen.enlace ? `<a href="${esc(n.imagen.enlace)}" rel="noopener">${esc(n.imagen.credito)}</a>` : esc(n.imagen.credito)}</figcaption>` : ''}</figure>
<div class="cuerpo">${n.cuerpo.map((x) => `<p>${esc(x)}</p>`).join('')}</div>${ficha}
${relacionadas.length ? `<div class="sec-tit sec"><h2>Más noticias</h2></div><div class="lista-notas">${relacionadas.map(cardNota).join('')}</div>` : ''}
</article>`
  }));
}

escribir('404.html', pagina({ titulo: 'Página no encontrada', ruta: '/404', cuerpo: '<article class="nota"><h1>Esta pelota se fue afuera</h1><p class="bajada">La página que buscás no existe. <a href="/" style="color:#C6F432">Volver al inicio</a>.</p></article>' }));

// SEO: sitemap, RSS, robots
const urls = ['/', '/noticias', '/resultados', '/torneos', '/grand-slams', ...GS.torneos.map((t) => `/grand-slam/${t.slug}`), '/ranking', '/argentinos', '/acerca', ...T.lista.map((t) => `/torneo/${t.slug}`), ...notas.map((n) => `/nota/${n.slug}`)];
escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${S.url}${u}</loc></url>`).join('')}</urlset>\n`);
escribir('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
escribir('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(S.nombre)}</title><link>${S.url}</link><description>${esc(S.descripcion)}</description><language>es-ar</language>${notas.slice(0, 30).map((n) => `<item><title>${esc(n.titulo)}</title><link>${S.url}/nota/${n.slug}</link><guid>${S.url}/nota/${n.slug}</guid><pubDate>${new Date(n.fecha).toUTCString()}</pubDate><description>${esc(n.bajada)}</description></item>`).join('')}</channel></rss>\n`);

console.log(`Sitio generado: ${urls.length} páginas, ${notas.length} notas, ${partidos.length} partidos.`);
