// Recolector: trae partidos en vivo, calendario, resultados y ranking desde Live Tennis API.
// Respeta el límite gratuito (100 consultas por día, se reinicia a las 22:00 UTC).
import { CONFIG, leerJSON, guardarJSON, log, ganador, tourBase } from './lib/util.mjs';

const KEY = process.env.LIVE_TENNIS_API_KEY;
const BASE = 'https://api.livetennisapi.com/api/public/v1';
const C = CONFIG.api;

if (!KEY) { console.error('Falta LIVE_TENNIS_API_KEY'); process.exit(1); }

// ---------- Presupuesto diario ----------
const ahora = new Date();
const diaAPI = new Date(ahora.getTime() + (24 - C.horaReinicioUTC) * 3600e3).toISOString().slice(0, 10);
const horasHastaReinicio = (() => {
  const r = new Date(ahora); r.setUTCHours(C.horaReinicioUTC, 0, 0, 0);
  if (r <= ahora) r.setUTCDate(r.getUTCDate() + 1);
  return Math.floor((r - ahora) / 3600e3);
})();

const estado = leerJSON('data/estado.json', {});
if (estado.diaAPI !== diaAPI) {
  estado.diaAPI = diaAPI; estado.usadas = 0; estado.jugadoresHoy = false;
}

