// Seguimiento en vivo de las ATP/WTA Finals.
// Mientras se juega un partido de las Finals, consulta la API cada pocos minutos (una sola consulta trae todos los
// partidos en vivo), escribe data/vivo.json en la rama "vivo" (no dispara publicaciones en Vercel) y el sitio lo lee
// directamente desde el navegador para mover el marcador. Cuando un partido termina, dispara la actualización
// completa para que el resultado y la nota salgan enseguida.
// Cuida el cupo diario gratuito de la API: se detiene si quedan pocas consultas.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { marcadoresESPN } from './espn.mjs';

const KEY = process.env.LIVE_TENNIS_API_KEY;
const BASE = 'https://api.livetennisapi.com/api/public/v1';
// El intervalo se calcula solo: reparte las consultas que quedan hasta el reinicio diario (22:00 UTC) entre los
// minutos de partidos de singles de Finals que faltan jugar antes de ese reinicio. Las Finals tienen prioridad total.
const CADA_FIJO = Number(process.env.VIVO_CADA_MIN || 0);      // si se fija a mano (minutos), se respeta
const CADA_MIN_MIN = 1.5, CADA_MAX_MIN = 8;
const RESERVA = Number(process.env.VIVO_RESERVA || 2);         // consultas que siempre quedan
const RESERVA_ROBOT = 6;                                        // para que el robot confirme resultados y escriba las notas
const DURACION_MIN = 130;                                       // duración estimada de un partido de singles
const MAX_MIN = 340;                                            // GitHub corta los trabajos a las 6 horas
const SIN_PARTIDOS_MIN = 25;                                    // si no hay Finals en juego ni por empezar, termina
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const dormir = (ms) => new Promise((s) => setTimeout(s, ms));
const esDobles = (m) => !!m.dobles || /\//.test(`${m.players?.p1?.name || m.j1?.nombre || ''}${m.players?.p2?.name || m.j2?.nombre || ''}`) || /double/i.test(m.type || m.category || '');
const esFinals = (m) => /finals/i.test(`${m.tier || ''} ${m.tournament || m.torneo || ''}`) && !/next ?gen/i.test(m.tournament || m.torneo || '') && !esDobles(m);
let CADA_MIN = CADA_FIJO || 4;

function proximoReinicio(ahora = Date.now()) {
  const d = new Date(ahora); d.setUTCHours(22, 0, 0, 0);
  if (d.getTime() <= ahora) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}
// Minutos de partido de singles de Finals que quedan antes del próximo reinicio del cupo
function minutosPorJugar(enVivo) {
  const ahora = Date.now(), fin = proximoReinicio(ahora);
  let total = 0;
  for (const p of Object.values(partidos)) {
    if (!esFinals(p) || !p.horario || ['finalizado', 'cancelado'].includes(p.estado)) continue;
    const ini = Date.parse(p.horario);
    let termina = ini + DURACION_MIN * 60e3;
    if (enVivo.has(p.id) && termina < ahora + 30 * 60e3) termina = ahora + 30 * 60e3; // partido largo: se estima media hora más
    else if (!enVivo.has(p.id) && termina < ahora) continue;
    total += Math.max(0, Math.min(termina, fin) - Math.max(ini, ahora)) / 60e3;
  }
  return total;
}
function calcularIntervalo(quedan, enVivo) {
  if (CADA_FIJO) return CADA_FIJO;
  const disponibles = (Number.isFinite(quedan) ? quedan : 20) - RESERVA - RESERVA_ROBOT;
  const minutos = minutosPorJugar(enVivo);
  if (disponibles <= 0) return CADA_MAX_MIN;
  return Math.min(CADA_MAX_MIN, Math.max(CADA_MIN_MIN, minutos / disponibles));
}

const partidos = JSON.parse(fs.readFileSync('data/partidos.json', 'utf8'));
const inicio = Date.now();
let ultimoConFinals = Date.now() - 26 * 60e3; // si al arrancar no hay nada en juego ni por empezar, termina enseguida
const vistosEnVivo = new Set();

async function usoRestante() {
  try {
    const r = await fetch(`${BASE}/usage`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(15000) });
    const u = await r.json();
    return Number(u.today?.remaining_day);
  } catch { return NaN; }
}

function proximoFinals() {
  // ¿Hay un partido de Finals programado que empieza en los próximos 20 minutos o empezó hace poco?
  const ahora = Date.now();
  return Object.values(partidos).some((p) => esFinals(p) && !p.dobles && p.estado === 'programado' && p.horario &&
    Date.parse(p.horario) - ahora < 20 * 60e3 && ahora - Date.parse(p.horario) < 4 * 3600e3);
}

