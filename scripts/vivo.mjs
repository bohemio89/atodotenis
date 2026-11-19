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
const CADA_MIN = Number(process.env.VIVO_CADA_MIN || 6);       // minutos entre consultas
const RESERVA = Number(process.env.VIVO_RESERVA || 8);                                              // consultas que siempre quedan para el robot principal
const MAX_MIN = 340;                                            // GitHub corta los trabajos a las 6 horas
const SIN_PARTIDOS_MIN = 25;                                    // si no hay Finals en juego ni por empezar, termina
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const dormir = (ms) => new Promise((s) => setTimeout(s, ms));
const esFinals = (m) => /finals/i.test(`${m.tier || ''} ${m.tournament || m.torneo || ''}`) && !/next ?gen/i.test(m.tournament || m.torneo || '');

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
    execFileSync('gh', ['workflow', 'run', 'actualizar.yml', '-f', 'forzar=si'], { stdio: 'inherit' });
    log('Partido de Finals terminado: se dispara la actualización completa (resultado y nota).');
  } catch (e) { log('No se pudo disparar la actualización:', e.message); }
}

async function main() {
  if (!KEY) { log('Sin clave de la API'); return; }
  while (Date.now() - inicio < MAX_MIN * 60e3) {
    const quedan = await usoRestante();
    if (Number.isFinite(quedan) && quedan <= RESERVA) { log(`Quedan ${quedan} consultas: se pausa el seguimiento para no dejar al robot sin cupo.`); break; }
    let datos;
    try {
      const r = await fetch(`${BASE}/matches?status=live&limit=200`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { log('API', r.status); if (r.status === 429) break; await dormir(CADA_MIN * 60e3); continue; }
      datos = await r.json();
    } catch (e) { log('Error API:', e.message); await dormir(60e3); continue; }

    const finals = (datos.data || []).filter(esFinals);
    const salida = { actualizado: new Date().toISOString(), cadaMin: CADA_MIN, partidos: {} };
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
    log(`Finals en vivo: ${finals.length}${Number.isFinite(quedan) ? ` · quedan ${quedan - 1} consultas hoy` : ''}`);
    if (termino) dispararActualizacion();

    if (finals.length || proximoFinals()) ultimoConFinals = Date.now();
    else if (Date.now() - ultimoConFinals > SIN_PARTIDOS_MIN * 60e3) { log('No hay partidos de Finals en juego ni por empezar: fin del seguimiento.'); break; }
    await dormir(CADA_MIN * 60e3);
  }
}
main();
