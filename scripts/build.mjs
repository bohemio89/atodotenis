// Generador del sitio estático (carpeta dist/) a partir de data/ y content/.
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, ROOT, leerJSON, tourBase, nombreRonda, nombreCategoria, sets, marcadorTexto, apellido, fechaArg, nombrePais, nombreTorneo, IOC_ISO2, NEUTRALES, LANG, LOCALE
} from './lib/util.mjs';
import { generarTorneos } from './torneos-paginas.mjs';
import { generarGrandSlams } from './grand-slams-paginas.mjs';
import { traducirHTML } from './lib/i18n.mjs';
import { execFileSync } from 'node:child_process';
const EN = LANG === 'en';
const PRE = EN ? '/en' : '';

const S = { ...CONFIG.sitio, ...(LANG === 'en' ? { descripcion: 'All the tennis: results, rankings and news from the ATP, WTA and Challenger tours, the Davis Cup and the Billie Jean King Cup.' } : {}) };
const DIST = path.join(ROOT, 'dist', EN ? 'en' : '');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'nota'), { recursive: true });
if (!EN) fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

const partidos = Object.values(leerJSON('data/partidos.json', {}));
const avatares = leerJSON('data/avatares.json', {});
const jugadores = leerJSON('data/jugadores.json', { lista: {} });
const estado = leerJSON('data/estado.json', {});
const torneos = leerJSON('data/torneos.json', {});
const notasES = fs.readdirSync(path.join(ROOT, 'content/notas')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/notas', f), 'utf8'))).filter((n) => n.estado === 'publicada');
const notas = fs.readdirSync(path.join(ROOT, 'content/notas')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/notas', f), 'utf8')))
  .filter((n) => n.estado === 'publicada')
  // Versión en inglés: solo las notas que ya tienen su traducción
  .filter((n) => !EN || (n.en?.titulo && Array.isArray(n.en.cuerpo)))
  .map((n) => EN ? { ...n, titulo: n.en.titulo, bajada: n.en.bajada, cuerpo: n.en.cuerpo, categoria: n.en.categoria || n.categoria } : n)
  .sort((a, b) => b.fecha.localeCompare(a.fecha));

// Hora que el navegador convierte a la zona del visitante (respaldo: hora Argentina)
const hora = (iso, opciones) => `<time datetime="${esc(iso)}" data-local='${JSON.stringify(opciones)}'>${fechaArg(iso, opciones)}</time>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARG = CONFIG.notas.paisDestacado;

// ---------- Piezas ----------
const pelota = (t = 24) => `<svg width="${t}" height="${t}" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#C6F432"/><path d="M3 7C10 11 10 15 3 19M23 7C16 11 16 15 23 19" fill="none" stroke="#fff" stroke-width="1.8"/></svg>`;
const logo = `<a class="logo" href="/" aria-label="${esc(S.nombre)}, inicio"><span class="logo-txt"><span class="l-a">A</span><span class="l-todo">Todo</span><span class="l-tenis">Tenis</span></span><svg class="logo-sw" viewBox="0 0 130 44" aria-hidden="true"><path d="M2 40C34 18 70 8 104 12" fill="none" stroke="#C6F432" stroke-width="4" stroke-linecap="round"/><path d="M14 42C42 26 72 18 100 20" fill="none" stroke="#C6F432" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><path d="M30 43C52 33 76 27 98 28" fill="none" stroke="#C6F432" stroke-width="1.6" stroke-linecap="round" opacity=".45"/><circle cx="114" cy="14" r="12" fill="#C6F432"/><path d="M104 8C110 12 110 17 104 21M124 8C118 12 118 17 124 21" fill="none" stroke="#12161B" stroke-width="1.6" opacity=".55"/></svg></a>`;

function cancha(sup) {
  // Ilustración de cancha (no es una foto): color según superficie
  return `<div class="fondo sup-${esc(sup || 'hard')}"><svg class="cancha" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="110" fill="#000" opacity=".18"/><g fill="none" stroke="#fff" stroke-width="3" opacity=".38"><path d="M40 300 120 150h160l80 150"/><path d="M75 235h250M200 235v-85M95 190h210"/></g><circle cx="300" cy="95" r="10" fill="#C6F432" opacity=".9"/></svg></div>`;
}
// Getty: solo se acepta su código oficial para incrustar (embed.gettyimages.com, con et y sig)
function gettySrc(g) {
  const v = typeof g === 'object' && g ? g.src : g;
  const m = String(v || '').replace(/&amp;/g, '&').match(/^https:\/\/embed\.gettyimages\.com\/embed\/\d+\?[^"'\s<>]*/);
  return m && /[?&]et=/.test(m[0]) && /[?&]sig=/.test(m[0]) ? m[0] : null;
}
const gettyRatio = (g) => (g && g.w && g.h ? `${g.w}/${g.h + 70}` : '3/2');
const creditoCorto = (n) => n.imagen?.credito ? n.imagen.credito.replace(/, vía Wikimedia Commons$/, '') : '';
// Tamaños intermedios de Commons para que el celular no baje la foto de 1920 px
const srcsetCommons = (url) => /\/1920px-/.test(url)
  ? ` srcset="${[960, 1280, 1920].map((w) => `${esc(url.replace('/1920px-', `/${w}px-`))} ${w}w`).join(', ')}" sizes="(max-width: 700px) 100vw, (max-width: 1200px) 66vw, 1200px"`
  : '';

// Placa gráfica del resultado (cuando no hay una foto buena): no es una foto, es un gráfico con datos reales
const RONDA_PLACA = EN ? { R128: '1st round', R64: '2nd round', R32: '3rd round', R16: 'Round of 16', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final' } : { R128: '1° ronda', R64: '2° ronda', R32: '3° ronda', R16: 'Octavos de final', QF: 'Cuartos de final', SF: 'Semifinal', F: 'Final' };
const partidosPorId = Object.fromEntries(partidos.map((p) => [String(p.id), p]));
function resultadoNota(n) {
  if (n.resultado) return n.resultado;
  const p = partidosPorId[String(n.partidoId)];
  if (!p?.ganador || !p.score) return null;
  const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
  const gs = p.score.games || [[], []];
  return { ganador: g, perdedor: pe, ronda: p.rondaCod, resultado: p.resultado,
    sets: (gs[0] || []).map((x, i) => p.ganador === 1 ? [x, gs[1][i]] : [gs[1][i], x]).filter(([a, b]) => a != null && b != null) };
}
function placa(n) {
  const r = resultadoNota(n);
  if (!r?.ganador?.nombre) return '';
  const cara = (j) => {
    const a = avatares[j.nombre];
    const ini = String(j.nombre).split(/\s+/).map((x) => x[0]).slice(0, 2).join('');
    return a?.url ? `<span class="pl-cara"><img src="${esc(a.url)}" alt="" loading="lazy"></span>` : `<span class="pl-cara pl-ini">${esc(ini)}</span>`;
  };
  const fila = (j, gana) => `<div class="pl-fila${gana ? ' gana' : ''}">${cara(j)}<span class="pl-nom">${paisTag(j)}<span class="pl-n"><span class="pl-full">${esc(j.nombre)}</span><span class="pl-ape">${esc(String(j.nombre).trim().split(/\s+/).pop())}</span></span>${j.ranking ? `<small>N° ${j.ranking}</small>` : ''}</span>
<span class="pl-sets">${r.sets.map(([a, b]) => `<b class="${(gana ? a > b : b > a) ? 'g' : ''}">${gana ? a : b}</b>`).join('')}</span></div>`;
  const ronda = RONDA_PLACA[r.ronda] || '';
  const extra = r.resultado === 'retiro' ? (EN ? ' · retirement' : ' · por retiro') : '';
  return `<div class="fondo placa sup-${esc(n.superficie || 'hard')}" role="img" aria-label="${esc(`${r.ganador.nombre} ${EN ? 'beat' : 'venció a'} ${r.perdedor.nombre}`)}">
<svg class="cancha" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="3" opacity=".16"><path d="M40 300 120 150h160l80 150"/><path d="M75 235h250M200 235v-85M95 190h210"/></g></svg>
<div class="pl-in"><div class="pl-torneo">${esc([n.categoria, n.torneo].filter(Boolean).join(' · '))}${ronda ? ` <span>${esc(ronda)}${extra}</span>` : ''}</div>
${fila(r.ganador, true)}${fila(r.perdedor, false)}<div class="pl-marca">A Todo Tenis</div></div></div>`;
}
// Declaración textual tomada de una fuente oficial, traducida y con su atribución
function declaracionNota(n) {
  const d = n.declaracion;
  if (!d?.texto || !d.jugador) return '';
  if (EN) return d.original ? `<blockquote class="decl"><p>“${esc(d.original)}”</p><footer>${esc(d.jugador)}, as published by ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.fuente)}</a>` : esc(d.fuente)}</footer></blockquote>` : '';
  return `<blockquote class="decl"><p>«${esc(d.texto)}»</p><footer>${esc(d.jugador)}, en declaraciones publicadas por ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.fuente)}</a>` : esc(d.fuente)}</footer></blockquote>`;
}
// Highlights oficiales de YouTube: miniatura + botón; el reproductor (sin cookies) carga solo al tocar
function videoNota(n) {
  const id = n.video?.youtube;
  if (!id || !/^[\w-]{6,20}$/.test(id)) return '';
  return `<section class="video-nota"><h2>Lo mejor del partido</h2>
<button class="yt" type="button" data-id="${esc(id)}" aria-label="Reproducir: ${esc(n.video.titulo || 'highlights')}">
<img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span></button>
<p class="meta">Video: ${esc(n.video.canal || 'YouTube')} en YouTube</p>
<script>document.querySelectorAll('.yt').forEach(function(b){b.addEventListener('click',function(){var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+b.dataset.id+'?autoplay=1&rel=0';f.title='${EN ? 'Match highlights' : 'Highlights del partido'}';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.className='yt-frame';b.replaceWith(f);});});</script></section>`;
}
function imagenNota(n, conCredito = true) {
  if (n.imagen?.url) return `<div class="fondo"><img src="${esc(n.imagen.url)}"${srcsetCommons(n.imagen.url)} alt="${esc(EN ? n.titulo : n.imagen.alt || '')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:center 25%">${conCredito ? `<span class="credito-mini">Foto: ${esc(creditoCorto(n))}</span>` : ''}</div>`;
  return placa(n) || cancha(n.superficie);
}

function pagina({ titulo, descripcion, ruta, activo, cuerpo, extraHead = '' }) {
  const t = titulo ? `${titulo} | ${S.nombre}` : `${S.nombre} | Todo el tenis`;
  const item = (href, txt, clave) => `<a href="${href}"${activo === clave ? ' class="activo" aria-current="page"' : ''}>${txt}</a>`;
  return `<!doctype html>
<html lang="${EN ? 'en' : 'es-AR'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(descripcion || S.descripcion)}">
<link rel="canonical" href="${S.url}${PRE}${ruta === '/' && EN ? '' : ruta}">
<link rel="alternate" hreflang="es" href="${S.url}${ruta}"><link rel="alternate" hreflang="en" href="${S.url}/en${ruta === '/' ? '' : ruta}"><link rel="alternate" hreflang="x-default" href="${S.url}${ruta}">
<meta property="og:title" content="${esc(titulo || S.nombre)}">
<meta property="og:description" content="${esc(descripcion || S.descripcion)}">
<meta property="og:url" content="${S.url}${PRE}${ruta === '/' && EN ? '' : ruta}"><meta property="og:locale" content="${EN ? 'en_US' : 'es_AR'}">
<meta property="og:site_name" content="${esc(S.nombre)}">
<meta name="theme-color" content="#12161B">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(pelota(26).replace(' aria-hidden="true"', ' xmlns="http://www.w3.org/2000/svg"'))}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,800;0,900;1,900&family=Inter:wght@400;500;600;700&family=Roboto+Condensed:ital,wght@0,400;0,500;0,600;0,700;1,800;1,900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/estilos.css">
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
<link rel="alternate" type="application/rss+xml" title="${esc(S.nombre)}" href="/rss.xml">
${extraHead}
</head>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera"><div class="contenedor">
<div class="cab-lado izq">
<a class="icono-btn" href="#" aria-label="Instagram de A Todo Tenis"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg></a></div>
${logo}
<div class="cab-lado der"><nav class="idioma" aria-label="Idioma / Language"><a data-lang href="${ruta === '/404' ? '/' : ruta}" hreflang="es" lang="es"${EN ? '' : ' aria-current="true" class="on"'}>ES</a><a data-lang href="/en${ruta === '/' || ruta === '/404' ? '' : ruta}" hreflang="en" lang="en"${EN ? ' aria-current="true" class="on"' : ''}>EN</a></nav><a class="pill" href="/noticias">Noticias</a></div>
</div></header>
<nav class="menu" aria-label="Principal"><div class="contenedor">
${item('/', 'Inicio', 'inicio')}${item('/noticias', 'Noticias', 'noticias')}${item('/resultados', 'Resultados', 'resultados')}${item('/torneos', 'Torneos', 'torneos')}${item('/grand-slams', 'Grand Slam', 'grand-slam')}${item('/ranking', 'Ranking', 'ranking')}${item('/calendario', 'Calendario', 'calendario')}
<form class="buscador" action="/noticias" method="get" role="search"><label for="q" class="saltar">Buscar en el sitio</label><input id="q" name="q" type="search" placeholder="Buscador" autocomplete="off"><button type="submit" aria-label="Buscar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button></form>
</div></nav>
<main id="contenido" class="contenedor">
${cuerpo}
</main>
<footer class="pie"><div class="contenedor">
<div>${logo}<p style="color:#C9D1D9;font-size:14px;max-width:380px">Resultados, ranking y noticias de todo el circuito.</p></div>
<nav aria-label="Pie">${['/noticias|Noticias', '/resultados|Resultados', '/torneos|Torneos', '/grand-slams|Grand Slam', '/ranking|Ranking', '/calendario|Calendario', '/argentinos|Argentinos', '/acerca|Acerca del sitio', '/creditos|Créditos de imágenes'].map((x) => { const [h, t] = x.split('|'); return `<a href="${h}">${t}</a>`; }).join('')}</nav>
</div><div class="legal">© ${new Date().getFullYear()} ${esc(S.nombre)}</div></footer>
<script>
try{var fl={};document.querySelectorAll('time[data-local]').forEach(function(t){var o=JSON.parse(t.getAttribute('data-local'));var k=t.getAttribute('data-local');fl[k]=fl[k]||new Intl.DateTimeFormat('${LOCALE}',o);t.textContent=fl[k].format(new Date(t.getAttribute('datetime')));});}catch(e){}
document.querySelectorAll('[data-hero]').forEach(function(h){var f=h.querySelector('.hs-fila');h.querySelectorAll('[data-hs]').forEach(function(b){b.addEventListener('click',function(){if(+b.getAttribute('data-hs')>0)f.appendChild(f.firstElementChild);else f.insertBefore(f.lastElementChild,f.firstElementChild)})})});
(function(){var q=new URLSearchParams(location.search).get('q');var box=document.querySelector('[data-buscar-notas]');if(!q||!box)return;var v=q.toLowerCase(),n=0;box.querySelectorAll('.card').forEach(function(c){var ok=c.textContent.toLowerCase().indexOf(v)>=0;c.style.display=ok?'':'none';if(ok)n++});var t=document.getElementById('busqueda-info');if(t){t.textContent=n?('${EN ? 'Results for' : 'Resultados para'} "'+q+'": '+n):('${EN ? 'No stories match' : 'No hay notas que coincidan con'} "'+q+'".');t.hidden=false}var i=document.getElementById('q');if(i)i.value=q})();
document.querySelectorAll('[data-carrusel]').forEach(function(c){var t=c.querySelector('.car-track'),d=c.querySelectorAll('.car-dots span');
c.querySelectorAll('.car-btn').forEach(function(b){b.addEventListener('click',function(){t.scrollBy({left:+b.getAttribute('data-dir')*t.clientWidth*0.9,behavior:'smooth'})})});
t.addEventListener('scroll',function(){var w=t.firstElementChild?t.firstElementChild.getBoundingClientRect().width+14:1;var i=Math.round(t.scrollLeft/w);d.forEach(function(x,k){x.classList.toggle('on',k===i)})},{passive:true});});
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
// Países de las jugadoras neutrales (o sin dato) según el ranking oficial de la WTA
const PAISES_WTA = leerJSON('data/paises-wta.json', { jugadoras: {} }).jugadoras || {};
const normP = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Coincidencia exacta o, si no, por apellido + inicial del nombre (grafías distintas entre fuentes)
const PAISES_WTA_AP = {};
for (const [k, v] of Object.entries(PAISES_WTA)) { const ps = k.split(' '); const clave = `${ps[0][0]} ${ps.at(-1)}`; PAISES_WTA_AP[clave] = PAISES_WTA_AP[clave] && PAISES_WTA_AP[clave] !== v ? 'X' : v; }
function paisWTA(nombre) {
  const k = normP(nombre); if (PAISES_WTA[k]) return PAISES_WTA[k];
  const ps = k.split(' '); const v = PAISES_WTA_AP[`${ps[0]?.[0]} ${ps.at(-1)}`];
  return v && v !== 'X' ? v : null;
}
function paisTag(j) {
  if (j && !Array.isArray(j.paises) && (!j.pais || NEUTRALES.has(String(j.pais).toLowerCase()))) { const c = paisWTA(j.nombre); if (c) j = { ...j, pais: c }; }
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
function avatar(j) {
  const a = avatares[j.nombre];
  const ini = esc(j.nombre.split(' ').map((x) => x[0]).slice(0, 2).join(''));
  const foto = a?.url ? `<img src="${esc(a.url)}" alt="" loading="lazy" style="object-position:${esc(a.foco || 'center 20%')}">` : `<span class="av-ini">${ini}</span>`;
  return `<span class="av">${foto}<span class="av-flag">${paisTag(j)}</span></span>`;
}
const rankingDe = (tour) => Object.values(jugadores.lista).filter((j) => j.tour === tour).sort((a, b) => a.ranking - b.ranking);
// Flecha y puestos que subió o bajó (si coincide con la dirección que informa la API)
function movimiento(j) {
  const c = Number(j.cambio) || 0;
  const dir = c > 0 ? 'up' : c < 0 ? 'down' : j.mov === 'up' ? 'up' : j.mov === 'down' ? 'down' : '';
  if (!dir) return '<span class="mov" aria-label="sin cambios"></span>';
  const n = c && ((c > 0) === (dir === 'up')) ? Math.abs(c) : null;
  const txt = dir === 'up' ? 'subió' : 'bajó';
  return `<span class="mov ${dir}" aria-label="${txt}${n ? ` ${n} ${n === 1 ? 'puesto' : 'puestos'}` : ''}">${dir === 'up' ? '▲' : '▼'}${n ? `<small>${n}</small>` : ''}</span>`;
}
function tablaRanking(tour, max, fotos = true) {
  const filas = rankingDe(tour).slice(0, max).map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug">${fotos ? avatar(j) : `<span class="rk-flag">${paisTag(j)}</span>`}<span class="n">${esc(j.nombre)}</span>${movimiento(j)}</span><span class="pts">${(j.puntos ?? '').toLocaleString(LOCALE)}</span></div>`).join('');
  return `<div class="rk-cab"><span>#</span><span>Jugador${tour === 'wta' ? 'a' : ''}</span><span style="text-align:right">Puntos</span></div>${filas || '<div class="vacio">Ranking no disponible todavía.</div>'}`;
}
function panelRanking(id, max, fotos = true) {
  return `<div class="panel" data-tabs><div class="tabs" role="tablist"><button role="tab" id="${id}-ta" aria-controls="${id}-a" aria-selected="true">ATP</button><button role="tab" id="${id}-tw" aria-controls="${id}-w" aria-selected="false">WTA</button></div>
<div id="${id}-a" role="tabpanel" aria-labelledby="${id}-ta">${tablaRanking('atp', max, fotos)}</div><div id="${id}-w" role="tabpanel" aria-labelledby="${id}-tw" class="oculto">${tablaRanking('wta', max, fotos)}</div></div>`;
}

// ---------- Notas ----------
const fechaCorta = (iso) => fechaArg(iso, { day: 'numeric', month: 'short', year: 'numeric' });
function carrusel(lista) {
  return `<div class="carrusel" data-carrusel><div class="car-track" tabindex="0" aria-label="Últimas noticias">${lista.map(cardNota).join('')}</div>
<div class="car-ctrl"><button type="button" class="car-btn" data-dir="-1" aria-label="Noticias anteriores"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><div class="car-dots" aria-hidden="true">${lista.map((_, i) => `<span${i ? '' : ' class="on"'}></span>`).join('')}</div><button type="button" class="car-btn" data-dir="1" aria-label="Más noticias"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button></div></div>`;
}
const cardNota = (n) => `<a class="card" href="/nota/${n.slug}"><div class="img">${imagenNota(n)}</div><div class="txt"><span class="cat">${esc(n.categoria)}</span><h3>${esc(n.titulo)}</h3><span class="meta">${fechaCorta(n.fecha)}</span></div></a>`;


// ---------- Finals de fin de temporada y calendario 2027 (portada) ----------
const FINALES = leerJSON('content/finales.json', { eventos: [] }).eventos || [];
const CAL2027 = leerJSON('content/calendario-2027.json', { atp: [], wta: [] });
const MESES_C = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaC = (iso) => { const [, m, d] = iso.split('-').map(Number); return EN ? `${MESES_C[m - 1]} ${d}` : `${d} ${MESES_C[m - 1]}`; };
const enX = (o, k) => (EN && o[`${k}_en`]) || o[k];
const normN = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const mismoJugador = (a, b) => { a = normN(a); b = normN(b); return a === b || (a.split(' ').pop() === b.split(' ').pop() && a[0] === b[0]); };
const datosJugador = (nombre) => Object.values(jugadores.lista || {}).find((j) => mismoJugador(j.nombre, nombre)) || { nombre };
function eventoActivo(hoy = new Date()) {
  const d = hoy.toISOString().slice(0, 10);
  const menos = (iso, dias) => new Date(new Date(iso).getTime() - dias * 864e5).toISOString().slice(0, 10);
  return FINALES.filter((e) => d >= menos(e.desde, 10) && d <= e.hasta);
}
function partidosDeEvento(e) {
  const re = new RegExp(e.regexTorneo || 'finals', 'i');
  return partidos.filter((p) => !p.dobles && re.test(p.torneo || '') && (p.tour || '').replace(/_doubles$/, '') === e.tour);
}
function gruposDeEvento(e) {
  if (e.grupos?.length) return e.grupos;
  // Sin sorteo cargado: se deducen de los cruces de la fase de grupos (quienes se enfrentan están en el mismo grupo)
  const lista = e.clasificados || [];
  const id = new Map(lista.map((n, k) => [n, k]));
  for (const p of partidosDeEvento(e)) {
    if (p.rondaCod && p.rondaCod !== 'RR') continue;
    const a = lista.find((n) => mismoJugador(n, p.j1?.nombre)), b = lista.find((n) => mismoJugador(n, p.j2?.nombre));
    if (!a || !b || id.get(a) === id.get(b)) continue;
    const viejo = id.get(b), nuevo = id.get(a);
    for (const [n, v] of id) if (v === viejo) id.set(n, nuevo);
  }
  const comp = {};
  for (const n of lista) (comp[id.get(n)] ||= []).push(n);
  const gs = Object.values(comp).filter((g) => g.length === 4);
  return gs.length === 2 ? gs.map((jug, i) => ({ nombre: `Grupo ${i + 1}`, jugadores: jug })) : [];
}
function bloqueFinales() {
  const evs = eventoActivo();
  if (!evs.length) return '';
  return evs.map((e) => {
    const ps = partidosDeEvento(e).filter((p) => p.estado === 'finalizado' && p.ganador);
    const fila = (nombre) => {
      const j = datosJugador(nombre);
      let g = 0, pe = 0;
      for (const p of ps) {
        if (p.rondaCod && p.rondaCod !== 'RR') continue;
        const lado = mismoJugador(p.j1?.nombre, nombre) ? 1 : mismoJugador(p.j2?.nombre, nombre) ? 2 : 0;
        if (!lado) continue;
        if (p.ganador === lado) g++; else pe++;
      }
      return { j, g, pe };
    };
    const grupos = gruposDeEvento(e);
    const tabla = (gr) => {
      const filas = gr.jugadores.map(fila).sort((a, b) => b.g - a.g || a.pe - b.pe);
      return `<div class="fin-grupo"><h4>${esc(gr.nombre)}</h4>${filas.map((f) => `<div class="fin-fila"><span class="fin-j">${paisTag(f.j)}${esc(f.j.nombre)}</span><span class="fin-r">${f.g}-${f.pe}</span></div>`).join('')}</div>`;
    };
    const cuerpo = grupos.length
      ? `<div class="fin-grupos">${grupos.map(tabla).join('')}</div><p class="meta fin-ayuda">Partidos ganados y perdidos en la fase de grupos. Avanzan las dos primeras de cada grupo.</p>`
      : `<div class="fin-grupo"><h4>Clasificados</h4>${(e.clasificados || []).map((n) => `<div class="fin-fila"><span class="fin-j">${paisTag(datosJugador(n))}${esc(n)}</span></div>`).join('')}</div>${e.sorteo ? `<p class="meta fin-ayuda">${esc(enX(e, 'sorteo'))}</p>` : ''}`;
    const [, , d1] = e.desde.split('-').map(Number), [, m2, d2] = e.hasta.split('-').map(Number);
    return `<div class="panel fin"><div class="fin-cab"><span class="etq">${e.tour.toUpperCase()}</span><h3>${esc(e.nombre)}</h3><span class="meta">${esc(enX(e, 'sede'))} · ${EN ? `${['January','February','March','April','May','June','July','August','September','October','November','December'][m2 - 1]} ${d1}–${d2}` : `del ${d1} al ${d2} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m2 - 1]}`}</span></div>
${e.nota ? `<p class="fin-nota">${esc(enX(e, 'nota'))}</p>` : ''}${cuerpo}</div>`;
  }).join('');
}
function proximosTorneos(max = 6) {
  const hoy = new Date().toISOString().slice(0, 10);
  const todos = [...CAL2027.atp.map((x) => ({ ...x, tour: 'ATP' })), ...CAL2027.wta.map((x) => ({ ...x, tour: 'WTA' }))].filter((x) => x.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return `<div class="panel">${todos.slice(0, max).map((x) => `<div class="cal-fila"><span class="cal-f">${fechaC(x.fecha)}</span><span class="cal-t"><b>${esc(x.torneo)}</b><small>${x.tour} · ${esc(x.categoria)}</small></span></div>`).join('')}</div>`;
}
function calendario2027() {
  const hoy = new Date().toISOString().slice(0, 10);
  const lista = (arr, wta) => {
    const prox = arr.find((x) => x.fecha >= hoy);
    return `<div class="cal-grid">${arr.map((x) => `<div class="cal-item sup-${esc(x.sup)}${x === prox ? ' prox' : ''}"><span class="cal-fecha">${wta || x.semana ? (EN ? 'Week of ' : 'Semana del ') : ''}${fechaC(x.fecha)}</span><span class="cal-nom">${esc(x.torneo)}</span><span class="cal-meta">${esc(x.sede)} · ${esc(x.categoria)}</span></div>`).join('')}</div>`;
  };
  return `<section class="sec"><div class="sec-tit"><h1>Calendario 2027</h1></div>
<div class="panel" data-tabs><div class="tabs" role="tablist"><button role="tab" id="cal-ta" aria-controls="cal-a" aria-selected="true">ATP</button><button role="tab" id="cal-tw" aria-controls="cal-w" aria-selected="false">WTA</button></div>
<div id="cal-a" role="tabpanel" aria-labelledby="cal-ta">${lista(CAL2027.atp, false)}</div><div id="cal-w" role="tabpanel" aria-labelledby="cal-tw" class="oculto">${lista(CAL2027.wta, true)}</div>
<p class="meta" style="margin:10px 4px 2px">Grand Slam, Masters y WTA 1000, Finals y competencias por equipos. Fuente: calendarios oficiales de la ATP y la WTA. Sujeto a cambios.</p></div></section>`;
}

// Las 5 notas más importantes: primero la jornada más reciente, ordenadas por importancia; si faltan, la jornada anterior
function destacadas(max = 5) {
  const jornada = (n) => new Date(new Date(n.fechaPartido || n.fecha).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  const propias = notas.filter((n) => n.manual).slice(0, max);
  const auto = notas.filter((n) => !n.manual).sort((a, b) => jornada(b).localeCompare(jornada(a)) || (b.importancia ?? 0) - (a.importancia ?? 0));
  return [...propias, ...auto].slice(0, max);
}
function hero() {
  const item = (href, fondo, cat, titulo, bajada) => `<a class="hs" href="${href}">${fondo}${cat ? `<span class="etiqueta">${esc(cat)}</span>` : ''}<h2>${esc(titulo)}</h2>${bajada ? `<p>${esc(bajada)}</p>` : ''}</a>`;
  const items = destacadas().map((n) => item(`/nota/${n.slug}`, imagenNota(n), n.categoria, n.titulo, n.bajada));
  // Si todavía hay pocas notas, se completa con resultados destacados
  const conNota = new Set(notas.map((n) => n.partidoId));
  for (const p of terminados.filter((x) => x.importante && !conNota.has(x.id))) {
    if (items.length >= 5) break;
    const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
    // En inglés, si la nota todavía no está traducida, se usa igual su foto
    const ne = EN && notasES.find((x) => x.partidoId === p.id && x.imagen?.url);
    items.push(item('/resultados', ne ? imagenNota({ ...ne, titulo: `${g.nombre} - ${pe.nombre}` }) : cancha(p.superficie), nombreCategoria(p.tier, p.tour, p.torneo), `${apellido(g.nombre)} ${EN ? 'def.' : 'venció a'} ${apellido(pe.nombre)} ${marcadorTexto(p.score, p.ganador)}`, nombreTorneo(p.torneo)));
  }
  if (!items.length) items.push(item('/resultados', cancha('clay'), '', 'Todo el tenis, en un solo lugar', 'Resultados, ranking y noticias del circuito ATP, WTA, Challenger, Copa Davis y Billie Jean King Cup.'));
  const relleno = [['hard', 'Todos los resultados del circuito', '/resultados'], ['clay', 'Cuadros de cada torneo', '/torneos'], ['grass', 'Los cuatro Grand Slam', '/grand-slams'], ['hard', 'Ranking ATP y WTA', '/ranking']];
  for (let k = 0; items.length < 5; k++) { const [sup, t, h] = relleno[k % relleno.length]; items.push(item(h, cancha(sup), '', t, '')); }
  // La primera nota va al centro: el último elemento queda asomando a la izquierda
  const orden = [items[items.length - 1], ...items.slice(0, -1)];
  const flecha = (dir, txt, d) => `<button type="button" class="hs-flecha ${dir}" data-hs="${dir === 'izq' ? -1 : 1}" aria-label="${txt}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="${d}"/></svg></button>`;
  return `<section class="hero2" aria-label="Destacadas" data-hero><div class="hs-fila">${orden.join('')}</div>${flecha('izq', 'Anterior', 'M15 18l-6-6 6-6')}${flecha('der', 'Siguiente', 'M9 18l6-6-6-6')}</section>`;
}

function escribir(rel, html) { if (EN && rel.endsWith('.html')) html = traducirHTML(html); const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); }

// ---------- Páginas ----------
const T = generarTorneos({ torneos, partidos: visibles, esc, paisTag, filaPartido, hora, pagina, escribir: (rel, html) => escribir(rel, html), cancha, ARG });
const GS = generarGrandSlams({ datos: leerJSON('content/grand-slams.json', { torneos: [] }), rankingDe, partidos, esc, paisTag, pagina, escribir: (rel, html) => escribir(rel, html), cancha, htmlCuadro: T.htmlCuadro });
const torneosEnJuego = T.lista.filter((t) => t.enJuego).slice(0, 8);

// "Un día como hoy": efemérides verificadas (content/efemerides.json) + campeones que registra el sitio.
// Se elige en el navegador según la fecha local de cada visitante.
function recuadroEfemeride() {
  const base = leerJSON('content/efemerides.json', { items: [] }).items || [];
  const coma = (m) => { const s = String(m || '').split(' ').filter(Boolean); return s.length > 1 ? `${s.slice(0, -1).join(', ')} y ${s.at(-1)}` : s[0] || ''; };
  const auto = [];
  for (const t of Object.values(torneos)) {
    if (!/^(atp|wta)$/.test(t.tour)) continue;
    // Solo títulos significativos: Grand Slam, Finals y Masters/WTA 1000
    if (!/^(grand_slam|atp_1000|wta_1000|atp_finals|wta_finals|finals)$/.test(t.meta?.categoria || '') && !/finals/i.test(t.nombre)) continue;
    for (const [anio, c] of Object.entries(t.campeones || {})) {
      const s = c.singles; if (!s?.fecha || !s.campeon) continue;
      if (EN) { auto.push({ fecha: s.fecha.slice(0, 10), texto: `${s.campeon} won the ${nombreTorneo(t.nombre)} title${s.finalista ? `, beating ${s.finalista} in the final` : ''}${s.marcador ? ` ${String(s.marcador).split(' ').filter(Boolean).join(', ')}` : ''}.` }); continue; }
      auto.push({ fecha: s.fecha.slice(0, 10), texto: `${s.campeon} se quedaba con el título en ${nombreTorneo(t.nombre)}${s.finalista ? ` tras vencer en la final a ${s.finalista}` : ''}${s.marcador ? ` por ${coma(s.marcador)}` : ''}.`, fuente: 'Resultados de A Todo Tenis' });
    }
  }
  const items = [...base.map((x) => EN ? { fecha: x.fecha, texto: x.texto_en } : x), ...auto].filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) && x.texto);
  if (!items.length) return '';
  return `<div class="efem panel" id="efem" hidden><div class="efem-tit">Un día como hoy</div><p class="efem-txt"></p></div>
<script type="application/json" id="efem-datos">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>
<script>(function(){try{var d=JSON.parse(document.getElementById('efem-datos').textContent),h=new Date(),hoy=new Date(h.getFullYear(),h.getMonth(),h.getDate()),el=document.getElementById('efem');
var md=function(f){return f.slice(5)},cand=[],dias=0;
for(;dias<7&&!cand.length;dias++){var x=new Date(hoy);x.setDate(x.getDate()-dias);var k=String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');cand=d.filter(function(e){return md(e.fecha)===k&&+e.fecha.slice(0,4)<hoy.getFullYear()});}
if(!cand.length)return;var e=cand[(hoy.getDate()+hoy.getMonth())%cand.length],p=e.fecha.split('-'),f=new Date(+p[0],+p[1]-1,+p[2]),txt=${EN ? `f.toLocaleDateString('en-US',{month:'long',day:'numeric'})+', '+p[0]` : `f.toLocaleDateString('es-AR',{day:'numeric',month:'long'})+' de '+p[0]`};
el.querySelector('.efem-tit').textContent=dias===1?'${EN ? 'On this day' : 'Un día como hoy'}':'${EN ? 'This week in history' : 'Esta semana en la historia'}';
el.querySelector('.efem-txt').textContent=${EN ? `'On '+txt+': '+e.texto` : `(dias===1?'Un día como hoy, ':'Un ')+txt+', '+e.texto`};
el.hidden=false;}catch(_){}})();</script>`;
}

