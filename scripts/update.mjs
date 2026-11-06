// Recolector: trae partidos en vivo, calendario, resultados y ranking desde Live Tennis API.
// Respeta el límite gratuito (100 consultas por día, se reinicia a las 22:00 UTC).
import { CONFIG, leerJSON, guardarJSON, log, ganador, tourBase, sets } from './lib/util.mjs';

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
// Catálogo de torneos: clave "tour|nombre" -> datos, campeones, fechas vistas
const torneos = leerJSON('data/torneos.json', {});
const claveTorneo = (p) => p.tour && p.torneo ? `${p.tour.replace(/_doubles$/, '')}|${p.torneo.trim()}` : null;
function actualizarTorneos() {
  for (const p of Object.values(partidos)) {
    const k = claveTorneo(p); if (!k || p.clasificacion) continue;
    p.torneoClave = k;
    const t = torneos[k] ||= { clave: k, nombre: p.torneo.trim(), tour: p.tour.replace(/_doubles$/, ''), id: null, meta: null, campeones: {}, primeraVez: null, ultimaVez: null };
    if (p.torneoId && !t.id) t.id = String(p.torneoId);
    if (p.tier && !t.tier) t.tier = p.tier;
    if (p.superficie && !t.superficie) t.superficie = p.superficie;
    const h = p.horario || p.visto;
    if (h && (!t.primeraVez || h < t.primeraVez)) t.primeraVez = h;
    if (h && (!t.ultimaVez || h > t.ultimaVez)) t.ultimaVez = h;
    // Campeones: se registran cuando se confirma la final
    if (p.rondaCod === 'F' && p.confirmado && p.ganador) {
      const g = p.ganador === 1 ? p.j1 : p.j2, f = p.ganador === 1 ? p.j2 : p.j1;
      const anio = (h || '').slice(0, 4);
      t.campeones[anio] ||= {};
      t.campeones[anio][p.dobles ? 'dobles' : 'singles'] = {
        campeon: g?.nombre, pais: g?.pais || null, paises: g?.paises || null,
        finalista: f?.nombre, paisFinalista: f?.pais || null, paisesFinalista: f?.paises || null,
        marcador: sets(p.score).map(([a, b]) => (p.ganador === 1 ? `${a}-${b}` : `${b}-${a}`)).join(' '), partidoId: p.id, fecha: h || null
      };
    }
  }
}

// Registro permanente de países: id -> país, y nombre normalizado -> país
const paises = leerJSON('data/paises.json', { porId: {}, porNombre: {} });
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
function registrar(id, nombre, pais, tour) {
  if (!pais || !nombre || nombre.includes('/')) return;
  if (id) paises.porId[id] = pais;
  const n = norm(nombre); paises.porNombre[n] = pais;
  const ap = n.split(' ').slice(1).join(' ') || n; // apellido(s)
  const t = (tour || '').replace(/_.*/, '');
  const clave = `${t}|${ap}`;
  const prev = paises.porNombre['@' + clave];
  paises.porNombre['@' + clave] = prev && prev !== pais ? '?' : pais; // '?' = apellido ambiguo
}
function paisPorNombre(nombre, tour) {
  const n = norm(nombre);
  if (paises.porNombre[n]) return paises.porNombre[n];
  const t = (tour || '').replace(/_.*/, '');
  const partes = n.split(' ');
  for (let i = 0; i < partes.length; i++) { // probar apellido con y sin nombre de pila
    const v = paises.porNombre[`@${t}|${partes.slice(i).join(' ')}`];
    if (v && v !== '?') return v;
  }
  return null;
}
function completarPais(p) {
  for (const k of ['j1', 'j2']) {
    const j = p[k]; if (!j) continue;
    if (p.dobles || (j.nombre || '').includes('/')) {
      const ps = (j.nombre || '').split('/').map((x) => paisPorNombre(x.trim(), p.tour));
      p[k] = { ...j, paises: ps };
    } else if (!j.pais) {
      const v = (j.id && paises.porId[j.id]) || paisPorNombre(j.nombre, p.tour);
      if (v) p[k] = { ...j, pais: v };
    }
  }
}

