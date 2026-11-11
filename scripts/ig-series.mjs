// Series fijas de Instagram. Cada corrida revisa si toca alguna; si toca, dibuja las placas
// y las deja en data/ig-carruseles.json para que `instagram.mjs carruseles` las publique cuando estén online.
//   Lunes 16 UTC    → El ranking del lunes (ATP y WTA)
//   Todos los días  → Un día como hoy (solo si hay efeméride para la fecha), 15 UTC
//   Domingo 21 UTC  → Campeones de la semana
//   node scripts/ig-series.mjs [ranking|efemeride|campeones]  → fuerza una serie (pruebas)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './lib/util.mjs';
import { esc, fotoJugador, focoJugador, cabecera, pie, dibujar } from './lib/ig-render.mjs';

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
  const fecha = `${ahora.getUTCDate()} de ${MESES[ahora.getUTCMonth()]}`;
  const [f1, f2] = [await fotoJugador(atp[0].nombre), await fotoJugador(wta[0].nombre)];
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
  return { id: `ranking-${semanaISO(ahora)}`, placas, texto, vence: masDias(2) };
}

// ---------- Un día como hoy ----------
async function efemeride() {
  const items = leer('content/efemerides.json', {}).items || [];
  const mmdd = hoyISO.slice(5);
  const e = items.find((x) => x.fecha.slice(5) === mmdd && x.texto);
  if (!e) return null;
  const anio = e.fecha.slice(0, 4);
  const hace = ahora.getUTCFullYear() - Number(anio);
  const placa = `<div class="s">${cabecera('UN DÍA COMO HOY')}
    <div style="position:absolute;left:64px;right:64px;top:240px">
      <div style="font:700 300px/0.9 RC;letter-spacing:-.02em" class="lima">${anio}</div>
      <div style="font-size:34px;margin:18px 0 60px" class="gris">${Number(e.fecha.slice(8))} de ${MESES[Number(e.fecha.slice(5, 7)) - 1]} · hace ${hace} años</div>
      <p style="margin:0;font:800 58px/1.15 Montserrat;letter-spacing:-.01em">${esc(e.texto)}</p></div>
    ${pie('Efemérides del tenis', '@atodotenis_web')}</div>`;
  const nombres = (e.texto.match(/[A-ZÁÉÍÓÚ][a-záéíóúñ]+ [A-ZÁÉÍÓÚ][a-záéíóúñ]+/g) || []).slice(0, 2);
  const texto = [`Un día como hoy, hace ${hace} años.`, e.texto, '¿Lo viste en vivo?', ['#tenis', '#tennis', '#undiacomohoy', ...nombres.map(tag)].slice(0, 5).join(' ')].join('\n\n');
  return { id: `efemeride-${hoyISO}`, placas: [placa], texto, vence: `${hoyISO}T23:59:00Z` };
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
  const fotosC = []; for (const f of elegidos) fotosC.push(await fotoJugador(f.campeon));
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
  return { id: `campeones-${semanaISO(ahora)}`, placas, texto, vence: masDias(1) };
}

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
const SERIES = { ranking, efemeride, campeones, fotos };
function tocan() {
  const h = ahora.getUTCHours(), d = ahora.getUTCDay();
  const r = [];
  if (h >= 15) r.push('efemeride');
  if (d === 1 && h >= 16) r.push('ranking');
  if (d === 0 && h >= 21) r.push('campeones');
  return r;
}

const cola = leer('data/ig-carruseles.json', []);
const forzada = process.argv[2];
const PRUEBA = process.argv[3] === 'prueba'; // dibuja en static/ig/prueba y no lo manda a la cola
for (const nombre of forzada ? [forzada] : tocan()) {
  const pieza = await SERIES[nombre]?.();
  if (!pieza) continue;
  if (cola.some((c) => c.id === pieza.id)) continue;
  const archivos = pieza.placas.map((_, i) => path.join(ROOT, PRUEBA ? 'static/ig/prueba' : 'static/ig/series', `${pieza.id}-${i + 1}.jpg`));
  if (!(await dibujar(pieza.placas, archivos))) { log('Serie descartada por imágenes:', pieza.id); continue; }
  if (PRUEBA) { log('Prueba dibujada:', pieza.id); continue; }
  cola.push({ id: pieza.id, imagenes: archivos.map((a) => `${SITIO}/ig/series/${path.basename(a)}`), texto: pieza.texto, vence: pieza.vence });
  fs.writeFileSync(COLA, JSON.stringify(cola, null, 1) + '\n');
  log('Serie lista para Instagram:', pieza.id);
}