escribir('index.html', pagina({ ruta: '/', activo: 'inicio', cuerpo: `
${hero()}
<div class="tres sec">
${eventoActivo().length ? `<section><div class="sec-tit"><h2>Finals ${new Date().getFullYear()}</h2></div>${bloqueFinales()}</section>` : `<section><div class="sec-tit"><h2>Próximos torneos</h2></div>${proximosTorneos()}<a class="ver-mas panel" href="/calendario" style="margin-top:8px">Calendario 2027 →</a></section>`}
<section><div class="sec-tit"><h2>Torneos y resultados</h2></div>${panelResultados('home', 10)}<a class="ver-mas panel" href="/resultados" style="margin-top:8px">Ver todos los resultados →</a></section>
<section><div class="sec-tit"><h2>Ranking A Todo Tenis</h2></div>${panelRanking('rk', 10)}<a class="ver-mas panel" href="/ranking" style="margin-top:8px">Ranking completo →</a>${recuadroEfemeride()}</section>
</div>
${torneosEnJuego.length ? `<section class="sec"><div class="sec-tit"><h2>Torneos en juego</h2><a href="/torneos">Ver todos</a></div><div class="tgrid fila-scroll">${torneosEnJuego.map(T.cardTorneo).join('')}</div></section>` : ''}
<section class="sec"><div class="sec-tit"><h2>Próximos partidos</h2><a href="/resultados">Ver todos</a></div>
<div class="panel">${porTorneo(proximos.filter((p) => !p.dobles), 12) || '<div class="vacio" style="border:0">No hay partidos programados por ahora.</div>'}</div></section>
<section class="franja" aria-label="Espacios publicitarios">${[1, 2, 3, 4, 5].map(() => '<div>Tu marca acá</div>').join('')}</section>
` }));

