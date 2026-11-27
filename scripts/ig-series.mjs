// Series fijas de Instagram. Cada corrida revisa si toca alguna; si toca, dibuja las placas
// y las deja en data/ig-carruseles.json para que `instagram.mjs carruseles` las publique cuando estén online.
//   Lunes 11 UTC    → Campeones de la semana (con las finales del domingo)
//   Lunes 16 UTC    → El ranking del lunes (ATP y WTA)
//   Todos los días  → Un día como hoy (solo si hay efeméride para la fecha), 16 UTC
//   node scripts/ig-series.mjs [ranking|efemeride|campeones]  → fuerza una serie (pruebas)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, log, conGrafia } from './lib/util.mjs';
const esc = (t) => esc0(conGrafia(t));
import { esc as esc0, fotoJugador, focoJugador, fotoElegida, dibujar, marco, caja, etiqueta, fondoFoto } from './lib/ig-render.mjs';

const SITIO = 'https://atodotenis.vercel.app';
const CRED = `<div style="position:absolute;left:64px;right:64px;bottom:100px;font-size:20px;color:#6B7785">Fotos: Wikimedia Commons, licencias libres. Autores en atodotenis.vercel.app/creditos</div>`;
const CREDT = 'Fotos: Wikimedia Commons, licencias libres. Autores en atodotenis.vercel.app/creditos';
const COLA = path.join(ROOT, 'data/ig-carruseles.json');
const leer = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ape = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0];
const tag = (n) => '#' + ape(n).normalize('NFD').replace(/[^A-Za-z]/g, '');
const pais = (p) => (p ? String(p).toUpperCase() : '');
const ahora = new Date();
const hoyISO = ahora.toISOString().slice(0, 10);
const masDias = (d) => new Date(ahora.getTime() + d * 864e5).toISOString();

function semanaISO(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - inicio) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

