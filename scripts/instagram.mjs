// Instagram de A Todo Tenis (@atodotenis.web).
//   node scripts/instagram.mjs preparar  → elige la nota más importante sin publicar y arma su imagen (static/ig/<slug>.jpg)
//   node scripts/instagram.mjs publicar  → si hay una imagen preparada y ya está online, la publica con la API oficial de Instagram
// La publicación usa "Instagram API with Instagram Login" (no necesita página de Facebook).
// Secreto necesario en GitHub: INSTAGRAM_TOKEN (token de larga duración de la cuenta).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, log, conGrafia } from './lib/util.mjs';
import { gruposCerrados, recortesListos, htmlClasificados, textoClasificados } from './ig-clasificados.mjs';
import { fotoJugador, focoJugador, slug } from './lib/ig-render.mjs';
import { esATPFinals, tieneRecorte, datosFinals, htmlFinals } from './ig-finals.mjs';

const CONFIG = leerJSON('config.json', {});
const SITIO = (CONFIG.sitio?.url || 'https://atodotenis.vercel.app').replace(/\/$/, '');
const USUARIO = 'atodotenis_web';
const ESTADO = path.join(ROOT, 'data/instagram.json');
const DIR_IMG = path.join(ROOT, 'static/ig');
// Publicación por tandas: una sola publicación por tanda y como máximo 3 por día, para no saturar.
//   A 11 UTC (13 Israel · 12 Madrid · 08 Buenos Aires): resultados de la noche
//   B 16 UTC (18 Israel · 17 Madrid · 13 Buenos Aires): pieza fija (ranking, campeones, efeméride, carruseles)
//   C 23 UTC (01 Israel · 00 Madrid · 20 Buenos Aires): resultados del día
const TANDAS = [{ id: 'A', h: 11 }, { id: 'B', h: 16 }, { id: 'C', h: 23 }];
const VENTANA_H = 2;            // cada tanda queda abierta 2 horas
const MAX_POR_DIA = 4;           // en días de Finals: resultado + clasificados del grupo
const HORAS_VIGENCIA = 24;      // un resultado más viejo que esto ya no se publica
const FORZAR = process.env.IG_FORZAR === '1';
function tandaActual(d = new Date()) {
  for (const t of TANDAS) {
    const ini = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), t.h));
    for (const base of [ini, new Date(ini.getTime() - 864e5)]) {
      if (d >= base && d - base < VENTANA_H * 3600e3) return { id: t.id, clave: `${base.toISOString().slice(0, 10)}-${t.id}` };
    }
  }
  return null;
}
// ¿Se puede publicar ahora? Devuelve la clave de la tanda o null (con el motivo en el log).
function turno(e, inmediato = false) {
  if (FORZAR) return 'manual';
  if (inmediato) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (e.publicadas.some((p) => p.slug === e.pendiente?.slug)) { log('La nota ya figura publicada:', e.pendiente.slug); return null; }
    if (e.publicadas.filter((p) => !p.cubierta && !p.borrada && p.fecha.slice(0, 10) === hoy).length >= MAX_POR_DIA) { log('Ya hay', MAX_POR_DIA, 'publicaciones hoy.'); return null; }
    return `resultado-${e.pendiente.slug}`;
  }
  const t = tandaActual();
  if (!t) { log('Fuera de tanda: se publica en la próxima (13, 18 o 01 h de Israel).'); return null; }
  if (e.publicadas.some((p) => p.tanda === t.clave)) { log('La tanda', t.clave, 'ya tiene su publicación.'); return null; }
  const hoy = new Date().toISOString().slice(0, 10);
  if (e.publicadas.filter((p) => !p.cubierta && !p.borrada && p.fecha.slice(0, 10) === hoy).length >= MAX_POR_DIA) { log('Ya hay', MAX_POR_DIA, 'publicaciones hoy.'); return null; }
  return t.clave;
}
const HORAS_NOTA = 30;          // solo notas recientes
// Token de Instagram (IGAA…) → graph.instagram.com; token de usuario del sistema de Meta (EAA…) → graph.facebook.com
const TOKEN = (process.env.INSTAGRAM_TOKEN || '').trim();
const API = TOKEN.startsWith('EAA') ? 'https://graph.facebook.com/v25.0' : 'https://graph.instagram.com/v25.0';
const IG_ID = process.env.INSTAGRAM_ID || '17841445997391293'; // cuenta @atodotenis_web