escribir('noticias.html', pagina({ titulo: 'Noticias', ruta: '/noticias', activo: 'noticias', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Noticias</h1></div>
<p id="busqueda-info" class="meta" hidden></p>${notas.length ? `<div class="lista-notas" data-buscar-notas>${notas.map(cardNota).join('')}</div>` : '<div class="panel"><div class="vacio" style="border:0">Todavía no hay notas publicadas.</div></div>'}</div>` }));

escribir('resultados.html', pagina({ titulo: 'Resultados y partidos en vivo', descripcion: 'Resultados del día, partidos en vivo y próximos partidos del circuito ATP, WTA y Challenger.', ruta: '/resultados', activo: 'resultados', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Resultados</h1></div>${panelResultados('res', 999)}
</div>` }));

escribir('calendario.html', pagina({ titulo: 'Calendario 2027', descripcion: 'Calendario 2027 del circuito ATP y WTA: Grand Slam, Masters 1000, WTA 1000, Finals y Copa Davis.', ruta: '/calendario', activo: 'calendario', cuerpo: calendario2027() }));
escribir('ranking.html', pagina({ titulo: 'Ranking ATP y WTA', descripcion: 'Ranking ATP y WTA actualizado.', ruta: '/ranking', activo: 'ranking', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Ranking</h1></div>${panelRanking('rkc', 200, false)}
<p class="meta" style="margin-top:10px">Fotos de los jugadores: Wikimedia Commons, con licencia libre (<a href="/creditos" style="text-decoration:underline">ver créditos</a>).</p></div>` }));

const argRank = (tour) => rankingDe(tour).filter((j) => j.pais === ARG).slice(0, 30);
escribir('argentinos.html', pagina({ titulo: 'Argentinos en el circuito', ruta: '/argentinos', activo: 'argentinos', cuerpo: `
<div class="tres sec" style="grid-template-columns:1.6fr 1fr">
<section><div class="sec-tit"><h1>Argentinos en el circuito</h1></div>
<div class="panel">${porTorneo([...visibles.filter((p) => conArg(p) && p.estado === 'en_vivo'), ...terminados.filter(conArg), ...proximos.filter(conArg)]) || '<div class="vacio" style="border:0">Sin partidos por ahora.</div>'}</div>
${notas.filter((n) => n.argentina).length ? `<div class="sec-tit sec"><h2>Notas</h2></div><div class="notas2">${notas.filter((n) => n.argentina).slice(0, 8).map(cardNota).join('')}</div>` : ''}</section>
<section><div class="sec-tit"><h2>Mejores rankeados</h2></div><div class="panel" data-tabs><div class="tabs" role="tablist"><button role="tab" id="ar-ta" aria-controls="ar-a" aria-selected="true">ATP</button><button role="tab" id="ar-tw" aria-controls="ar-w" aria-selected="false">WTA</button></div>
<div id="ar-a" role="tabpanel" aria-labelledby="ar-ta">${argRank('atp').map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug"><span>${esc(j.nombre)}</span></span><span class="pts">${j.puntos?.toLocaleString(LOCALE) ?? ''}</span></div>`).join('') || '<div class="vacio">Sin datos.</div>'}</div>
<div id="ar-w" role="tabpanel" aria-labelledby="ar-tw" class="oculto">${argRank('wta').map((j) => `<div class="rk"><span class="pos">${j.ranking}</span><span class="jug"><span>${esc(j.nombre)}</span></span><span class="pts">${j.puntos?.toLocaleString(LOCALE) ?? ''}</span></div>`).join('') || '<div class="vacio">Sin argentinas entre las primeras del listado.</div>'}</div></div></section>
</div>` }));

escribir('acerca.html', pagina({ titulo: 'Acerca del sitio', ruta: '/acerca', cuerpo: `
<article class="nota"><h1>Acerca de A Todo Tenis</h1><div class="cuerpo">${EN ? `
<p>A Todo Tenis is a new site about world tennis. It follows the ATP, WTA and Challenger tours, the Davis Cup and the Billie Jean King Cup in real time.</p>
<p>Results, calendar and rankings come from Live Tennis API and update automatically. Stories are always based on verified results, with no invented quotes.</p>
<p>Images that accompany the stories are published with their credit. When a story has no photo, a graphic with the match result is shown instead.</p>
<p>The site is available in Spanish and English.</p>` : `
<p>A Todo Tenis es un sitio nuevo dedicado al tenis de todo el mundo. Sigue en tiempo real el circuito ATP, WTA, Challenger, la Copa Davis y la Billie Jean King Cup.</p>
<p>Los resultados, el calendario y el ranking provienen de Live Tennis API y se actualizan automáticamente. Las notas se escriben siempre a partir de resultados verificados y sin declaraciones inventadas.</p>
<p>Las imágenes que acompañan las notas se publican con su crédito correspondiente. Cuando una nota no tiene foto, se muestra una placa con el resultado del partido.</p>`}
</div></article>` }));

for (const n of notas) {
  const p = partidos.find((x) => x.id === n.partidoId);
  const ficha = p && p.score ? `<div class="ficha"><div class="grupo-tit">${esc(n.torneo)}<span>${esc(nombreCategoria(p.tier, p.tour, p.torneo))}</span></div>${filaPartido(p)}</div>` : '';
  const relacionadas = notas.filter((x) => x.slug !== n.slug).slice(0, 3);
  const ld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.titulo, description: n.bajada, datePublished: n.fecha, author: { '@type': 'Organization', name: S.nombre }, publisher: { '@type': 'Organization', name: S.nombre } };
  escribir(`nota/${n.slug}.html`, pagina({
    titulo: n.titulo, descripcion: n.bajada, ruta: `/nota/${n.slug}`, activo: 'noticias',
    extraHead: `<meta property="og:type" content="article"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    cuerpo: `<article class="nota"><span class="etiqueta">${esc(n.categoria)}</span>
<h1>${esc(n.titulo)}</h1><p class="bajada">${esc(n.bajada)}</p>
<div class="firma">${hora(n.fecha, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
${gettySrc(n.getty) ? `<figure class="getty"><iframe src="${esc(gettySrc(n.getty))}" title="Foto de Getty Images" loading="lazy" scrolling="no" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:${gettyRatio(n.getty)};border:0"></iframe><figcaption>Crédito de la imagen: Getty Images</figcaption></figure>`
  : `<figure><div class="img">${imagenNota(n, false)}</div>${n.imagen?.credito ? `<figcaption>Crédito de la imagen: <a href="${esc(n.imagen.enlace)}" rel="noopener">${esc(n.imagen.credito)}</a>${n.imagen.fechaFoto ? ` · ${EN ? 'photo from' : 'foto del'} ${esc(fechaArg(n.imagen.fechaFoto, { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}${n.imagen.licenciaUrl ? ` · <a href="${esc(n.imagen.licenciaUrl)}" rel="noopener license">licencia</a>` : ''}</figcaption>` : ''}</figure>`}
<div class="cuerpo">${n.cuerpo.map((x, i) => `<p>${esc(x)}</p>${i === 1 ? declaracionNota(n) : ''}`).join('')}</div>${videoNota(n)}${ficha}
${relacionadas.length ? `<div class="sec-tit sec"><h2>Más noticias</h2></div><div class="lista-notas">${relacionadas.map(cardNota).join('')}</div>` : ''}
</article>`
  }));
}