// ---------- El ranking del lunes ----------
async function ranking() {
  const lista = Object.values(leer('data/jugadores.json', {}).lista || {});
  const top = (tour) => lista.filter((j) => j.tour === tour && j.ranking).sort((a, b) => a.ranking - b.ranking).slice(0, 10);
  const atp = top('atp'), wta = top('wta');
  if (atp.length < 10 || wta.length < 10) { log('Ranking incompleto, no se arma.'); return null; }
  // Solo se publica si cambió algún puesto del top 10 desde el último ranking publicado (en pretemporada no se repite)
  const firma = [...atp, ...wta].map((j) => `${j.tour}${j.ranking}:${j.nombre}`).join('|');
  if (ESTADO.rankingFirma === firma && !PRUEBA) { log('El top 10 no cambió desde el último ranking: no se publica.'); return null; }
  const fecha = `${ahora.getUTCDate()} de ${MESES[ahora.getUTCMonth()]}`;
  const [f1, f2] = [await fotoJugador(atp[0].nombre, 1280), await fotoJugador(wta[0].nombre, 1280)];
  const n1 = (tour, j) => `<div style="position:absolute;left:36px;right:24px;bottom:40px"><div class="ndor" style="font:900 italic 40px BC;letter-spacing:.04em">N° 1 ${tour}</div>
    <div style="font:900 italic 66px/0.92 BC;text-transform:uppercase;margin-top:6px">${esc(j.nombre)}</div><div class="ngris" style="font:700 30px BC;margin-top:6px">${esc(j.puntos?.toLocaleString('es-AR'))} PUNTOS</div></div>`;
  const mitad = (foto, tour, j, lado) => `<div style="position:absolute;top:0;${lado}:0;width:538px;height:930px;overflow:hidden;background:${foto ? `#16263C url('${foto}') ${focoJugador(j.nombre)}/cover` : 'linear-gradient(180deg,#1E3350,#0E1828)'}">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,10,18,.5),rgba(6,10,18,0) 25%,rgba(6,10,18,0) 50%,rgba(11,19,32,.95) 88%)"></div>${n1(tour, j)}</div>`;
  const conFotos = f1 && f2;
  const portada = `<div class="s n">${mitad(conFotos ? f1 : null, 'ATP', atp[0], 'left')}${mitad(conFotos ? f2 : null, 'WTA', wta[0], 'right')}
    <div style="position:absolute;left:538px;width:4px;top:0;height:930px;background:#D9B25E"></div>
    <div style="position:absolute;left:0;right:0;top:960px;text-align:center">${etiqueta(`El ranking del lunes · ${fecha}`)}</div>
    <div style="position:absolute;left:80px;right:80px;top:1050px">${caja('Así está el top 10', { size: 104 })}</div>
    ${marco(1, 3, '', 'Deslizá →')}</div>`;
  const flecha = (j) => j.cambio > 0 ? `<span style="color:#7BE38B">▲ ${j.cambio}</span>` : j.cambio < 0 ? `<span style="color:#FF6B6B">▼ ${-j.cambio}</span>`
    : j.mov === 'up' ? '<span style="color:#7BE38B">▲</span>' : j.mov === 'down' ? '<span style="color:#FF6B6B">▼</span>' : '<span class="ngris">=</span>';
  const caras = async (js) => { const f = []; for (const j of js) f.push(await fotoJugador(j.nombre)); return f.every(Boolean) ? f : null; };
  const [carasATP, carasWTA] = [await caras(atp), await caras(wta)];
  const tabla = (tour, js, n, fotos) => `<div class="s n">
    <div style="position:absolute;left:250px;right:60px;top:66px">${caja(`Ranking ${tour}`, { size: 80 })}</div>
    <div style="position:absolute;left:44px;right:44px;top:250px;display:flex;flex-direction:column;gap:8px">${js.map((j, i) => `<div style="display:flex;align-items:center;height:86px;padding:0 22px;background:${i ? 'linear-gradient(90deg,#17263C,#0F1A2B)' : 'linear-gradient(90deg,#3A2E12,#17263C 60%)'};border-left:8px solid ${i ? '#2A3B54' : '#D9B25E'}">
      <span class="${i ? '' : 'noro'}" style="width:76px;font:900 italic 56px BC">${j.ranking}</span>
      ${fotos ? `<span style="width:66px;height:66px;border-radius:50%;margin-right:20px;flex:none;border:3px solid ${i ? '#2A3B54' : '#D9B25E'};background:#16263C url('${fotos[i]}') ${focoJugador(j.nombre)}/cover"></span>` : ''}
      <span style="flex:1;min-width:0;font:800 italic 44px BC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(j.nombre)} <small class="ngris" style="font:700 26px BC">${esc(pais(j.pais))}</small></span>
      <span class="ngris" style="width:150px;text-align:right;font:700 36px BC">${esc(j.puntos?.toLocaleString('es-AR'))}</span>
      <span style="width:86px;text-align:right;font:700 34px BC">${flecha(j)}</span></div>`).join('')}</div>
    ${marco(n, 3, n === 3 ? CREDT : '', 'Puntos y movimiento de la semana')}</div>`;
  // Placas 2 y 3: las mismas del Top 10 de las notas de ranking (scripts/placa-ranking.mjs); si fallan, la tabla de respaldo
  const placaNota = (tour) => { try {
    const f = path.join(ROOT, 'node_modules', `.placa-${tour}.jpg`);
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/placa-ranking.mjs'), tour, 'es', hoyISO, f], { stdio: 'inherit' });
    return `<div class="s n" style="background:url('data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}') center/cover"></div>`;
  } catch (err) { log('Placa de ranking no disponible, se usa la tabla:', tour, err.message); return null; } };
  const placas = [portada, placaNota('atp') || tabla('ATP', atp, 2, carasATP), placaNota('wta') || tabla('WTA', wta, 3, carasWTA)];
  const sube = [...atp, ...wta].filter((j) => j.cambio > 0).sort((a, b) => b.cambio - a.cambio)[0];
  const texto = [
    `El ranking de esta semana: ${atp[0].nombre} es el N° 1 de la ATP y ${wta[0].nombre}, de la WTA.`,
    sube ? `En el top 10, el que más subió fue ${sube.nombre}: ${sube.cambio} ${sube.cambio === 1 ? 'puesto' : 'puestos'}, hasta el ${sube.ranking}°.` : null,
    '¿Quién termina el año arriba?',
    'El ranking completo, en el link de la bio.',
    ['#tenis', '#tennis', '#ranking', tag(atp[0].nombre), tag(wta[0].nombre)].join(' '),
  ].filter(Boolean).join('\n\n');
  return { id: `ranking-${semanaISO(ahora)}`, placas, texto, vence: masDias(2), prioridad: 1, claves: ["ranking"], estado: { rankingFirma: firma } };
}