const leerEstado = () => { try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return { publicadas: [], pendiente: null }; } };
const guardarEstado = (e) => fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2) + '\n');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const apellido = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0];

function notas() {
  const dir = path.join(ROOT, 'content/notas');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((n) => n.estado === 'publicada');
}

// Hasta 5 hashtags: el evento, tenis en español e inglés, el circuito y los protagonistas.
function hashtags(n) {
  const cat = `${n.categoria || ''} ${n.torneo || ''}`;
  const t = [];
  if (/Finals/i.test(cat)) t.push(/WTA/i.test(cat) ? '#WTAFinals' : '#ATPFinals');
  else if (/Grand Slam|Australian Open|Roland|Wimbledon|US Open/i.test(cat)) t.push('#' + (n.torneo || '').replace(/[^A-Za-z]/g, ''));
  t.push('#tenis', '#tennis');
  if (t.length < 3) t.push(/WTA/i.test(cat) ? '#WTA' : '#ATP');
  for (const j of n.jugadores || []) t.push('#' + apellido(j).normalize('NFD').replace(/[^A-Za-z]/g, ''));
  return [...new Set(t)].filter((x) => x.length > 2).slice(0, 5).join(' ');
}

// Foto de la nota (Wikimedia Commons, licencia libre): solo si es buena y grande
const fotoNota = (n) => (n.imagen?.url && (n.imagen.ancho || 0) >= 1200 ? n.imagen : null);

function textoPublicacion(n) {
  const r = n.resultado || {};
  const ganador = r.ganador?.nombre || '';
  const perdedor = r.perdedor?.nombre || '';
  const marcador = (r.sets || []).map((set) => `${set[0]}-${set[1]}`).join(' · ');
  const ronda = String(r.ronda || '').toUpperCase();
  const pregunta = ronda === 'SF' && /Finals/i.test(`${n.torneo} ${n.categoria}`)
    ? '¿Quién se queda con el título?'
    : '¿Qué te pareció este resultado?';
  return [
    `${n.titulo}.`,
    marcador ? `Marcador: ${marcador}.` : n.bajada,
    pregunta,
    'Más información en atodotenis.vercel.app.',
    hashtags(n),
  ].filter(Boolean).join('\n\n');
}

function creditoJugador(nombre) {
  const slugJ = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const elegida = leerJSON('scripts/ig-fotos.json', {})[slugJ];
  const av = leerJSON('data/avatares.json', {})[nombre] || {};
  const autor = elegida?.autor || av.autor;
  const lic = elegida?.licencia || av.licencia;
  return autor ? `${autor} / ${lic || 'CC'}` : 'Wikimedia Commons';
}

function titularResultado(n) {
  const ronda = String(n.resultado?.ronda || '').toUpperCase();
  if (ronda === 'SF') return 'A LA FINAL';
  if (ronda === 'F') return 'CAMPEÓN';
  if (ronda === 'QF') return 'A SEMIS';
  // Sin adjetivos: el titular describe el partido con datos del marcador
  const sets = n.resultado?.sets || [];
  if (sets[0] && sets[0][1] > sets[0][0]) return 'REMONTADA';
  return sets.length >= 3 ? 'EN 3 SETS' : 'EN 2 SETS';
}

