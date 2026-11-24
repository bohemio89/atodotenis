// Series fijas de Instagram. Cada corrida revisa si toca alguna; si toca, dibuja las placas
// y las deja en data/ig-carruseles.json para que `instagram.mjs carruseles` las publique cuando estén online.
//   Lunes 11 UTC    → Campeones de la semana (con las finales del domingo)
//   Lunes 16 UTC    → El ranking del lunes (ATP y WTA)
//   Todos los días  → Un día como hoy (solo si hay efeméride para la fecha), 16 UTC
//   node scripts/ig-series.mjs [ranking|efemeride|campeones]  → fuerza una serie (pruebas)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './lib/util.mjs';
import { esc, fotoJugador, focoJugador, fotoElegida, cabecera, pie, dibujar } from './lib/ig-render.mjs';

const SITIO = 'https://atodotenis.vercel.app';
const CRED = `<div style="position:absolute;left:64px;right:64px;bottom:100px;font-size:20px;color:#6B7785">Fotos: Wikimedia Commons, licencias libres. Autores en atodotenis.vercel.app/creditos</div>`;
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
  const mitad = (foto, tour, j) => `<div style="position:relative;flex:1;height:820px;border-radius:22px;overflow:hidden;background:#1B222A url('${foto}') ${focoJugador(j.nombre)}/cover">
    <div style="position:absolute;inset:auto 0 0 0;padding:120px 32px 30px;background:linear-gradient(rgba(18,22,27,0),#12161B 70%)">
    <div style="font:800 30px Montserrat" class="lima">N° 1 ${tour}</div><div style="font:800 52px/1.05 Montserrat">${esc(j.nombre)}</div>
    <div style="font-size:28px" class="gris">${esc(j.puntos?.toLocaleString('es-AR'))} puntos</div></div></div>`;
  const tipo = (tour, j) => `<div style="flex:1;height:820px;border-radius:22px;background:#1B222A;padding:48px 36px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end">
    <div style="font:800 30px Montserrat" class="lima">N° 1 ${tour}</div><div style="font:800 60px/1.05 Montserrat">${esc(j.nombre)}</div>
    <div style="font-size:28px" class="gris">${esc(j.puntos?.toLocaleString('es-AR'))} puntos</div></div>`;
  const conFotos = f1 && f2;
  const portada = `<div class="s">${cabecera('EL RANKING DEL LUNES')}
    <div style="position:absolute;left:64px;right:64px;top:170px"><p style="margin:0;font:800 84px/1 Montserrat;letter-spacing:-.02em">Así está<br><span class="lima">el top 10</span></p>
    <p style="margin:16px 0 0;font-size:32px" class="gris">Semana del ${fecha}</p></div>
    <div style="position:absolute;left:64px;right:64px;top:440px;display:flex;gap:24px">${conFotos ? mitad(f1, 'ATP', atp[0]) + mitad(f2, 'WTA', wta[0]) : tipo('ATP', atp[0]) + tipo('WTA', wta[0])}</div>
    ${pie('DESLIZÁ →', '1/3')}</div>`;
  const flecha = (j) => j.cambio > 0 ? `<span class="lima">▲ ${j.cambio}</span>` : j.cambio < 0 ? `<span style="color:#FF6B6B">▼ ${-j.cambio}</span>`
    : j.mov === 'up' ? '<span class="lima">▲</span>' : j.mov === 'down' ? '<span style="color:#FF6B6B">▼</span>' : '<span class="gris">=</span>';
  const caras = async (js) => { const f = []; for (const j of js) f.push(await fotoJugador(j.nombre)); return f.every(Boolean) ? f : null; };
  const [carasATP, carasWTA] = [await caras(atp), await caras(wta)];
  const tabla = (tour, js, n, fotos) => `<div class="s">${cabecera(`RANKING ${tour}`)}
    <div style="position:absolute;left:64px;right:64px;top:170px">${js.map((j, i) => `<div style="display:flex;align-items:center;height:100px;border-bottom:${i < 9 ? '2px solid #232C36' : '0'}">
      <span style="width:84px;font:700 56px RC" class="${i ? '' : 'lima'}">${j.ranking}</span>
      ${fotos ? `<span style="width:78px;height:78px;border-radius:50%;margin-right:22px;flex:none;background:#1B222A url('${fotos[i]}') ${focoJugador(j.nombre)}/cover"></span>` : ''}
      <span style="flex:1;font:800 40px Montserrat;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(j.nombre)} <small style="font:400 24px Inter" class="gris">${esc(pais(j.pais))}</small></span>
      <span style="width:150px;text-align:right;font:700 36px RC" class="gris">${esc(j.puntos?.toLocaleString('es-AR'))}</span>
      <span style="width:90px;text-align:right;font:700 34px RC">${flecha(j)}</span></div>`).join('')}</div>
    ${n === 3 ? CRED : ''}${pie('Puntos y movimiento de la semana', `${n}/3`)}</div>`;
  const placas = [portada, tabla('ATP', atp, 2, carasATP), tabla('WTA', wta, 3, carasWTA)];
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
const FILA = 'display:flex;gap:28px;align-items:flex-end';
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
  const credito = `<div style="position:absolute;left:64px;right:64px;bottom:100px;font-size:20px;color:#6B7785">Foto: ${esc(e.foto.autor || 'Wikimedia Commons')} · ${esc(e.foto.licencia || 'licencia libre')} · Wikimedia Commons</div>`;
  const portada = `<div class="s"><div style="position:absolute;inset:0;background:url('${foto.data}') ${esc(e.foto.foco || 'center 30%')}/cover"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(rgba(10,13,17,.6),rgba(10,13,17,0) 22%,rgba(10,13,17,0) 42%,rgba(10,13,17,.88) 66%,#0A0D11)"></div>
    ${cabecera('UN DÍA COMO HOY')}
    <div style="position:absolute;left:64px;right:64px;bottom:150px">
      <div style="${FILA}"><span style="font:700 170px/0.8 RC" class="lima">${anio}</span><span style="font-size:32px;padding-bottom:8px" class="gris">${fechaTxt}<br>hace ${hace} ${hace === 1 ? 'año' : 'años'}</span></div>
      <p style="margin:34px 0 0;font:800 64px/1.06 Montserrat;letter-spacing:-.02em">${esc(e.titulo)}</p></div>
    ${pie('DESLIZÁ →', '1/3')}</div>`;
  const historia = `<div class="s">${cabecera('LA HISTORIA')}
    <div style="position:absolute;left:64px;right:64px;top:200px">
      <div style="font:700 44px RC;letter-spacing:.02em" class="lima">${esc(fechaTxt.toUpperCase())}</div>
      ${e.historia.map((t, i) => `<p style="margin:${i ? 34 : 30}px 0 0;font:${i ? '400 40px/1.38 Inter' : '800 46px/1.22 Montserrat'};${i ? 'color:#D5DBE1' : ''}">${esc(t)}</p>`).join('')}
      ${e.marcador ? `<div style="margin-top:46px;display:inline-block;background:#1B222A;border-left:8px solid #C6F432;padding:22px 30px;border-radius:10px"><div style="font-size:24px" class="gris">${esc(e.marcadorTitulo || 'Marcador de la final')}</div><div style="font:700 56px RC;white-space:nowrap;margin-top:6px">${esc(e.marcador)}</div></div>` : ''}
    </div>${pie('DESLIZÁ →', '2/3')}</div>`;
  const numeros = `<div class="s">${cabecera('EN NÚMEROS')}
    <div style="position:absolute;left:64px;right:64px;top:210px">
      ${e.datos.slice(0, 3).map((d, i) => `<div style="padding:30px 0;${i ? 'border-top:2px solid #232C36' : ''}"><div style="font:700 150px/0.9 RC;letter-spacing:-.01em" class="lima">${esc(d.valor)}</div><div style="font:800 40px/1.2 Montserrat;margin-top:12px">${esc(d.texto)}</div></div>`).join('')}
    </div>${credito}${pie(`Fuente: ${esc(e.fuente || '')}`, '3/3')}</div>`;
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
    const datos = `<div style="font:800 28px Montserrat;letter-spacing:.06em" class="lima">${esc(f.etiqueta.toUpperCase())} · ${esc(f.torneo.toUpperCase())}</div>
      <div style="font:800 96px/1 Montserrat;letter-spacing:-.02em;margin:12px 0 18px">${esc(f.campeon)}</div>
      <div style="font-size:32px" class="gris">${/wta/.test(f.cat) ? 'Campeona' : 'Campeón'} · le ganó la final a ${esc(f.finalista)}</div>
      <div style="font:700 64px RC;margin-top:16px">${esc(f.marcador)}</div>`;
    placas.push(foto
      ? `<div class="s"><div style="position:absolute;inset:0 0 auto 0;height:900px;background:url('${foto}') ${focoJugador(f.campeon)}/cover"></div>
        <div style="position:absolute;inset:0 0 auto 0;height:900px;background:linear-gradient(rgba(18,22,27,.55),rgba(18,22,27,0) 25%,rgba(18,22,27,0) 55%,#12161B)"></div>
        ${cabecera('CAMPEONES DE LA SEMANA')}<div style="position:absolute;left:64px;right:64px;top:700px">${datos}</div>${k === n - 1 ? CRED : ''}
        ${pie(n > 1 && k < n - 1 ? 'DESLIZÁ →' : 'La nota completa, en el link de la bio', `${k + 1}/${n}`)}</div>`
      : `<div class="s">${cabecera('CAMPEONES DE LA SEMANA')}<div style="position:absolute;left:64px;right:64px;top:300px">
        <div style="font:700 200px/0.85 RC;letter-spacing:-.01em" class="lima">${/wta/.test(f.cat) ? 'CAMPEONA' : 'CAMPEÓN'}</div><div style="margin-top:60px">${datos}</div></div>
        ${pie(n > 1 && k < n - 1 ? 'DESLIZÁ →' : 'La nota completa, en el link de la bio', `${k + 1}/${n}`)}</div>`);
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
  const portada = `<div class="s">${cabecera('RESULTADOS DEL DÍA')}
    <div style="position:absolute;left:64px;right:64px;top:170px"><p style="margin:0;font:800 84px/1 Montserrat;letter-spacing:-.02em">Lo que pasó<br><span class="lima">hoy</span></p>
    <p style="margin:16px 0 0;font-size:32px" class="gris">${fechaHoy} · ${notas.length} partidos</p></div>
    <div style="position:absolute;left:64px;right:64px;top:400px">${notas.slice(0, 7).map((n, i) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0;${i ? 'border-top:2px solid #232C36' : ''}">
      <div style="min-width:0"><div style="font:800 20px Montserrat;letter-spacing:.06em" class="lima">${esc(String(n.torneo || n.categoria || '').toUpperCase())}</div>
      <div style="font:800 36px/1.15 Montserrat;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ape(n.resultado.ganador.nombre))} <span class="gris" style="font:400 30px Inter">le ganó a</span> ${esc(ape(n.resultado.perdedor.nombre))}</div></div>
      <div style="font:700 40px RC;white-space:nowrap">${esc(sets(n))}</div></div>`).join('')}${notas.length > 7 ? `<div style="padding-top:14px;font-size:28px" class="gris">y ${notas.length - 7} más en las placas siguientes</div>` : ''}</div>
    ${pie('DESLIZÁ →', `1/${total}`)}</div>`;
  const fila = (j, gano, n) => {
    const f = caras[j.nombre];
    const circulo = f ? `<span style="width:240px;height:240px;border-radius:50%;flex:none;background:#1B222A url('${f}') ${focoJugador(j.nombre)}/cover;${gano ? 'box-shadow:0 0 0 6px #C6F432' : 'filter:grayscale(.35)'}"></span>`
      : `<span style="width:240px;height:240px;border-radius:50%;flex:none;background:#1B222A;display:flex;align-items:center;justify-content:center;font:800 72px Montserrat" class="gris">${esc(iniciales(j.nombre))}</span>`;
    const celdas = n.resultado.sets.map((st) => { const [a, b] = gano ? st : [st[1], st[0]]; return `<span style="width:78px;text-align:center;font:700 76px RC;${a > b ? 'color:#C6F432' : 'color:#6B7785'}">${a}</span>`; }).join('');
    return `<div style="display:flex;align-items:center;gap:36px;padding:44px 0">${circulo}
      <div style="flex:1;min-width:0"><div style="font:800 54px/1.06 Montserrat;${gano ? '' : 'color:#AEB7C1'}">${esc(j.nombre)}</div><div style="font-size:28px;margin-top:8px" class="gris">${esc(String(j.pais || '').toUpperCase())}${j.ranking ? ` · N° ${j.ranking}` : ''}</div></div>
      <div style="display:flex">${celdas}</div></div>`;
  };
  const placas = [portada, ...notas.map((n, k) => `<div class="s">${cabecera(String(n.torneo || n.categoria || 'TENIS').toUpperCase())}
    <div style="position:absolute;left:64px;right:64px;top:250px">${fila(n.resultado.ganador, true, n)}<div style="height:2px;background:#232C36"></div>${fila(n.resultado.perdedor, false, n)}
    <div style="margin-top:40px;border-left:8px solid #C6F432;padding:6px 0 6px 30px"><p style="margin:0;font:400 42px/1.38 Inter;color:#E1E6EB;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden">${esc(n.bajada || '')}</p></div></div>
    ${k === notas.length - 1 ? CRED : ''}${pie(k < notas.length - 1 ? 'DESLIZÁ →' : 'Todas las notas, en el link de la bio', `${k + 2}/${total}`)}</div>`)];
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
  if (cola.some((c) => c.id === pieza.id)) continue;
  const archivos = pieza.placas.map((_, i) => path.join(ROOT, PRUEBA ? 'static/ig/prueba' : 'static/ig/series', `${pieza.id}-${i + 1}.jpg`));
  if (!(await dibujar(pieza.placas, archivos))) { log('Serie descartada por imágenes:', pieza.id); continue; }
  if (PRUEBA) { log('Prueba dibujada:', pieza.id); continue; }
  cola.push({ id: pieza.id, prioridad: pieza.prioridad, imagenes: archivos.map((a) => `${SITIO}/ig/series/${path.basename(a)}`), texto: pieza.texto, vence: pieza.vence, ...(pieza.claves ? { claves: pieza.claves } : {}), ...(pieza.tanda ? { tanda: pieza.tanda } : {}) });
  fs.writeFileSync(COLA, JSON.stringify(cola, null, 1) + '\n');
  if (pieza.estado) { Object.assign(ESTADO, pieza.estado); fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify(ESTADO, null, 1) + '\n'); }
  log('Serie lista para Instagram:', pieza.id);
}