escribir('creditos.html', pagina({ titulo: 'Créditos de imágenes', ruta: '/creditos', cuerpo: `<article class="nota"><h1>Créditos de imágenes</h1><div class="cuerpo">
<p>Las fotos de los jugadores provienen de Wikimedia Commons y se publican bajo las licencias libres indicadas, con el crédito de su autor.</p></div>
<div class="panel">${Object.entries(avatares).filter(([, a]) => a?.url).sort((x, y) => x[0].localeCompare(y[0])).map(([nombre, a]) => `<div class="grupo" style="display:flex;gap:12px;align-items:center"><span class="av"><img src="${esc(a.url)}" alt="" loading="lazy" style="object-position:${esc(a.foco || 'center 20%')}"></span><span><strong>${esc(nombre)}</strong><br><span class="meta">Foto: ${esc(a.autor)} · <a href="${esc(a.pagina)}" rel="noopener" style="text-decoration:underline">${esc(a.licencia)}</a>, vía Wikimedia Commons</span></span></div>`).join('') || '<div class="vacio" style="border:0">Todavía no hay fotos cargadas.</div>'}</div></article>` }));
escribir('404.html', pagina({ titulo: 'Página no encontrada', ruta: '/404', cuerpo: '<article class="nota"><h1>Esta pelota se fue afuera</h1><p class="bajada">La página que buscás no existe. <a href="/" style="color:#C6F432">Volver al inicio</a>.</p></article>' }));

