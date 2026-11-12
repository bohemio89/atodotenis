// Instagram de A Todo Tenis (@atodotenis.web).
//   node scripts/instagram.mjs preparar  → elige la nota más importante sin publicar y arma su imagen (static/ig/<slug>.jpg)
//   node scripts/instagram.mjs publicar  → si hay una imagen preparada y ya está online, la publica con la API oficial de Instagram
// La publicación usa "Instagram API with Instagram Login" (no necesita página de Facebook).
// Secreto necesario en GitHub: INSTAGRAM_TOKEN (token de larga duración de la cuenta).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, leerJSON, log } from './lib/util.mjs';
import { fotoJugador, focoJugador } from './lib/ig-render.mjs';

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
const MAX_POR_DIA = 3;
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
function turno(e) {
  if (FORZAR) return 'manual';
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
  const partes = [n.titulo, n.bajada];
  if (n.declaracion?.texto) partes.push(`${n.declaracion.jugador}: «${n.declaracion.texto}»`);
  partes.push('La nota completa, en el link de la bio.');
  // El crédito de la foto va impreso en la imagen; el texto queda limpio.
  partes.push(hashtags(n));
  return partes.join('\n\n');
}

function html(n) {
  const fuentes = (p) => `file://${path.join(ROOT, 'node_modules/@fontsource', p)}`;
  const r = n.resultado || {};
  const sets = Array.isArray(r.sets) ? r.sets : [];
  const fila = (nombre, idx, gana) => `<div class="fila${gana ? '' : ' pierde'}"><span>${esc(apellido(nombre))}</span>${sets.map((s) => `<b>${esc(s[idx])}</b>`).join('')}</div>`;
  const frase = n.declaracion?.texto && n.declaracion.texto.length < (fotoNota(n) ? 120 : 150)
    ? `<p class="cita">«${esc(n.declaracion.texto)}»<br><span>— ${esc(n.declaracion.jugador)}</span></p>`
    : `<p class="bajada">${esc(n.bajada)}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:400;src:url(${fuentes('inter/files/inter-latin-400-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:800;src:url(${fuentes('montserrat/files/montserrat-latin-800-normal.woff2')})}
@font-face{font-family:Montserrat;font-weight:900;font-style:italic;src:url(${fuentes('montserrat/files/montserrat-latin-900-italic.woff2')})}
@font-face{font-family:RC;font-weight:700;src:url(${fuentes('roboto-condensed/files/roboto-condensed-latin-700-normal.woff2')})}
body{margin:0}
#p{width:1080px;height:1350px;background:#12161B;color:#F2F4F5;font-family:Inter;position:relative;overflow:hidden}
.foto{position:absolute;inset:0 0 auto 0;height:760px;background-size:cover;background-position:center 22%}
.foto::after{content:'';position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(rgba(18,22,27,0),#12161B)}
.credito{position:absolute;right:24px;top:716px;font-size:18px;color:rgba(255,255,255,.75);z-index:2;max-width:700px;text-align:right}
.cancha{position:absolute;inset:0 0 auto 0;height:520px;background:${n.superficie === 'clay' ? '#A8502C' : n.superficie === 'grass' ? '#2F6B4A' : '#2B5C8A'}}
.chip{position:absolute;left:64px;top:56px;background:#C6F432;color:#12161B;font:800 30px Montserrat;padding:12px 20px;border-radius:10px;letter-spacing:.04em;text-transform:uppercase;max-width:620px}
.marca{position:absolute;right:64px;top:62px;font:italic 900 40px Montserrat;letter-spacing:-.02em}.marca b{color:#C6F432}
.cuerpo{position:absolute;left:64px;right:64px;top:560px}
.tit{font:800 30px Montserrat;color:#C6F432;letter-spacing:.06em}
.fila{display:flex;align-items:center;font:800 58px Montserrat;padding:12px 0;border-bottom:2px solid #2A3540}
.fila span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fila b{width:100px;text-align:center;font-family:RC;color:#C6F432}
.fila.pierde{color:#9AA5B1;border:0}.fila.pierde b{color:#9AA5B1}
.bajada,.cita{margin:26px 0 0;font-size:34px;line-height:1.35;color:#C9D1D9}
.cita{font-size:40px;color:#F2F4F5}.cita span{font-size:30px;color:#9AA5B1}
.pie{position:absolute;left:64px;right:64px;bottom:56px;display:flex;justify-content:space-between;font-size:30px;color:#9AA5B1}.pie b{font:800 30px Montserrat;color:#F2F4F5}
</style></head><body><div id="p">
${fotoNota(n) ? `<div class="foto" style="background-image:url('${esc(fotoNota(n).url)}');background-position:${esc(fotoNota(n).foco || 'center 20%')}"></div><div class="credito">Foto: ${esc(fotoNota(n).credito || 'Wikimedia Commons')}</div>` : `<div class="cancha"><svg width="1080" height="520"><g fill="none" stroke="#fff" stroke-width="5" opacity=".28"><path d="M160 520 350 200h380l190 320"/><path d="M235 420h610M540 420V200M290 310h500"/></g></svg></div>`}
<div class="chip">${esc(n.categoria || n.torneo || 'Tenis')}</div><div class="marca">A Todo <b>Tenis</b></div>
<div class="cuerpo" style="top:${fotoNota(n) ? 770 : 560}px">${sets.length && r.ganador ? `<div class="tit">RESULTADO</div>${fila(r.ganador.nombre, 0, true)}${fila(r.perdedor?.nombre, 1, false)}` : `<div class="fila" style="font-size:56px;white-space:normal;border:0">${esc(n.titulo)}</div>`}
${frase}</div>
<div class="pie"><span>La nota completa en el link de la bio</span><b>@${USUARIO}</b></div>
</div></body></html>`;
}