function infoJugador(id, nombreCorto) {
  const j = jugadores.lista[id];
  return j ? { id, nombre: j.nombre, pais: j.pais, ranking: j.ranking } : { id, nombre: nombreCorto, pais: null, ranking: null };
}

function desdeMatch(m) {
  const viejo = partidos[m.id] || {};
  const p = (x) => { if (!x) return x; registrar(x.id, x.name, x.country, m.tour); return { id: x.id, nombre: x.name, pais: x.country, ranking: x.ranking ?? null }; };
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
  const base = tourBase(m.tour);
  const r = m.rondaCod;
  // Copa Davis y Billie Jean King Cup: todos los singles y las finales de dobles
  if (torneo.includes('davis') || torneo.includes('billie jean') || ['davis_cup', 'bjk_cup'].includes(m.tier)) return !m.dobles || r === 'F';
  // Finales de temporada (ATP Finals / WTA Finals): todos los partidos de singles
  if (torneo.includes('finals') && !m.dobles) return true;
  if (m.dobles) return ['atp', 'wta'].includes(base) && r === 'F';
  // Sorpresas: un top 10 pierde con alguien de fuera del top 30 (o un top 3 pierde con quien sea), en el cuadro principal ATP/WTA
  if (['atp', 'wta'].includes(base) && m.ganador) {
    const g = m.ganador === 1 ? m.j1 : m.j2, pe = m.ganador === 1 ? m.j2 : m.j1;
    const rg = g?.ranking || 9999, rp = pe?.ranking || 9999;
    // Top 3 que pierde; top 10 ante alguien de fuera del top 30; top 20 ante alguien que está 40 puestos o más abajo
    if (rp <= 3 || (rp <= 10 && rg > 30) || (rp <= 20 && rg - rp >= 40)) return true;
  }
  const t = m.tier || '';
  if (['grand_slam'].includes(t)) return ['R32', 'R16', 'QF', 'SF', 'F'].includes(r);
  if (['atp_1000', 'wta_1000'].includes(t)) return ['R16', 'QF', 'SF', 'F'].includes(r);
  if (['atp_500', 'wta_500'].includes(t)) return ['QF', 'SF', 'F'].includes(r);
  if (['atp', 'wta'].includes(base)) return ['SF', 'F'].includes(r);
  if (base === 'challenger') return r === 'F';
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
  // GitHub corre esta tarea cada 15 minutos (porque a veces saltea corridas); la API se consulta como mucho una vez por hora
  if (estado.ultimaCorrida && (ahora - new Date(estado.ultimaCorrida)) / 60000 < 50 && !process.env.FORZAR) {
    log('Última consulta hace menos de 50 minutos: no se consulta la API en esta corrida.');
    return;
  }
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
        registrar(j.id, j.name, j.country, j.tour);
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

  // 4b) Datos de torneos nuevos (ciudad, país, categoría), una sola vez por torneo
  actualizarTorneos();
  const sinMeta = Object.values(torneos).filter((t) => t.id && !t.meta && tourBase(t.tour))
    .sort((a, b) => String(b.ultimaVez).localeCompare(String(a.ultimaVez))).slice(0, Math.max(0, Math.min(6, disponibles - confirmados)));
  for (const t of sinMeta) {
    const m = await api(`tournaments/${t.id}`);
    t.meta = { ciudad: m.city, pais: m.country, categoria: m.category, superficie: m.surface, cubierto: !!m.indoor, genero: m.gender };
  }
  const usadasTorneos = sinMeta.length;
  log(`Torneos: ${Object.keys(torneos).length} en catálogo, ${usadasTorneos} completados`);

  // 5) Países: completar con el registro y buscar de a uno los que falten (con lo que sobra del cupo)
  for (const p of Object.values(partidos)) completarPais(p);
  const faltan = new Map();
  for (const p of Object.values(partidos)) {
    if (p.clasificacion || p.dobles || !tourBase(p.tour) || p.estado === 'cancelado') continue;
    for (const k of ['j1', 'j2']) {
      const j = p[k];
      if (j?.id && !j.pais && !paises.porId[j.id] && !faltan.has(j.id)) faltan.set(j.id, p.estado === 'en_vivo' ? 0 : p.estado === 'programado' ? 1 : 2);
    }
  }
  const cupoPaises = Math.max(0, Math.min(C.maxPaisesPorCorrida, disponibles - confirmados - usadasTorneos));
  const ids = [...faltan.entries()].sort((a, b) => a[1] - b[1]).slice(0, cupoPaises).map(([id]) => id);
  for (const id of ids) {
    const j = await api(`players/${id}`);
    paises.porId[id] = j.country || 'sin';
    registrar(j.id, j.name, j.country, j.tour);
  }
  // Dobles: buscar por apellido a los integrantes que falten (cada apellido se busca una sola vez)
  let cupoDobles = cupoPaises - ids.length;
  const apellidos = new Map();
  for (const p of Object.values(partidos)) {
    if (!p.dobles || p.clasificacion || !tourBase(p.tour) || tourBase(p.tour) === 'challenger') continue; // dobles de Challenger: ocultos
    for (const k of ['j1', 'j2']) for (const parte of (p[k]?.nombre || '').split('/')) {
      const n = norm(parte); if (!n || paisPorNombre(parte, p.tour)) continue;
      const ap = n.split(' ').pop(); const t = (p.tour || '').replace(/_.*/, '');
      if (ap.length < 3 || paises.porNombre[`#${t}|${ap}`]) continue;
      apellidos.set(`${t}|${ap}`, { t, ap, prio: (tourBase(p.tour) === 'challenger' ? 10 : 0) + (p.estado === 'en_vivo' ? 0 : p.estado === 'programado' ? 1 : 2) });
    }
  }
  let buscadosDobles = 0;
  for (const { t, ap } of [...apellidos.values()].sort((a, b) => a.prio - b.prio)) {
    if (cupoDobles-- <= 0) break;
    const r = await api(`players?search=${encodeURIComponent(ap)}&limit=20`);
    paises.porNombre[`#${t}|${ap}`] = true;
    for (const j of r.data || []) if (!j.is_doubles_team && j.country) registrar(j.id, j.name, j.country, j.tour);
    buscadosDobles++;
  }
  for (const p of Object.values(partidos)) completarPais(p);
  log(`Países buscados: ${ids.length} jugadores (faltaban ${faltan.size}), ${buscadosDobles} apellidos de dobles (faltaban ${apellidos.size})`);

  // 6) Completar la categoría (tier) de partidos del calendario con la de su torneo
  const tierDe = {};
  for (const p of Object.values(partidos)) if (p.tier && p.torneo) tierDe[`${tourBase(p.tour)}|${p.torneo}`] = p.tier;
  for (const p of Object.values(partidos)) if (!p.tier) p.tier = tierDe[`${tourBase(p.tour)}|${p.torneo}`] || null;

  // 7) Limpiar historial viejo y guardar
  const limite = Date.now() - C.diasDeHistorial * 86400e3;
  actualizarTorneos();
  const activo = (p) => { const t = torneos[claveTorneo(p)]; return t && Date.now() - new Date(t.ultimaVez).getTime() < 10 * 86400e3; };
  for (const [id, p] of Object.entries(partidos)) {
    const t = new Date(p.horario || p.visto).getTime();
    if ((t < limite && !activo(p)) || !tourBase(p.tour)) delete partidos[id];
    else p.importante = esImportante(p);
  }
  estado.ultimaCorrida = ahora.toISOString();
  guardarJSON('data/partidos.json', partidos);
  guardarJSON('data/estado.json', estado);
  guardarJSON('data/paises.json', paises);
  guardarJSON('data/torneos.json', torneos);
  log(`Listo. Consultas usadas hoy: ${estado.usadas}`);
}

main().catch((e) => {
  guardarJSON('data/partidos.json', partidos);
  guardarJSON('data/estado.json', estado);
  console.error('ERROR:', e.message);
  process.exit(1);
});