// SEO: sitemap, RSS, robots
const urls = ['/', '/noticias', '/resultados', '/torneos', '/grand-slams', ...GS.torneos.map((t) => `/grand-slam/${t.slug}`), '/ranking', '/calendario', '/argentinos', '/acerca', ...T.lista.map((t) => `/torneo/${t.slug}`), ...notas.map((n) => `/nota/${n.slug}`)];
if (EN) {
  fs.writeFileSync(path.join(DIST, '.urls.json'), JSON.stringify(urls));
  console.log(`Versión en inglés: ${urls.length} páginas, ${notas.length} notas.`);
  process.exit(0);
}
// Versión en inglés en dist/en (mismo generador, otro idioma)
execFileSync(process.execPath, [new URL(import.meta.url).pathname], { env: { ...process.env, SITIO_LANG: 'en' }, stdio: 'inherit' });
const urlsEN = JSON.parse(fs.readFileSync(path.join(DIST, 'en/.urls.json'), 'utf8')); fs.rmSync(path.join(DIST, 'en/.urls.json'));
const enSet = new Set(urlsEN);
const alt = (u) => `<xhtml:link rel="alternate" hreflang="es" href="${S.url}${u}"/>${enSet.has(u) ? `<xhtml:link rel="alternate" hreflang="en" href="${S.url}/en${u === '/' ? '' : u}"/>` : ''}`;
escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.map((u) => `<url><loc>${S.url}${u}</loc>${alt(u)}</url>`).join('')}${urlsEN.map((u) => `<url><loc>${S.url}/en${u === '/' ? '' : u}</loc>${alt(u)}</url>`).join('')}</urlset>\n`);
if (false) escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${S.url}${u}</loc></url>`).join('')}</urlset>\n`);
escribir('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
escribir('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(S.nombre)}</title><link>${S.url}</link><description>${esc(S.descripcion)}</description><language>es-ar</language>${notas.slice(0, 30).map((n) => `<item><title>${esc(n.titulo)}</title><link>${S.url}/nota/${n.slug}</link><guid>${S.url}/nota/${n.slug}</guid><pubDate>${new Date(n.fecha).toUTCString()}</pubDate><description>${esc(n.bajada)}</description></item>`).join('')}</channel></rss>\n`);

console.log(`Sitio generado: ${urls.length} páginas, ${notas.length} notas, ${partidos.length} partidos.`);