async function preparar() {
  const e = leerEstado();
  if (e.pendiente) { log('Ya hay una publicación preparada:', e.pendiente.slug); return; }
  const hecho = new Set(e.publicadas.map((p) => p.slug));
  const limite = Date.now() - HORAS_NOTA * 3600e3;
  const cand = notas().filter((n) => !hecho.has(n.slug) && new Date(n.fecha).getTime() > limite)
    .sort((a, b) => (b.importancia || 0) - (a.importancia || 0) || new Date(b.fecha) - new Date(a.fecha));
  if (!cand.length) { log('Sin notas nuevas para Instagram.'); return; }
  const n = { ...cand[0] };
  // La foto es SIEMPRE la del ganador, de la colección revisada (ig-fotos.json / avatares.json).
  // No se usa la foto que trae la nota: la búsqueda automática a veces encuentra a otra persona.
  // Si no hay foto del ganador, la placa sale con la cancha y no con un hueco.
  n.imagen = null;
  const ganador = (typeof n.resultado === 'object' && n.resultado?.ganador?.nombre) || n.jugadores?.[0];
  if (ganador) {
    const dato = await fotoJugador(ganador, 1280);
    if (dato) {
      const slugJ = ganador.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const elegida = leerJSON('scripts/ig-fotos.json', {})[slugJ];
      const av = leerJSON('data/avatares.json', {})[ganador] || {};
      const autor = elegida?.autor || av.autor;
      const lic = elegida?.licencia || av.licencia;
      n.imagen = { url: dato, ancho: 1280, foco: focoJugador(ganador), credito: autor ? `${autor} / ${lic || 'CC'}, Wikimedia Commons` : 'Wikimedia Commons' };
    } else log('Sin foto revisada de', ganador, '- va la cancha.');
  }
  const { chromium } = await import('playwright-core');
  const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
  const p = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
  const tmp = path.join(ROOT, 'node_modules', '.ig-tarjeta.html');
  const fotosRotas = () => p.evaluate(async () => {
    const urls = [...document.querySelectorAll('*')].map((x) => getComputedStyle(x).backgroundImage).filter((b) => b.startsWith('url(')).map((b) => b.slice(5, -2));
    const r = await Promise.all(urls.map((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0 ? 0 : 1); i.onerror = () => ok(1); i.src = u; })));
    return r.reduce((a, b) => a + b, 0);
  });
  const dibujar = async () => {
    fs.writeFileSync(tmp, html(n));
    await p.goto('file://' + tmp, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
    await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => null))); await document.fonts.ready; });
  };
  await dibujar();
  // Nunca una placa con la foto vacía: si no cargó, va la versión con la cancha.
  if (await fotosRotas()) { log('La foto no cargó en la placa, va la cancha.'); n.imagen = null; await dibujar(); }
  if (await fotosRotas()) { log('La placa tiene imágenes rotas, no se prepara.'); await navegador.close(); return; }
  fs.mkdirSync(DIR_IMG, { recursive: true });
  await p.locator('#p').screenshot({ path: path.join(DIR_IMG, `${n.slug}.jpg`), type: 'jpeg', quality: 92 });
  await navegador.close();
  e.pendiente = { slug: n.slug, imagen: `${SITIO}/ig/${n.slug}.jpg`, texto: textoPublicacion(n), preparada: new Date().toISOString() };
  guardarEstado(e);
  log('Preparada para Instagram:', n.titulo);
}

async function api(ruta, opciones = {}) {
  const r = await fetch(`${API}/${ruta}`, { ...opciones, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) }, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

async function publicar() {
  const e = leerEstado();
  if (!e.pendiente) { log('Nada para publicar en Instagram.'); return; }
  if (!process.env.INSTAGRAM_TOKEN) { log('Falta el secreto INSTAGRAM_TOKEN: la publicación queda preparada.'); return; }
  const n = notas().find((x) => x.slug === e.pendiente.slug);
  if (n && Date.now() - new Date(n.fecha).getTime() > HORAS_VIGENCIA * 3600e3) { log('El resultado preparado ya es viejo, se descarta:', e.pendiente.slug); e.publicadas.push({ slug: e.pendiente.slug, cubierta: 'vencida', fecha: new Date().toISOString() }); e.pendiente = null; guardarEstado(e); return; }
  const tanda = turno(e);
  if (!tanda) return;
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
  if (t?.id === 'B') { await carruseles().catch((x) => log('Carruseles:', x.message)); await publicar(); }
  else { await publicar(); await carruseles().catch((x) => log('Carruseles:', x.message)); }
}

const modo = process.argv[2];
(modo === 'salida' ? salida() : modo === 'publicar' ? publicar() : modo === 'carruseles' ? carruseles() : modo === 'perfil' ? perfil() : modo === 'borrar' ? borrar(process.argv[3] || '') : preparar()).catch((err) => { log('Instagram:', err.message); process.exit(0); });