// ---------- Un día como hoy ----------
// Carrusel de 3 placas: portada con foto de la época, la historia y los números.
// Control de calidad: solo sale si la efeméride tiene titulo, historia, datos y una foto elegida a mano
// (content/efemerides.json) y la foto es lo bastante grande para cubrir la placa sin estirarse.
async function efemeride(fechaFija) {
  const items = leer('content/efemerides.json', {}).items || [];
  const mmdd = hoyISO.slice(5);
  const completa = (x) => x.titulo && x.historia?.length && x.datos?.length >= 2 && x.foto?.url && (x.aprobada || PRUEBA);
  const delDia = items.filter((x) => x.fecha.slice(5) === mmdd).sort((x, y) => (y.prioridad || 0) - (x.prioridad || 0));
  let e = fechaFija ? items.find((x) => x.fecha === fechaFija) : delDia.find(completa);
  if (!e && PRUEBA) e = items.filter((x) => completa(x) && x.fecha.slice(5) >= mmdd).sort((x, y) => x.fecha.slice(5).localeCompare(y.fecha.slice(5)))[0];
  if (!e) { if (delDia.length) log('Efeméride del día sin contenido completo (titulo, historia, datos, foto): no se publica.'); return null; }
  const anio = e.fecha.slice(0, 4);
  const hace = ahora.getUTCFullYear() - Number(anio);
  const foto = await fotoElegida(e.foto.url, `efe-${e.fecha}`);
  // La foto cubre 1080x1350: no se acepta si habría que agrandarla más de un 10%
  const escala = foto ? Math.max(1080 / foto.ancho, 1350 / foto.alto) : 9;
  if (escala > 1.1) { log('Efeméride descartada: la foto no tiene calidad suficiente', e.fecha, foto ? `${foto.ancho}x${foto.alto}` : 'sin foto'); return null; }
  const fechaTxt = `${Number(e.fecha.slice(8))} de ${MESES[Number(e.fecha.slice(5, 7)) - 1]} de ${anio}`;
  const fechaCorta = `${e.fecha.slice(8)}/${e.fecha.slice(5, 7)}/${anio}`;
  const credito = `Foto: ${esc(e.foto.autor || 'Wikimedia Commons')} · ${esc(e.foto.licencia || 'licencia libre')} · Wikimedia Commons`;
  const portada = `<div class="s n">${fondoFoto(foto.data, esc(e.foto.foco || 'center 30%'), 1020)}
    <div style="position:absolute;left:0;right:0;top:${e.titulo.length > 60 ? 700 : 760}px;text-align:center">${etiqueta(`Un día como hoy · ${fechaCorta}`)}</div>
    <div style="position:absolute;left:66px;right:66px;top:${e.titulo.length > 60 ? 800 : 850}px">${caja(e.titulo, { size: e.titulo.length <= 45 ? 96 : e.titulo.length <= 70 ? 82 : 70 })}</div>
    ${marco(1, 3, credito, `Hace ${hace} ${hace === 1 ? 'año' : 'años'} · deslizá →`)}</div>`;
  const historia = `<div class="s n">
    <div style="position:absolute;left:250px;right:60px;top:66px">${caja('La historia', { size: 84 })}</div>
    <div style="position:absolute;left:70px;right:70px;top:290px">
      <div class="ndor" style="font:900 italic 46px BC;letter-spacing:.03em;text-transform:uppercase">${esc(fechaTxt)}</div>
      ${e.historia.map((t, i) => `<p style="margin:${i ? 30 : 24}px 0 0;${i ? 'font:400 38px/1.38 Inter;color:#D5DBE1' : 'font:800 italic 52px/1.08 BC;text-transform:uppercase'}">${esc(t)}</p>`).join('')}
      ${e.marcador ? `<div class="ntarj" style="margin-top:44px;display:inline-block;padding:20px 34px;border-top:none;border-left:8px solid #D9B25E"><div class="ngris" style="font:700 28px BC;letter-spacing:.06em;text-transform:uppercase">${esc(e.marcadorTitulo || 'Marcador de la final')}</div><div class="noro" style="font:900 italic 64px BC;white-space:nowrap;margin-top:4px">${esc(e.marcador)}</div></div>` : ''}
    </div>${marco(2, 3, '', 'Deslizá →')}</div>`;
  const ds = e.datos.slice(0, 3);
  const numeros = `<div class="s n">
    <div style="position:absolute;left:250px;right:60px;top:66px">${caja('En números', { size: 84, oro: true })}</div>
    <div style="position:absolute;left:70px;right:70px;top:300px;display:flex;flex-direction:column;gap:40px">
      ${ds.map((d) => `<div class="ntarj" style="padding:36px 40px 40px;display:flex;align-items:center;gap:34px"><div class="noro" style="font:900 italic ${String(d.valor).length > 5 ? 96 : 140}px/0.95 BC;white-space:nowrap;padding-right:8px">${esc(d.valor)}</div><div style="font:800 italic 40px/1.08 BC;text-transform:uppercase">${esc(d.texto)}</div></div>`).join('')}
    </div>${marco(3, 3, `Fuente: ${esc(e.fuente || '')}`, '¿Lo viste en vivo?')}</div>`;
  const texto = [`Un día como hoy, hace ${hace} ${hace === 1 ? 'año' : 'años'}.`, e.texto, e.pregunta || '¿Lo viste en vivo?', ['#tenis', '#tennis', '#undiacomohoy', ...(e.hashtags || [])].slice(0, 5).join(' ')].join('\n\n');
  return { id: `efemeride-${fechaFija || hoyISO}`, placas: [portada, historia, numeros], texto, vence: `${hoyISO}T23:59:00Z`, prioridad: 4 };
}