const PRUEBA = !!process.env.VIVO_PRUEBA; // prueba: no publica ni dispara nada, solo muestra lo que haría
function publicar(datos) {
  if (PRUEBA) { log('PUBLICARÍA', JSON.stringify(datos)); return; }
  fs.mkdirSync('/tmp/vivo', { recursive: true });
  fs.writeFileSync('/tmp/vivo/vivo.json', JSON.stringify(datos));
  // Sin esto Vercel intenta publicar la rama y manda un mail de error por cada actualización
  fs.writeFileSync('/tmp/vivo/vercel.json', JSON.stringify({ git: { deploymentEnabled: false } }));
  const git = (...a) => execFileSync('git', a, { cwd: '/tmp/vivo', stdio: 'pipe' }).toString();
  if (!fs.existsSync('/tmp/vivo/.git')) {
    git('init', '-q', '-b', 'vivo');
    git('remote', 'add', 'origin', execFileSync('git', ['remote', 'get-url', 'origin']).toString().trim());
    git('config', 'user.name', 'A Todo Tenis (vivo)'); git('config', 'user.email', 'actions@users.noreply.github.com');
    // las credenciales del checkout se reutilizan
    const h = execFileSync('git', ['config', '--get-regexp', '^http\\..*extraheader$']).toString().trim().split(/\s+/);
    if (h.length >= 2) git('config', h[0], h.slice(1).join(' '));
  }
  git('add', 'vivo.json', 'vercel.json');
  git('commit', '-q', '--allow-empty', '-m', `vivo ${datos.actualizado}`);
  git('push', '-q', '-f', 'origin', 'HEAD:vivo'); // un solo commit: la rama no crece
}

