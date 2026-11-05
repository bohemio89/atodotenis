// Puntos que defiende el Top Ten en el Grand Slam en curso o el próximo, y proyección de ranking.
// Puntos oficiales por ronda (singles):
//   ATP: 2025 ATP Media Guide (atptour.com)  ·  WTA: WTA 2026 Points Table (itftennis.com)
import { slugify } from './util.mjs';

export const PUNTOS = {
  atp: { W: 2000, F: 1300, SF: 800, QF: 400, R16: 200, R32: 100, R64: 50, R128: 10 },
  wta: { W: 2000, F: 1300, SF: 780, QF: 430, R16: 240, R32: 130, R64: 70, R128: 10 }
};
const ORDEN = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F', 'W'];
export const RONDA_TXT = { R128: '1° ronda', R64: '2° ronda', R32: '3° ronda', R16: 'Octavos', QF: 'Cuartos', SF: 'Semifinal', F: 'Final', W: 'Campeón' };

// Calendario aproximado: [nombre, mes de fin, día de fin, regex del nombre en la API]
const SLAMS = [
  ['Australian Open', 2, 2, /australian open|melbourne/i],
  ['Roland Garros', 6, 9, /roland garros|french open/i],
  ['Wimbledon', 7, 14, /wimbledon/i],
  ['US Open', 9, 15, /us open|flushing/i]
];

const clave = (n) => slugify(String(n || '').replace(/\s*\[\d+\]/, ''));
const apellidoClave = (n) => clave(String(n || '').trim().split(/\s+/).pop());

export function proximoSlam(hoy = new Date()) {
  const y = hoy.getUTCFullYear();
  for (const [nombre, m, d, re] of SLAMS) if (hoy <= new Date(Date.UTC(y, m - 1, d))) return { nombre, anio: y, re };
  const [nombre, , , re] = SLAMS[0];
  return { nombre, anio: y + 1, re };
}

// Mejor ronda de cada jugador en una edición cargada a mano (content/grand-slams.json)
function rondasDeEdicion(cuadro) {
  const r = new Map();
  const subir = (n, ronda) => { const k = clave(n); if (ORDEN.indexOf(ronda) > ORDEN.indexOf(r.get(k) ?? 'R128') || !r.has(k)) r.set(k, ronda); };
  for (const p of cuadro?.partidos || []) {
    const sig = p.ronda === 'F' ? 'W' : ORDEN[ORDEN.indexOf(p.ronda) + 1];
    subir(p.ganador.nombre, sig);
    subir(p.perdedor.nombre, p.ronda);
  }
  const rondasCargadas = new Set((cuadro?.partidos || []).map((p) => p.ronda));
  return { mapa: r, completo: rondasCargadas.has('R128') && rondasCargadas.size >= 7 };
}

// Ronda alcanzada en vivo, con los partidos que trae la API para ese torneo
function rondasEnVivo(partidos, re, tour) {
  const r = new Map();
  for (const p of Object.values(partidos)) {
    if (!re.test(p.torneo || '') || p.dobles || !p.rondaCod || (p.tour || '').replace(/_doubles$/, '') !== tour) continue;
    for (const lado of [1, 2]) {
      const j = lado === 1 ? p.j1 : p.j2; if (!j?.nombre) continue;
      let ronda = p.rondaCod;
      if (p.estado === 'finalizado' && p.ganador === lado) ronda = p.rondaCod === 'F' ? 'W' : ORDEN[ORDEN.indexOf(p.rondaCod) + 1];
      const k = clave(j.nombre), prev = r.get(k);
      const vivo = !(p.estado === 'finalizado' && p.ganador && p.ganador !== lado);
      if (!prev || ORDEN.indexOf(ronda) > ORDEN.indexOf(prev.ronda)) r.set(k, { ronda, vivo: vivo && ronda !== 'W' });
    }
  }
  return r;
}

export function tablaTopTen({ ranking, partidos, grandSlams, tour, hoy = new Date() }) {
  const slam = proximoSlam(hoy);
  const ediciones = (grandSlams?.torneos || []).filter((t) => t.nombre === slam.nombre && t.anio < slam.anio).sort((a, b) => b.anio - a.anio);
  const anterior = ediciones[0];
  const cuadro = anterior?.cuadros?.[tour === 'atp' ? 'masculino' : 'femenino'];
  const { mapa, completo } = rondasDeEdicion(cuadro);
  const vivo = rondasEnVivo(partidos, slam.re, tour);
  const P = PUNTOS[tour];
  const buscar = (m, nombre) => m.get(clave(nombre)) ?? [...m.entries()].find(([k]) => k.endsWith(apellidoClave(nombre)) && apellidoClave(nombre).length > 3)?.[1];

  const filas = ranking.slice(0, 30).map((j) => {
    const def = buscar(mapa, j.nombre);
    const defiende = def ? P[def] : (completo ? 0 : null);
    const enVivo = buscar(vivo, j.nombre);
    const piso = defiende == null ? null : j.puntos - defiende + (enVivo ? P[enVivo.ronda] : 0);
    return { ...j, rondaDefendida: def || (completo ? 'no jugó' : null), defiende, enVivo, piso };
  });
  const enJuego = filas.some((f) => f.enVivo);
  // Proyección: si es campeón, con el resto en su piso actual (mejor caso para el jugador)
  for (const f of filas.slice(0, 10)) {
    if (f.defiende == null || (enJuego && !f.enVivo?.vivo)) { f.siCampeon = null; continue; }
    const total = f.puntos - f.defiende + P.W;
    const otros = filas.filter((o) => o !== f).map((o) => o.piso ?? o.puntos);
    f.siCampeon = 1 + otros.filter((x) => x > total).length;
  }
  return { slam, anterior, completo, enJuego, filas: filas.slice(0, 10), puntosRonda: P };
}