// ---------- Campeones de la semana ----------
const CATEG = { grand_slam: 'Grand Slam', masters_1000: 'Masters 1000', atp_500: 'ATP 500', atp_250: 'ATP 250', wta_1000: 'WTA 1000', wta_500: 'WTA 500', wta_250: 'WTA 250', wta_125: 'WTA 125', challenger: 'Challenger' };
async function campeones() {
  const t = leer('data/torneos.json', []);
  const lista = Array.isArray(t) ? t : Object.values(t.torneos || t);
  const desde = ahora.getTime() - 7 * 864e5;
  const orden = ['grand_slam', 'masters_1000', 'wta_1000', 'atp_500', 'wta_500', 'atp_250', 'wta_250', 'wta_125', 'challenger'];
  const filas = [];
  for (const x of lista) {
    const c = x?.campeones?.[String(ahora.getUTCFullYear())]?.singles;
    if (!c?.campeon || !c.fecha || new Date(c.fecha).getTime() < desde) continue;
    const cat = x.meta?.categoria || (x.tour === 'challenger' ? 'challenger' : '');
    filas.push({ torneo: x.nombre.replace(/\s*\(.*\)$/, ''), cat, etiqueta: CATEG[cat] || String(x.tour || '').toUpperCase(), ...c });
  }
  if (!filas.length) return null;
  filas.sort((a, b) => (orden.indexOf(a.cat) + 99) % 99 - (orden.indexOf(b.cat) + 99) % 99);
  const elegidos = filas.slice(0, 6);
  const fotosC = []; for (const f of elegidos) fotosC.push(await fotoJugador(f.campeon, 1280));
  const n = elegidos.length;
  const placas = [];
  for (const [k, f] of elegidos.entries()) {
    const foto = fotosC[k];
    const ella = /wta/.test(f.cat);
    const abajo = `<div style="position:absolute;left:70px;right:70px;top:1075px;display:flex;align-items:center;justify-content:space-between;gap:30px">
      <div style="font:400 32px/1.3 Inter;color:#D5DBE1">${ella ? 'Campeona' : 'Campeón'} · le ganó la final a <b style="color:#fff">${esc(f.finalista)}</b></div>
      <div class="noro" style="font:900 italic 62px BC;white-space:nowrap;padding-right:6px">${esc(f.marcador)}</div></div>`;
    placas.push(`<div class="s n">${foto ? fondoFoto(foto, focoJugador(f.campeon), 960)
      : `<div class="noro" style="position:absolute;left:0;right:0;top:300px;text-align:center;font:900 italic 230px/0.9 BC">${ella ? 'CAMPEONA' : 'CAMPEÓN'}</div>`}
      <div style="position:absolute;left:0;right:0;top:${foto ? 770 : 600}px;text-align:center">${etiqueta(`${f.etiqueta} · ${f.torneo}`)}</div>
      <div style="position:absolute;left:70px;right:70px;top:${foto ? 860 : 700}px">${caja(f.campeon, { size: f.campeon.length > 18 ? 92 : 112 })}</div>
      ${abajo}${marco(k + 1, n, k === n - 1 ? CREDT : '', n > 1 && k < n - 1 ? 'Campeones de la semana · deslizá →' : 'La nota, en el link de la bio')}</div>`);
  }
  const primero = filas[0];
  const texto = [
    `Los campeones de la semana: ${filas.slice(0, 4).map((f) => `${f.campeon} (${f.torneo})`).join(', ')}${filas.length > 4 ? ' y más' : ''}.`,
    '¿Cuál de estos títulos te sorprendió?',
    ['#tenis', '#tennis', '#ATP', '#WTA', tag(primero.campeon)].join(' '),
  ].join('\n\n');
  return { id: `campeones-${semanaISO(ahora)}`, placas, texto, vence: masDias(1), prioridad: 3, claves: ["campeon"] };
}