function temaTorneo(nombre, esWTA) {
  const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const temas = [
    [/wta finals/, { fondo:'#17072D', panel:'#2A1048', primario:'#8B45D6', brillo:'#C17BFF', acento:'#D9FF42' }],
    [/atp finals|nitto/, { fondo:'#06152E', panel:'#10294B', primario:'#087BFF', brillo:'#39B9FF', acento:'#D9FF42' }],
    [/indian wells/, { fondo:'#24103B', panel:'#3B1D5A', primario:'#8F4BCB', brillo:'#F4A14D', acento:'#D9FF42' }],
    [/roland garros|french open/, { fondo:'#291009', panel:'#4A2117', primario:'#D9572B', brillo:'#FF9C53', acento:'#F8E4BD' }],
    [/wimbledon/, { fondo:'#071F18', panel:'#123D2B', primario:'#6C3D91', brillo:'#B58BDB', acento:'#E1EBAA' }],
    [/us open/, { fondo:'#07152D', panel:'#142A4A', primario:'#D9364B', brillo:'#FF7180', acento:'#F4D36B' }],
    [/australian open/, { fondo:'#061A43', panel:'#0B3470', primario:'#009DD8', brillo:'#4DEBFF', acento:'#D9FF42' }],
    [/miami open/, { fondo:'#062B35', panel:'#07505B', primario:'#00AFA5', brillo:'#FF7A78', acento:'#F8E36A' }]
  ];
  const match = temas.find(([rx]) => rx.test(t));
  if (match) return match[1];
  return esWTA ? { fondo:'#17072D', panel:'#2A1048', primario:'#8B45D6', brillo:'#C17BFF', acento:'#D9FF42' }
    : { fondo:'#06152E', panel:'#10294B', primario:'#087BFF', brillo:'#39B9FF', acento:'#D9FF42' };
}