function dispararActualizacion() {
  if (PRUEBA) { log('DISPARARÍA la actualización completa'); return; }
  try {
    const repo = process.env.GITHUB_REPOSITORY || 'bohemio89/atodotenis';
    execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/actions/workflows/actualizar.yml/dispatches`, '-f', 'ref=main', '-f', 'inputs[forzar]=si'], { stdio: 'inherit' });
    log('Partido de Finals terminado: se dispara la actualización completa (resultado y nota).');
  } catch (e) { log('No se pudo disparar la actualización:', e.message); }
}

// ESPN (gratis, sin cupo) se mira cada TICK segundos: detecta el final del partido al instante y mueve sets y games.
// La API de resultados se consulta solo cada CADA_MIN minutos y agrega los puntos del game y quién saca.
const TICK_S = 30;
const avisados = new Set(Object.values(partidos).filter((p) => p.confirmado || p.estado === 'finalizado').map((p) => String(p.id)));
const terminadosAhora = {}; // partidos que terminaron durante esta corrida (se siguen mostrando como "Finalizado")
let apiEnVivo = {};         // último marcador de la API por partido (puntos y saque)
let proximaAPI = 0, ultimoPublicado = '', ultimaPublicacion = 0;

function avisarFin(id, x, fuente) {
  if (avisados.has(String(id))) return false;
  avisados.add(String(id)); terminadosAhora[id] = x;
  log(`Terminó ${x.j1 || ''} vs ${x.j2 || ''} (${(x.sets || []).map((s) => s.join('-')).join(' ')}) según ${fuente}`);
  return true;
}

async function consultarAPI() {
  const quedan = await usoRestante();
  if (Number.isFinite(quedan) && quedan <= RESERVA) { log(`Quedan ${quedan} consultas de la API: se sigue solo con ESPN.`); proximaAPI = proximoReinicio() + 60e3; return false; }
  let datos;
  try {
    const r = await fetch(`${BASE}/matches?status=live&limit=200`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) { log('API', r.status); proximaAPI = Date.now() + (r.status === 429 ? 30 : CADA_MIN) * 60e3; return false; }
    datos = await r.json();
  } catch (e) { log('Error API:', e.message); proximaAPI = Date.now() + 60e3; return false; }
  const finals = (datos.data || []).filter(esFinals);
  CADA_MIN = calcularIntervalo(quedan, new Set(finals.map((m) => m.id)));
  proximaAPI = Date.now() + CADA_MIN * 60e3;
  apiEnVivo = {};
  for (const m of finals) {
    const g = m.score?.games || [[], []];
    apiEnVivo[m.id] = {
      estado: 'en_vivo',
      j1: m.players?.p1?.name || partidos[m.id]?.j1?.nombre || '', j2: m.players?.p2?.name || partidos[m.id]?.j2?.nombre || '',
      torneo: /wta/i.test(`${m.tier} ${m.tournament}`) ? 'WTA Finals' : 'ATP Finals',
      sets: (g[0] || []).map((a, i) => [a, (g[1] || [])[i] ?? 0]),
      puntos: m.score?.points || null, saca: m.score?.server || null,
    };
    vistosEnVivo.add(m.id);
  }
  let termino = false;
  for (const id of [...vistosEnVivo]) {
    if (finals.some((m) => m.id === id)) continue;
    vistosEnVivo.delete(id);
    if (avisados.has(String(id))) continue; // ESPN ya lo dio por terminado
    try {
      const r = await fetch(`${BASE}/matches/${id}`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
      const m = await r.json(); const g = m.score?.games || [[], []]; const s = m.score?.sets || [];
      const ganador = m.status === 'completed' ? (Array.isArray(s) && s.length === 2 ? (s[0] > s[1] ? 1 : 2) : null) : null;
      const x = { estado: m.status === 'completed' ? 'terminado' : 'interrumpido', j1: partidos[id]?.j1?.nombre || '', j2: partidos[id]?.j2?.nombre || '', torneo: 'ATP Finals', sets: (g[0] || []).map((a, i) => [a, (g[1] || [])[i] ?? 0]), ganador };
      if (x.estado === 'terminado' && avisarFin(id, x, 'la API')) termino = true;
    } catch {}
  }
  log(`API: ${finals.length} en vivo${Number.isFinite(quedan) ? ` · quedan ${quedan - 1} consultas hoy` : ''} · próxima en ${CADA_MIN.toFixed(1)} min`);
  return termino;
}

async function main() {
  if (!KEY) log('Sin clave de la API: se sigue solo con ESPN');
  let refresco = Date.now();
  while (Date.now() - inicio < MAX_MIN * 60e3) {
    // Cada 10 minutos se releen los partidos publicados (por ejemplo, cuando se definen los rivales de una semifinal)
    if (Date.now() - refresco > 10 * 60e3) {
      refresco = Date.now();
      try {
        const r = await fetch(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY || 'bohemio89/atodotenis'}/main/data/partidos.json`, { signal: AbortSignal.timeout(20000) });
        if (r.ok) { const nuevos = await r.json(); for (const [id, p] of Object.entries(nuevos)) if (esFinals(p)) partidos[id] = p; }
      } catch {}
    }
    let espn = null;
    try { espn = await marcadoresESPN(partidos, esFinals); } catch (e) { log('ESPN no respondió:', e.message); }
    const enVivoESPN = espn ? Object.entries(espn).filter(([, x]) => x.estado === 'en_vivo') : [];
    let termino = false;

    // Fin de partido según ESPN: se avisa en el momento
    for (const [id, x] of Object.entries(espn || {})) {
      if (x.estado === 'terminado' && x.ganador && !avisados.has(String(id)) && Date.now() - Date.parse(partidos[id]?.horario || 0) < 8 * 3600e3) {
        if (avisarFin(id, { ...x, torneo: 'ATP Finals' }, 'ESPN')) termino = true;
      }
    }

    // La API solo mientras hay un partido en juego (o si ESPN no responde y el partido ya debería haber empezado)
    const enJuego = enVivoESPN.length > 0 || vistosEnVivo.size > 0 || (!espn && proximoFinals());
    if (KEY && enJuego && Date.now() >= proximaAPI) { if (await consultarAPI()) termino = true; }

    // Marcador para el sitio: ESPN + puntos y saque de la API
    const salida = { actualizado: new Date().toISOString(), cadaMin: Math.round(CADA_MIN * 10) / 10, fuente: espn ? 'espn+api' : 'api', partidos: {} };
    for (const [id, x] of enVivoESPN) {
      const a = apiEnVivo[id];
      const totalA = (a?.sets || []).flat().reduce((s, n) => s + n, 0), totalE = x.sets.flat().reduce((s, n) => s + n, 0);
      salida.partidos[id] = { estado: 'en_vivo', j1: x.j1, j2: x.j2, torneo: 'ATP Finals', sets: totalA > totalE ? a.sets : x.sets, puntos: a && totalA >= totalE ? a.puntos : null, saca: a?.saca || null };
    }
    for (const [id, a] of Object.entries(apiEnVivo)) if (!salida.partidos[id] && !terminadosAhora[id]) salida.partidos[id] = a;
    for (const [id, x] of Object.entries(terminadosAhora)) salida.partidos[id] = { estado: x.estado, j1: x.j1, j2: x.j2, torneo: x.torneo || 'ATP Finals', sets: x.sets, tiebreaks: x.tiebreaks || null, ganador: x.ganador };

    // Se publica cuando cambia algo (y como mínimo cada 3 minutos para que el sitio sepa que el seguimiento sigue vivo)
    const huella = JSON.stringify(salida.partidos);
    if (termino || huella !== ultimoPublicado || Date.now() - ultimaPublicacion > 3 * 60e3) {
      try { publicar(salida); ultimoPublicado = huella; ultimaPublicacion = Date.now(); } catch (e) { log('No se pudo publicar vivo.json:', e.message); }
    }
    if (termino) dispararActualizacion();

    if (enJuego || Object.keys(salida.partidos).length || proximoFinals()) ultimoConFinals = Date.now();
    else if (Date.now() - ultimoConFinals > SIN_PARTIDOS_MIN * 60e3) { log('No hay partidos de Finals en juego ni por empezar: fin del seguimiento.'); break; }
    if (PRUEBA && Date.now() - inicio > 50e3) break;
    await dormir(TICK_S * 1000);
  }
}
main();