// ---------- Los resultados del día ----------
// Un solo carrusel con todos los partidos del día (en vez de una imagen por partido). Las finales salen aparte.
const esFinal = (n) => String(n.resultado?.ronda || '').toUpperCase() === 'F' || /campe[oó]n|campeona/i.test(n.titulo || '');
const iniciales = (n) => String(n).split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
async function resultados() {
  const dir = path.join(ROOT, 'content/notas');
  const ya = new Set(ESTADO.resultadosIncluidos || []);
  const desde = ahora.getTime() - (PRUEBA ? 10 : 1) * 24 * 3600e3;
  const notas = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => leer(`content/notas/${f}`, {}))
    .filter((n) => n.estado === 'publicada' && n.resultado?.ganador?.nombre && n.resultado?.perdedor?.nombre && n.resultado?.sets?.length
      && new Date(n.fechaPartido || n.fecha).getTime() > desde && !ya.has(n.slug) && !esFinal(n))
    .sort((a, b) => (b.importancia || 0) - (a.importancia || 0)).slice(0, 8);
  if (notas.length < 2) { log('Resultados del día: menos de 2 partidos, no se arma carrusel.'); return null; }
  const caras = {};
  for (const n of notas) for (const j of [n.resultado.ganador.nombre, n.resultado.perdedor.nombre]) caras[j] = await fotoJugador(j);
  const sets = (n) => n.resultado.sets.map(([a, b]) => `${a}-${b}`).join(' ');
  const total = notas.length + 1;
  const fechaHoy = `${ahora.getUTCDate()} de ${MESES[ahora.getUTCMonth()]}`;
  const portada = `<div class="s n">
    <div style="position:absolute;left:250px;right:60px;top:66px">${caja('Lo que pasó hoy', { size: 84 })}</div>
    <div style="position:absolute;left:70px;top:250px">${etiqueta(`${fechaHoy} · ${notas.length} partidos`)}</div>
    <div style="position:absolute;left:44px;right:44px;top:350px;display:flex;flex-direction:column;gap:10px">${notas.slice(0, 7).map((n) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px 24px;background:linear-gradient(90deg,#17263C,#0F1A2B);border-left:8px solid #D9B25E">
      <div style="min-width:0"><div class="ndor" style="font:700 24px BC;letter-spacing:.06em">${esc(String(n.torneo || n.categoria || '').toUpperCase())}</div>
      <div style="font:800 italic 40px/1.05 BC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ape(n.resultado.ganador.nombre))} <span class="ngris" style="font:700 30px BC;text-transform:none">le ganó a</span> ${esc(ape(n.resultado.perdedor.nombre))}</div></div>
      <div style="font:900 italic 42px BC;white-space:nowrap">${esc(sets(n))}</div></div>`).join('')}${notas.length > 7 ? `<div class="ngris" style="padding-top:8px;font:700 30px BC">Y ${notas.length - 7} MÁS EN LAS PLACAS SIGUIENTES</div>` : ''}</div>
    ${marco(1, total, '', 'Deslizá →')}</div>`;
  const fila = (j, gano, n) => {
    const f = caras[j.nombre];
    const borde = gano ? 'box-shadow:0 0 0 6px #D9B25E' : 'filter:grayscale(.4);box-shadow:0 0 0 4px #2A3B54';
    const circulo = f ? `<span style="width:240px;height:240px;border-radius:50%;flex:none;background:#16263C url('${f}') ${focoJugador(j.nombre)}/cover;${borde}"></span>`
      : `<span class="ngris" style="width:240px;height:240px;border-radius:50%;flex:none;background:#16263C;display:flex;align-items:center;justify-content:center;font:900 italic 80px BC;${borde}">${esc(iniciales(j.nombre))}</span>`;
    const celdas = n.resultado.sets.map((st) => { const [a, b] = gano ? st : [st[1], st[0]]; return `<span class="${a > b ? 'noro' : ''}" style="width:74px;text-align:center;font:900 italic 80px BC;${a > b ? '' : 'color:#5B6878'}">${a}</span>`; }).join('');
    return `<div style="display:flex;align-items:center;gap:36px;padding:46px 0">${circulo}
      <div style="flex:1;min-width:0"><div style="font:900 italic 62px/0.95 BC;text-transform:uppercase;${gano ? '' : 'color:#AEB7C1'}">${esc(j.nombre)}</div><div class="ngris" style="font:700 30px BC;margin-top:8px">${esc(String(j.pais || '').toUpperCase())}${j.ranking ? ` · N° ${j.ranking}` : ''}</div></div>
      <div style="display:flex">${celdas}</div></div>`;
  };
  const placas = [portada, ...notas.map((n, k) => `<div class="s n">
    <div style="position:absolute;left:250px;right:60px;top:66px">${caja(String(n.torneo || n.categoria || 'Tenis'), { size: 72 })}</div>
    <div style="position:absolute;left:60px;right:60px;top:250px">${fila(n.resultado.ganador, true, n)}<div style="height:3px;background:linear-gradient(90deg,#D9B25E,rgba(217,178,94,0))"></div>${fila(n.resultado.perdedor, false, n)}
    <div class="ntarj" style="margin-top:46px;border-top:none;border-left:8px solid #D9B25E;padding:26px 34px"><p style="margin:0;font:400 40px/1.38 Inter;color:#E1E6EB;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(n.bajada || '')}</p></div></div>
    ${marco(k + 2, total, k === notas.length - 1 ? CREDT : '', k < notas.length - 1 ? 'Deslizá →' : 'Las notas, en el link de la bio')}</div>`)];
  const texto = [
    `Los resultados del día: ${notas.slice(0, 4).map((n) => `${n.resultado.ganador.nombre} le ganó a ${n.resultado.perdedor.nombre}`).join('; ')}${notas.length > 4 ? ' y más' : ''}.`,
    '¿Cuál fue el mejor partido de hoy?',
    'Las notas de cada partido, en el link de la bio.',
    ['#tenis', '#tennis', ...[...new Set(notas.slice(0, 3).map((n) => tag(n.resultado.ganador.nombre)))]].slice(0, 5).join(' '),
  ].join('\n\n');
  const manana = new Date(ahora.getTime() + 864e5).toISOString().slice(0, 10);
  return { id: `resultados-${hoyISO}`, placas, texto, vence: `${manana}T02:00:00Z`, prioridad: 2, tanda: 'C',
    estado: { resultadosIncluidos: [...ya, ...notas.map((n) => n.slug)].slice(-300) } };
}
const apeNorm = (n) => ape(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Qué toca ahora ----------
// Baja (una sola vez) las fotos de los 30 mejores de cada circuito, para que las series siempre tengan caras.
async function fotos() {
  const lista = Object.values(leer('data/jugadores.json', {}).lista || {});
  let ok = 0, faltan = [];
  for (const tour of ['atp', 'wta']) for (const j of lista.filter((x) => x.tour === tour && x.ranking).sort((a, b) => a.ranking - b.ranking).slice(0, 30)) {
    if (await fotoJugador(j.nombre)) ok++; else faltan.push(j.nombre);
  }
  log('Fotos de jugadores:', ok, 'listas; sin foto:', faltan.join(', ') || 'ninguno');
  return null;
}
const SERIES = { ranking, efemeride, campeones, resultados, fotos };
function tocan() {
  const h = ahora.getUTCHours(), d = ahora.getUTCDay();
  const r = [];
  if (d === 1 && h >= 9) r.push('campeones');   // lunes, para la tanda de las 11 UTC (incluye las finales del domingo)
  if (d === 1 && h >= 14) r.push('ranking');    // lunes, para la tanda de las 16 UTC
  if (h >= 14) r.push('efemeride');             // tanda de las 16 UTC (o la siguiente si está ocupada)
  if (h >= 21) r.push('resultados');            // tanda de las 23 UTC: un carrusel con los partidos del día
  return r;
}

const cola = leer('data/ig-carruseles.json', []);
const ARCHIVO_ESTADO = path.join(ROOT, 'data/ig-series-estado.json');
const ESTADO = leer('data/ig-series-estado.json', {});
const forzada = process.argv[2];
const PRUEBA = process.argv[3] === 'prueba'; // dibuja en static/ig/prueba y no lo manda a la cola
// Prueba de todas las efemérides completas: node scripts/ig-series.mjs efemerides prueba
const trabajos = forzada === 'efemerides' && PRUEBA
  ? (leer('content/efemerides.json', {}).items || []).filter((x) => x.titulo && x.foto?.url).map((x) => () => efemeride(x.fecha))
  : (forzada ? [forzada] : tocan()).map((n) => () => SERIES[n]?.());
for (const trabajo of trabajos) {
  const pieza = await trabajo();
  if (!pieza) continue;
  if (!PRUEBA && cola.some((c) => c.id === pieza.id)) continue;
  const archivos = pieza.placas.map((_, i) => path.join(ROOT, PRUEBA ? 'static/ig/prueba' : 'static/ig/series', `${pieza.id}-${i + 1}.jpg`));
  if (!(await dibujar(pieza.placas, archivos))) { log('Serie descartada por imágenes:', pieza.id); continue; }
  if (PRUEBA) { log('Prueba dibujada:', pieza.id); continue; }
  cola.push({ id: pieza.id, prioridad: pieza.prioridad, imagenes: archivos.map((a) => `${SITIO}/ig/series/${path.basename(a)}`), texto: conGrafia(pieza.texto), vence: pieza.vence, ...(pieza.claves ? { claves: pieza.claves } : {}), ...(pieza.tanda ? { tanda: pieza.tanda } : {}) });
  fs.writeFileSync(COLA, JSON.stringify(cola, null, 1) + '\n');
  if (pieza.estado) { Object.assign(ESTADO, pieza.estado); fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify(ESTADO, null, 1) + '\n'); }
  log('Serie lista para Instagram:', pieza.id);
}