function html(n, fotos) {
  const r = n.resultado || {};
  const sets = Array.isArray(r.sets) ? r.sets : [];
  const ganador = r.ganador?.nombre || '';
  const perdedor = r.perdedor?.nombre || '';
  const esWTA = /WTA/i.test(`${n.categoria || ''} ${n.torneo || ''}`);
  const evento = n.torneo || n.categoria || 'TENIS';
  const tema = temaTorneo(evento, esWTA);
  const credito = `Foto: ${creditoJugador(ganador)}`;
  const filas = sets.map((set) => `<span>${esc(set[0])}-${esc(set[1])}</span>`).join('');
  const titulo = titularResultado(n);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(file://${path.join(ROOT, 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:800;src:url(file://${path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:900;font-style:italic;src:url(file://${path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:RC;font-weight:700;src:url(file://${path.join(ROOT, 'node_modules/@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2')})}
*{box-sizing:border-box}body{margin:0}
#p{width:1080px;height:1350px;position:relative;overflow:hidden;background:${tema.fondo};color:#fff;font-family:Inter}
.hero{position:absolute;inset:0 0 auto;height:940px;background-image:linear-gradient(180deg,rgba(4,7,18,.15) 0%,rgba(4,7,18,.02) 38%,${tema.fondo} 100%),linear-gradient(115deg,${tema.primario}44,transparent 52%),url('${fotos.ganador}');background-size:cover;background-position:${esc(focoJugador(ganador))};}
.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,${tema.fondo}66 0%,transparent 60%);mix-blend-mode:multiply}.hero:after{content:'';position:absolute;right:-160px;top:210px;width:440px;height:440px;border:28px solid ${tema.primario}88;border-radius:50%;box-shadow:0 0 0 24px ${tema.brillo}22,0 0 70px ${tema.primario}66}
.brand{position:absolute;top:52px;left:58px;right:58px;display:flex;justify-content:space-between;align-items:center;z-index:5;font:900 italic 38px Montserrat;text-shadow:0 2px 14px #000}
.brand b{color:${tema.acento}}.event{font:800 24px Montserrat;letter-spacing:.08em;background:${tema.primario};color:#fff;padding:12px 18px;border-radius:8px;box-shadow:0 0 28px ${tema.brillo}88}
.heroTitle{position:absolute;z-index:4;left:58px;right:320px;bottom:145px;font:900 italic ${Math.min(112, Math.floor(1000 / Math.max(1, titulo.length)))}px/.88 Montserrat;letter-spacing:-.055em;text-shadow:0 5px 30px rgba(0,0,0,.82);max-width:900px}
.heroTitle span{display:block;color:${tema.acento};font-size:48px;letter-spacing:.08em;margin-top:20px}
.winner{position:absolute;z-index:4;left:58px;right:300px;bottom:48px;font:900 44px Montserrat;text-shadow:0 3px 22px #000;color:${tema.acento}}\n.opponent{position:absolute;z-index:5;right:62px;top:540px;width:220px;height:280px;border:5px solid ${tema.acento};border-radius:14px;background-size:cover;background-position:center 18%;box-shadow:0 10px 30px #000b}.bottom{position:absolute;left:0;right:0;bottom:0;height:430px;background:linear-gradient(180deg,${tema.panel},${tema.fondo});padding:34px 62px 28px;border-top:5px solid ${tema.primario}}
.eyebrow{font:800 24px Montserrat;letter-spacing:.12em;color:${tema.acento};text-align:center}
.score{display:flex;align-items:center;justify-content:center;gap:16px;margin:22px 0 20px;font:700 68px RC}
.score span{background:#ffffff12;border:1px solid ${tema.brillo}88;border-radius:12px;padding:8px 20px;min-width:112px;text-align:center}
.score span:first-child{background:${tema.acento};color:#10131a;border-color:${tema.acento}}
.story{font:800 34px/1.12 Montserrat;text-align:center;max-width:920px;margin:0 auto;color:#f5f7fa}.story b{color:${tema.acento}}
.question{margin-top:18px;text-align:center;font-size:24px;color:#d4dce8}
.credit{position:absolute;left:62px;right:62px;bottom:12px;text-align:center;font-size:13px;color:#9AA5B1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body><div id="p">
<div class="hero">
 <div class="brand"><span class="event">${esc(evento.toUpperCase())}</span><span>A Todo <b>Tenis</b></span></div>
 <div class="heroTitle">${esc(titulo)}<span>${esc(esWTA ? 'WTA · TENIS FEMENINO' : 'ATP · TENIS MASCULINO')}</span></div>
 <div class="winner">${esc(ganador)}</div>
</div>
${fotos.perdedor ? `<div class="opponent" style="background-image:url('${fotos.perdedor}')"></div>` : ''}
<div class="bottom">
 <div class="eyebrow">MARCADOR FINAL</div>
 <div class="score">${filas}</div>
 <div class="story">${esc(ganador)} <b>se impuso</b> ante ${esc(perdedor)}</div>
 <div class="question">¿Qué te pareció su actuación?</div>
 <div class="credit">${esc(credito)} · A Todo Tenis</div>
</div>
</div></body></html>`;
}

async function preparar() {
  const e = leerEstado();
  if (e.pendiente) { log('Ya hay una publicación preparada:', e.pendiente.slug); return; }
  const hecho = new Set(e.publicadas.map((p) => p.slug));
  const limite = Date.now() - HORAS_NOTA * 3600e3;
  const cand = notas().filter((n) => !hecho.has(n.slug) && new Date(n.fecha).getTime() > limite &&
      n.resultado?.ganador?.nombre && n.resultado?.perdedor?.nombre && n.resultado?.sets?.length)
    .sort((a, b) => (b.importancia || 0) - (a.importancia || 0) || new Date(b.fecha) - new Date(a.fecha));
  if (!cand.length) { log('Sin resultados nuevos con datos completos para Instagram.'); return; }
  const n = { ...cand[0] };
  const ganador = n.resultado.ganador.nombre, perdedor = n.resultado.perdedor.nombre;
  // ATP Finals: placa estilo estadio (aprobada), con el ganador recortado.
  if (esATPFinals(n) && tieneRecorte(ganador)) {
    const { chromium } = await import('playwright-core');
    const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
    try {
      const p = await navegador.newPage({ viewport: { width: 1080, height: 1080 } });
      const tmp = path.join(ROOT, 'node_modules', '.ig-finals.html');
      fs.writeFileSync(tmp, htmlFinals(datosFinals(n)));
      await p.goto('file://' + tmp, { waitUntil: 'networkidle', timeout: 60000 });
      await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
      const ok = await p.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 50));
      if (!ok) { log('Se descarta la placa de Finals: una imagen no cargó.'); return; }
      fs.mkdirSync(DIR_IMG, { recursive: true });
      await p.locator('#p').screenshot({ path: path.join(DIR_IMG, `${n.slug}.jpg`), type: 'jpeg', quality: 94 });
    } finally { await navegador.close(); }
    e.pendiente = { slug: n.slug, imagen: `${SITIO}/ig/${n.slug}.jpg`, texto: conGrafia(textoPublicacion(n)), preparada: new Date().toISOString() };
    guardarEstado(e);
    log('Preparada para Instagram (formato ATP Finals):', n.titulo);
    return;
  }
  // La imagen principal debe ser una foto editorial seleccionada del ganador. No usar una imagen aleatoria ni una foto del rival como sustituto.
  const fotosEditoriales = leerJSON('scripts/ig-fotos.json', {});
  const claveFoto = slug(ganador);
  if (!fotosEditoriales[claveFoto]?.url) { log('Se posterga Instagram: falta una foto editorial seleccionada del ganador:', ganador); return; }
  const fotoG = await fotoJugador(ganador, 1280);
  const fotoP = await fotoJugador(perdedor, 500);
  const archivoFoto = path.join(ROOT, 'static/ig/fotos', `${claveFoto}-1280.jpg`);
  if (!fotoG || !fs.existsSync(archivoFoto) || fs.statSync(archivoFoto).size < 20000) { log('Se posterga Instagram: la foto del ganador no supera el control de calidad:', ganador); return; }
  const { chromium } = await import('playwright-core');
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  try {
    const p = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
    const tmp = path.join(ROOT, 'node_modules', '.ig-tarjeta.html');
    fs.writeFileSync(tmp, html(n, { ganador: fotoG, perdedor: fotoP }));
    await p.goto('file://' + tmp, { waitUntil: 'networkidle', timeout: 60000 });
    await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
    const rotas = await p.evaluate(async () => {
      const u = getComputedStyle(document.querySelector('.hero')).backgroundImage;
      const match = u.match(/url\(["']?(.*?)["']?\)/);
      if (!match) return 1;
      return await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth >= 1000 ? 0 : 1); i.onerror = () => ok(1); i.src = match[1]; });
    });
    if (rotas) { log('Se descarta la placa: una de las fotos no se pudo cargar.'); return; }
    fs.mkdirSync(DIR_IMG, { recursive: true });
    await p.locator('#p').screenshot({ path: path.join(DIR_IMG, `${n.slug}.jpg`), type: 'jpeg', quality: 95 });
  } finally { await navegador.close(); }
  e.pendiente = { slug: n.slug, imagen: `${SITIO}/ig/${n.slug}.jpg`, texto: conGrafia(textoPublicacion(n)), preparada: new Date().toISOString() };
  guardarEstado(e);
  log('Preparada para Instagram con el ganador como protagonista:', n.titulo);
}

async function api(ruta, opciones = {}) {
  const r = await fetch(`${API}/${ruta}`, { ...opciones, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) }, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

// Antes de publicar: revisar lo que ya está en la cuenta (también lo subido a mano) para no duplicar.
const normTxt = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const apellidoDe = (nombre) => normTxt(String(nombre).trim().split(/\s+/).slice(-1)[0]);
let recientesCache = null;
async function recientes(horas = 48) {
  if (!recientesCache) {
    const m = await api(`${IG_ID}/media?fields=id,caption,timestamp&limit=30`).catch(() => ({ data: [] }));
    recientesCache = m.data || [];
  }
  const limite = Date.now() - horas * 3600e3;
  return recientesCache.filter((x) => new Date(x.timestamp).getTime() > limite);
}
async function yaEstaEnLaCuenta({ apellidos = [], claves = [], texto = '', propios = new Set(), desde = null }) {
  for (const x of await recientes()) {
    if (propios.has(x.id)) continue;
    // solo cuenta lo subido después de que empezó el partido (una tabla del grupo con los dos nombres no es el resultado)
    if (desde && new Date(x.timestamp).getTime() < new Date(desde).getTime()) continue;
    const cap = normTxt(x.caption);
    if (apellidos.length && apellidos.every((a) => cap.includes(apellidoDe(a)))) return x;
    if (claves.length && claves.every((k) => cap.includes(normTxt(k)))) return x;
    if (texto) {
      const palabras = [...new Set(normTxt(texto).split('\n').slice(0, 3).join(' ').match(/[a-z0-9]{5,}/g) || [])];
      if (palabras.length >= 4 && palabras.filter((w) => cap.includes(w)).length / palabras.length >= 0.6) return x;
    }
  }
  return null;
}

async function publicar(inmediato = false) {
  const e = leerEstado();
  if (!e.pendiente) { log('Nada para publicar en Instagram.'); return; }
  if (!process.env.INSTAGRAM_TOKEN) { log('Falta el secreto INSTAGRAM_TOKEN: la publicación queda preparada.'); return; }
  const n = notas().find((x) => x.slug === e.pendiente.slug);
  if (n && Date.now() - new Date(n.fecha).getTime() > HORAS_VIGENCIA * 3600e3) { log('El resultado preparado ya es viejo, se descarta:', e.pendiente.slug); e.publicadas.push({ slug: e.pendiente.slug, cubierta: 'vencida', fecha: new Date().toISOString() }); e.pendiente = null; guardarEstado(e); return; }
  const tanda = turno(e, inmediato);
  if (!tanda) return;
  if (n?.resultado?.ganador?.nombre && n?.resultado?.perdedor?.nombre) {
    const propios = new Set(e.publicadas.map((p) => p.id).filter(Boolean));
    const dup = await yaEstaEnLaCuenta({ apellidos: [n.resultado.ganador.nombre, n.resultado.perdedor.nombre], propios, desde: n.fechaPartido || null });
    if (dup) { log('Ya está en la cuenta (subido a mano), no se duplica:', e.pendiente.slug, dup.id); e.publicadas.push({ slug: e.pendiente.slug, cubierta: 'manual', id: dup.id, fecha: new Date().toISOString() }); e.pendiente = null; guardarEstado(e); return; }
  }
  // La imagen tiene que estar online (Vercel la publica después del commit)
  const online = await fetch(e.pendiente.imagen, { method: 'HEAD' }).then((r) => r.ok && /image/.test(r.headers.get('content-type') || '')).catch(() => false);
  if (!online) { log('La imagen todavía no está online; se publica en la próxima corrida.'); return; }
  const yo = await api(`${IG_ID}?fields=id,username`).then((x) => ({ user_id: x.id, username: x.username }));
  const contenedor = await api(`${yo.user_id}/media`, { method: 'POST', body: JSON.stringify({ image_url: e.pendiente.imagen, caption: e.pendiente.texto, alt_text: e.pendiente.texto.split('\n')[0] }) });
  for (let i = 0; i < 10; i++) {
    const s = await api(`${contenedor.id}?fields=status_code`);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la imagen');
    await new Promise((r) => setTimeout(r, 5000));
  }
  const pub = await api(`${yo.user_id}/media_publish`, { method: 'POST', body: JSON.stringify({ creation_id: contenedor.id }) });
  e.publicadas.push({ slug: e.pendiente.slug, id: pub.id, tanda, fecha: new Date().toISOString() });
  e.publicadas = e.publicadas.slice(-200);
  e.pendiente = null;
  guardarEstado(e);
  log(`Publicado en Instagram (@${yo.username}): ${pub.id}`);
}

// ATP Finals: cuando se cierra un grupo, placa "¡CLASIFICADOS!" con los dos que pasan a semifinales.
// Se prepara apenas el último partido del grupo queda confirmado y se publica después del resultado de ese partido.
const slugClas = (c) => `clasificados-atp-${c.grupo.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${new Date().getUTCFullYear()}`;
async function prepararClasificados() {
  const e = leerEstado();
  if (e.clasificados) return;
  for (const c of gruposCerrados()) {
    const slug = slugClas(c);
    if (e.publicadas.some((p) => p.slug === slug)) continue;
    if (Date.now() - new Date(c.ultimo).getTime() > 30 * 3600e3) continue; // grupo cerrado hace mucho
    if (!recortesListos(c)) { log('Clasificados: falta el recorte de algún jugador para', c.grupo); continue; }
    const { chromium } = await import('playwright-core');
    const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
    try {
      const p = await nav.newPage({ viewport: { width: 1080, height: 1080 } });
      const tmp = path.join(ROOT, 'node_modules', '.ig-clasificados.html');
      fs.writeFileSync(tmp, htmlClasificados(c));
      await p.goto('file://' + tmp, { waitUntil: 'networkidle', timeout: 60000 });
      await p.evaluate(async () => { await document.fonts.ready; });
      const ok = await p.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 50));
      if (!ok) { log('Clasificados: una imagen no cargó, se reintenta.'); return; }
      fs.mkdirSync(DIR_IMG, { recursive: true });
      await p.locator('#p').screenshot({ path: path.join(DIR_IMG, `${slug}.jpg`), type: 'jpeg', quality: 94 });
    } finally { await nav.close(); }
    e.clasificados = { slug, imagen: `${SITIO}/ig/${slug}.jpg`, texto: textoClasificados(c), apellidos: c.clasificados.map((x) => x.nombre), preparada: new Date().toISOString() };
    guardarEstado(e);
    log('Placa de clasificados preparada:', slug);
    return;
  }
}
async function publicarClasificados() {
  const e = leerEstado();
  const c = e.clasificados;
  if (!c || !TOKEN) return;
  if (e.pendiente) { log('Clasificados: primero sale el resultado del partido.'); return; }
  const hoy = new Date().toISOString().slice(0, 10);
  if (e.publicadas.filter((p) => !p.cubierta && !p.borrada && p.fecha.slice(0, 10) === hoy).length >= MAX_POR_DIA) { log('Clasificados: ya hay', MAX_POR_DIA, 'publicaciones hoy.'); return; }
  const dup = await yaEstaEnLaCuenta({ claves: ['clasificad', 'mcenroe'], texto: c.texto, propios: new Set(e.publicadas.map((p) => p.id).filter(Boolean)) });
  if (dup) { log('Clasificados: ya está en la cuenta (subido a mano), no se duplica.', dup.id); e.publicadas.push({ slug: c.slug, cubierta: 'manual', id: dup.id, fecha: new Date().toISOString() }); e.clasificados = null; guardarEstado(e); return; }
  const online = await fetch(c.imagen, { method: 'HEAD' }).then((r) => r.ok && /image/.test(r.headers.get('content-type') || '')).catch(() => false);
  if (!online) { log('Clasificados: la imagen todavía no está online; se publica en la próxima corrida.'); return; }
  const yo = await api(`${IG_ID}?fields=id,username`);
  const cont = await api(`${yo.id}/media`, { method: 'POST', body: JSON.stringify({ image_url: c.imagen, caption: c.texto, alt_text: c.texto.split('\n')[0] }) });
  for (let i = 0; i < 10; i++) { const s = await api(`${cont.id}?fields=status_code`); if (s.status_code === 'FINISHED') break; if (s.status_code === 'ERROR') throw new Error('Instagram no pudo procesar la imagen'); await new Promise((r) => setTimeout(r, 5000)); }
  const pub = await api(`${yo.id}/media_publish`, { method: 'POST', body: JSON.stringify({ creation_id: cont.id }) });
  e.publicadas.push({ slug: c.slug, id: pub.id, tanda: c.slug, fecha: new Date().toISOString() });
  e.clasificados = null; guardarEstado(e);
  log('Clasificados publicados en Instagram:', pub.id);
}

// Carruseles armados a mano (data/ig-carruseles.json): se publican una sola vez cada uno
async function carruseles() {
  if (!TOKEN) { log('Falta INSTAGRAM_TOKEN.'); return; }
  const archivo = path.join(ROOT, 'data/ig-carruseles.json');
  // Orden de salida: lo más importante primero (ranking 1, carruseles especiales 2, campeones 3, efeméride 4)
  const cola = JSON.parse(fs.readFileSync(archivo, 'utf8')).sort((a, b) => (a.prioridad ?? 2) - (b.prioridad ?? 2));
  const e = leerEstado();
  const yo = await api(`${IG_ID}?fields=id,username`);
  log('Cuenta:', yo.username);
  const vivas = new Set(((await api(`${yo.id}/media?fields=id&limit=50`)).data || []).map((m) => m.id));
  for (const c of cola) {
    if (e.publicadas.some((p) => p.slug === c.id)) continue;
    if (c.vence && Date.now() > new Date(c.vence).getTime()) continue;
    const tanda = turno(e);
    if (!tanda) return;
    if (c.vence && Date.now() > new Date(c.vence).getTime()) { log('Vencido, no se publica:', c.id); continue; }
    const dup = c.forzar ? null : await yaEstaEnLaCuenta({ claves: c.claves || [], texto: c.texto, propios: new Set(e.publicadas.map((p) => p.id).filter(Boolean)) });
    if (dup) { log('Ya está en la cuenta (subido a mano), no se duplica:', c.id, dup.id); e.publicadas.push({ slug: c.id, cubierta: 'manual', id: dup.id, tipo: 'carrusel', fecha: new Date().toISOString() }); guardarEstado(e); continue; }
    const pendientes = (c.reemplaza || []).filter((id) => vivas.has(id));
    if (pendientes.length) { log('Espera a que se borre la versión anterior:', c.id, pendientes.join(',')); continue; }
    // Ninguna imagen puede faltar: si una no responde como JPEG válido, no se publica nada.
    const malas = [];
    for (const url of c.imagenes) {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      const b = r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
      if (!b || !/image\/jpeg/.test(r.headers.get('content-type') || '') || b.length < 20000 || b[0] !== 0xff || b[1] !== 0xd8) malas.push(url);
    }
    if (malas.length) { log('Imágenes que no cargan, no se publica:', c.id, malas.join(' ')); continue; }
    let cont;
    if (c.imagenes.length === 1) {
      cont = await api(`${yo.id}/media`, { method: 'POST', body: JSON.stringify({ image_url: c.imagenes[0], caption: c.texto }) });
    } else {
      const hijos = [];
      for (const url of c.imagenes) hijos.push((await api(`${yo.id}/media`, { method: 'POST', body: JSON.stringify({ image_url: url, is_carousel_item: true }) })).id);
      cont = await api(`${yo.id}/media`, { method: 'POST', body: JSON.stringify({ media_type: 'CAROUSEL', children: hijos.join(','), caption: c.texto }) });
    }
    for (let i = 0; i < 12; i++) { const s = await api(`${cont.id}?fields=status_code`); if (s.status_code === 'FINISHED') break; if (s.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el carrusel'); await new Promise((r) => setTimeout(r, 5000)); }
    const pub = await api(`${yo.id}/media_publish`, { method: 'POST', body: JSON.stringify({ creation_id: cont.id }) });
    e.publicadas.push({ slug: c.id, id: pub.id, tipo: 'carrusel', tanda, fecha: new Date().toISOString() });
    guardarEstado(e);
    log('Carrusel publicado:', c.id, pub.id);
    return; // una sola por tanda
  }
}

async function perfil() {
  const yo = await api(`${IG_ID}?fields=id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count`);
  log('PERFIL ' + JSON.stringify({ ...yo, profile_picture_url: yo.profile_picture_url ? 'sí' : 'no' }));
  const m = await api(`${IG_ID}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=10`);
  for (const x of m.data || []) log('PUB ' + JSON.stringify({ ...x, caption: (x.caption || '').slice(0, 80) }));
}

// Borra publicaciones por id (node scripts/instagram.mjs borrar id1,id2)
async function borrar(ids) {
  const e = leerEstado();
  for (const id of ids.split(',').filter(Boolean)) {
    try {
      await api(id, { method: 'DELETE' });
      log('BORRADA ' + id);
      for (const p of e.publicadas) if (p.id === id) p.borrada = new Date().toISOString();
    } catch (err) { log('NO SE PUDO BORRAR ' + id + ': ' + err.message); }
  }
  guardarEstado(e);
}

// Salida de cada corrida: en la tanda B va primero la pieza fija; en A y C, el resultado.
async function salida() {
  const t = tandaActual();
  if (t?.id === 'B') { await carruseles().catch((x) => log('Carruseles:', x.message)); await publicar(true); }
  else { await publicar(true); await carruseles().catch((x) => log('Carruseles:', x.message)); }
  await publicarClasificados().catch((x) => log('Clasificados:', x.message));
}

const modo = process.argv[2];
// Pausa manual: mientras rija, el robot no prepara ni publica nada (Jonathan publica a mano).
if (!['perfil', 'borrar'].includes(modo) && CONFIG.instagram?.manualHasta && new Date(CONFIG.instagram.manualHasta) > new Date()) {
  log(`Instagram en modo manual hasta ${CONFIG.instagram.manualHasta}: no se prepara ni publica nada.`);
  process.exit(0);
}
(modo === 'salida' ? salida() : modo === 'publicar' ? publicar() : modo === 'carruseles' ? carruseles() : modo === 'perfil' ? perfil() : modo === 'borrar' ? borrar(process.argv[3] || '') : preparar().then(() => prepararClasificados().catch((x) => log('Clasificados:', x.message)))).catch((err) => { log('Instagram:', err.message); process.exit(0); });
