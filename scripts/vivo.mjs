// Seguimiento en vivo de las ATP/WTA Finals.
// Mientras se juega un partido de las Finals, consulta la API cada pocos minutos (una sola consulta trae todos los
// partidos en vivo), escribe data/vivo.json en la rama "vivo" (no dispara publicaciones en Vercel) y el sitio lo lee
// directamente desde el navegador para mover el marcador. Cuando un partido termina, dispara la actualización
// completa para que el resultado y la nota salgan enseguida.
// Cuida el cupo diario gratuito de la API: se detiene si quedan pocas consultas.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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

function publicar(datos) {
  fs.mkdirSync('/tmp/vivo', { recursive: true });
  fs.writeFileSync('/tmp/vivo/vivo.json', JSON.stringify(datos));
  const git = (...a) => execFileSync('git', a, { cwd: '/tmp/vivo', stdio: 'pipe' }).toString();
  if (!fs.existsSync('/tmp/vivo/.git')) {
    git('init', '-q', '-b', 'vivo');
    git('remote', 'add', 'origin', execFileSync('git', ['remote', 'get-url', 'origin']).toString().trim());
    git('config', 'user.name', 'A Todo Tenis (vivo)'); git('config', 'user.email', 'actions@users.noreply.github.com');
    // las credenciales del checkout se reutilizan
    const h = execFileSync('git', ['config', '--get-regexp', '^http\\..*extraheader$']).toString().trim().split(/\s+/);
    if (h.length >= 2) git('config', h[0], h.slice(1).join(' '));
  }
  git('add', 'vivo.json');
  git('commit', '-q', '--allow-empty', '-m', `vivo ${datos.actualizado}`);
  git('push', '-q', '-f', 'origin', 'HEAD:vivo'); // un solo commit: la rama no crece
}

function dispararActualizacion() {
  try {
    const repo = process.env.GITHUB_REPOSITORY || 'bohemio89/atodotenis';
    execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/actions/workflows/actualizar.yml/dispatches`, '-f', 'ref=main', '-f', 'inputs[forzar]=si'], { stdio: 'inherit' });
    log('Partido de Finals terminado: se dispara la actualización completa (resultado y nota).');
  } catch (e) { log('No se pudo disparar la actualización:', e.message); }
}

async function main() {
  if (!KEY) { log('Sin clave de la API'); return; }
  while (Date.now() - inicio < MAX_MIN * 60e3) {
    // Si todavía no hay ninguno en juego y el próximo empieza en más de 5 minutos, se espera sin consultar
    if (!vistosEnVivo.size) {
      const prox = Object.values(partidos).filter((p) => esFinals(p) && p.estado === 'programado' && p.horario)
        .map((p) => Date.parse(p.horario)).filter((t) => t > Date.now() + 5 * 60e3 && t - Date.now() < 25 * 60e3).sort()[0];
      if (prox) { log('Esperando el comienzo del partido sin gastar consultas'); await dormir(Math.min(prox - Date.now() - 4 * 60e3, 20 * 60e3)); continue; }
    }
    const quedan = await usoRestante();
    if (Number.isFinite(quedan) && quedan <= RESERVA) { log(`Quedan ${quedan} consultas: se pausa el seguimiento para no dejar al robot sin cupo.`); break; }
    let datos;
    try {
      const r = await fetch(`${BASE}/matches?status=live&limit=200`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { log('API', r.status); if (r.status === 429) break; await dormir(CADA_MIN * 60e3); continue; }
      datos = await r.json();
    } catch (e) { log('Error API:', e.message); await dormir(60e3); continue; }

    const finals = (datos.data || []).filter(esFinals);
    CADA_MIN = calcularIntervalo(quedan, new Set(finals.map((m) => m.id)));
    const salida = { actualizado: new Date().toISOString(), cadaMin: Math.round(CADA_MIN * 10) / 10, partidos: {} };
    for (const m of finals) {
      const g = m.score?.games || [[], []];
      salida.partidos[m.id] = {
        estado: 'en_vivo',
        j1: m.players?.p1?.name || partidos[m.id]?.j1?.nombre || '', j2: m.players?.p2?.name || partidos[m.id]?.j2?.nombre || '',
        torneo: /wta/i.test(`${m.tier} ${m.tournament}`) ? 'WTA Finals' : 'ATP Finals',
        sets: (g[0] || []).map((a, i) => [a, (g[1] || [])[i] ?? 0]),
        puntos: m.score?.points || null,
        saca: m.score?.server || null,
      };
      vistosEnVivo.add(m.id);
    }
    // Los que estaban en vivo y ya no aparecen: terminaron
    let termino = false;
    for (const id of [...vistosEnVivo]) {
      if (finals.some((m) => m.id === id)) continue;
      vistosEnVivo.delete(id); termino = true;
      // una consulta más para tener el marcador final exacto y el ganador
      try {
        const r = await fetch(`${BASE}/matches/${id}`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
        const m = await r.json(); const g = m.score?.games || [[], []];
        const s = m.score?.sets || [];
        const ganador = m.status === 'completed' ? (Array.isArray(s) && s.length === 2 ? (s[0] > s[1] ? 1 : 2) : null) : null;
        salida.partidos[id] = { estado: m.status === 'completed' ? 'terminado' : 'interrumpido', sets: (g[0] || []).map((a, i) => [a, (g[1] || [])[i] ?? 0]), ganador };
      } catch { salida.partidos[id] = { estado: 'terminado' }; }
    }
    try { publicar(salida); } catch (e) { log('No se pudo publicar vivo.json:', e.message); }
    log(`Finals en vivo: ${finals.length}${Number.isFinite(quedan) ? ` · quedan ${quedan - 1} consultas hoy` : ''} · próxima en ${CADA_MIN.toFixed(1)} min`);
    if (termino) dispararActualizacion();

    if (finals.length || proximoFinals()) ultimoConFinals = Date.now();
    else if (Date.now() - ultimoConFinals > SIN_PARTIDOS_MIN * 60e3) { log('No hay partidos de Finals en juego ni por empezar: fin del seguimiento.'); break; }
    await dormir(CADA_MIN * 60e3);
  }
}
main();