async function api(ruta) {
  if (estado.usadas >= C.presupuestoDiario - 1) throw new Error('Presupuesto diario agotado');
  for (let intento = 1; intento <= 3; intento++) {
    estado.usadas++;
    try {
      const r = await fetch(`${BASE}/${ruta}`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
      if (r.status === 429) { const w = Number(r.headers.get('retry-after') || 30); log('429, espero', w); await new Promise((s) => setTimeout(s, w * 1000)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${ruta}: ${(await r.text()).slice(0, 200)}`);
      return await r.json();
    } catch (e) {
      if (intento === 3 || /HTTP 4\d\d/.test(e.message)) throw e;
      log('Error, reintento:', e.message);
      await new Promise((s) => setTimeout(s, 5000 * intento));
    }
  }
}

// ---------- Base de partidos ----------
const partidos = leerJSON('data/partidos.json', {}); // id -> partido normalizado
const jugadores = leerJSON('data/jugadores.json', { actualizado: null, lista: {} });

function infoJugador(id, nombreCorto) {
  const j = jugadores.lista[id];
  return j ? { id, nombre: j.nombre, pais: j.pais, ranking: j.ranking } : { id, nombre: nombreCorto, pais: null, ranking: null };
}

function desdeMatch(m) {
  const viejo = partidos[m.id] || {};
  const p = (x) => x && { id: x.id, nombre: x.name, pais: x.country, ranking: x.ranking ?? null };
  const final = m.status === 'completed';
  return {
    ...viejo,
    id: m.id,
    tour: m.tour, tier: m.tier, torneo: m.tournament, torneoId: m.tournament_id,
    ronda: m.round, rondaCod: m.round_code, superficie: m.surface, cubierto: !!m.indoor,
    dobles: !!m.is_doubles, clasificacion: !!m.is_qualifying, genero: m.gender,
    horario: m.scheduled_time || viejo.horario,
    j1: p(m.players?.p1) || viejo.j1, j2: p(m.players?.p2) || viejo.j2,
    estado: final ? 'finalizado' : m.status === 'live' ? 'en_vivo' : m.status === 'upcoming' ? 'programado' : (m.outcome || m.status),
    resultado: m.outcome && m.outcome !== 'completed' ? m.outcome : (viejo.resultado || null),
    score: m.score ? { games: m.score.games, sets: m.score.sets, puntos: m.score.points, saca: m.score.server } : viejo.score || null,
    confirmado: final || viejo.confirmado || false,
    ganador: final ? ganador(m.score) : viejo.ganador || null,
    visto: new Date().toISOString()
  };
}

function desdeFixture(f) {
  const viejo = partidos[f.match_id] || {};
  const estados = { finished: 'finalizado', live: 'en_vivo', scheduled: 'programado', cancelled: 'cancelado' };
  return {
    ...viejo,
    id: f.match_id,
    tour: f.tour, torneo: viejo.torneo || f.tournament, ronda: viejo.ronda || f.round, rondaCod: f.round_code,
    superficie: f.surface, clasificacion: !!f.is_qualifying, genero: f.gender,
    horario: f.start_time || viejo.horario,
    j1: viejo.j1 || infoJugador(f.player1_id, f.player1_name),
    j2: viejo.j2 || infoJugador(f.player2_id, f.player2_name),
    dobles: viejo.dobles ?? /\//.test(f.player1_name || ''),
    estado: viejo.confirmado ? 'finalizado' : (estados[f.status] || f.status),
    motivo: f.reason || null,
    visto: new Date().toISOString()
  };
}

// ¿Merece resultado confirmado y nota?
function esImportante(m) {
  if (!m || m.clasificacion) return false;
  const torneo = (m.torneo || '').toLowerCase();
  const equipos = torneo.includes('davis') || torneo.includes('billie jean') || ['davis_cup', 'bjk_cup'].includes(m.tier);
  const arg = [m.j1, m.j2].some((j) => j?.pais === CONFIG.notas.paisDestacado);
  const base = tourBase(m.tour);
  const nivelTour = ['atp', 'wta'].includes(base);
  if (equipos) return !m.dobles || m.rondaCod === 'F';
  if (arg && (nivelTour || base === 'challenger')) return true;
  if (m.dobles) return nivelTour && m.rondaCod === 'F';
  if (nivelTour && ['F', 'SF'].includes(m.rondaCod)) return true;
  if (nivelTour && ['grand_slam', 'atp_1000', 'wta_1000'].includes(m.tier) && ['QF'].includes(m.rondaCod)) return true;
  if (base === 'challenger' && m.rondaCod === 'F') return true;
  return false;
}

function prioridad(m) {
  let p = 0;
  if (esImportante(m)) p += 100;
  const b = tourBase(m.tour);
  if (['atp', 'wta'].includes(b)) p += 20;
  if (!m.dobles) p += 5;
  if (b === 'challenger') p += 3;
  return p;
}

// ---------- Corrida ----------
async function main() {
  log(`Día API ${diaAPI}: usadas ${estado.usadas}/${C.presupuestoDiario}, faltan ${horasHastaReinicio} h para el reinicio`);

  // 1) En vivo (todas las giras en una consulta)
  const enVivoIds = new Set();
  const vivo = await api('matches?status=live&limit=200');
  for (const m of vivo.data || []) {
    if (!tourBase(m.tour)) continue;
    partidos[m.id] = desdeMatch(m); enVivoIds.add(m.id);
  }
  // Los que estaban en vivo y ya no aparecen: terminaron (o se suspendieron)
  for (const p of Object.values(partidos)) {
    if (p.estado === 'en_vivo' && !enVivoIds.has(p.id)) p.estado = 'por_confirmar';
  }
  log('En vivo:', enVivoIds.size);

  // 2) Calendario cada N horas
  const horasDesdeCal = estado.calendario ? (ahora - new Date(estado.calendario)) / 3600e3 : 99;
  if (horasDesdeCal >= C.calendarioCadaHoras - 0.25) {
    for (const tour of C.toursCalendario) {
      const fx = await api(`fixtures?limit=200&tour=${tour}`);
      for (const f of fx.data || []) if (tourBase(f.tour)) partidos[f.match_id] = desdeFixture(f);
      log(`Calendario ${tour}:`, (fx.data || []).length);
    }
    estado.calendario = ahora.toISOString();
  }

  // 3) Jugadores y ranking, una vez por día API
  if (!estado.jugadoresHoy) {
    const lista = {};
    for (let i = 0; i < C.jugadoresPaginas; i++) {
      const r = await api(`players?limit=200&offset=${i * 200}`);
      for (const j of r.data || []) {
        if (!j.ranking || j.is_doubles_team) continue;
        lista[j.id] = { nombre: j.name, pais: j.country, ranking: j.ranking, puntos: j.ranking_points, mov: j.ranking_movement, tour: j.tour };
      }
    }
    jugadores.lista = lista; jugadores.actualizado = ahora.toISOString();
    guardarJSON('data/jugadores.json', jugadores);
    estado.jugadoresHoy = true;
    // Completar país/ranking en partidos que vinieron del calendario
    for (const p of Object.values(partidos)) for (const k of ['j1', 'j2']) {
      const j = p[k] && lista[p[k].id];
      if (j && !p[k].pais) p[k] = { ...p[k], nombre: j.nombre, pais: j.pais, ranking: j.ranking };
    }
    log('Jugadores con ranking:', Object.keys(lista).length);
  }

  // 4) Confirmar resultados finales con el presupuesto que sobra
  const corridasRestantes = Math.max(0, horasHastaReinicio);
  const calendariosRestantes = Math.floor(corridasRestantes / C.calendarioCadaHoras) * C.toursCalendario.length;
  const fijasFuturas = corridasRestantes + calendariosRestantes;
  const disponibles = C.presupuestoDiario - estado.usadas - C.reserva - fijasFuturas;
  const cupo = Math.max(0, Math.min(C.maxDetallesPorCorrida, disponibles));
  const pendientes = Object.values(partidos)
    .filter((p) => !p.confirmado && ['por_confirmar', 'finalizado'].includes(p.estado))
    .sort((a, b) => prioridad(b) - prioridad(a) || String(b.horario).localeCompare(String(a.horario)));
  let confirmados = 0;
  for (const p of pendientes.slice(0, cupo)) {
    const m = await api(`matches/${p.id}`);
    partidos[p.id] = desdeMatch(m);
    if (m.status === 'live') partidos[p.id].estado = 'en_vivo';
    confirmados++;
  }
  log(`Confirmados ${confirmados} (cupo ${cupo}, pendientes ${pendientes.length})`);

  // 5) Limpiar historial viejo y guardar
  const limite = Date.now() - C.diasDeHistorial * 86400e3;
  for (const [id, p] of Object.entries(partidos)) {
    const t = new Date(p.horario || p.visto).getTime();
    if (t < limite || !tourBase(p.tour)) delete partidos[id];
    else p.importante = esImportante(p);
  }
  estado.ultimaCorrida = ahora.toISOString();
  guardarJSON('data/partidos.json', partidos);
  guardarJSON('data/estado.json', estado);
  log(`Listo. Consultas usadas hoy: ${estado.usadas}`);
}

main().catch((e) => {
  guardarJSON('data/partidos.json', partidos);
  guardarJSON('data/estado.json', estado);
  console.error('ERROR:', e.message);
  process.exit(1);
});
