import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

export function leerJSON(rel, porDefecto) {
  const p = path.join(ROOT, rel);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return porDefecto; }
}

export function guardarJSON(rel, datos) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(datos, null, 1) + '\n');
}

export function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

// ---------- Textos en español ----------

const RONDAS = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos de final', R16: 'Octavos de final',
  R32: 'Ronda de 32', R64: 'Ronda de 64', R128: 'Primera ronda', RR: 'Fase de grupos',
  Q1: 'Clasificación (1ª ronda)', Q2: 'Clasificación (2ª ronda)', Q3: 'Clasificación (ronda final)'
};
const RONDAS_EN = { '1/16-finals': 'Ronda de 32', '1/8-finals': 'Octavos de final', '1/4-finals': 'Cuartos de final', '1/2-finals': 'Semifinal', 'final': 'Final', '1/32-finals': 'Ronda de 64', '1/64-finals': 'Ronda de 128' };
export const nombreRonda = (code, texto) => {
  if (RONDAS[code]) return RONDAS[code];
  const t = (texto || '').replace(/^.* - /, '').trim();
  return RONDAS_EN[t.toLowerCase()] || t;
};

const CATEGORIAS = {
  grand_slam: 'Grand Slam', atp_1000: 'Masters 1000', atp_500: 'ATP 500', atp_250: 'ATP 250',
  wta_1000: 'WTA 1000', wta_500: 'WTA 500', wta_250: 'WTA 250', wta_125: 'WTA 125',
  davis_cup: 'Copa Davis', bjk_cup: 'Billie Jean King Cup', united_cup: 'United Cup', laver_cup: 'Laver Cup',
  atp_finals: 'ATP Finals', wta_finals: 'WTA Finals'
};
export function nombreCategoria(tier, tourOriginal, torneo = '') {
  const tour = tourBase(tourOriginal) || tourOriginal;
  const t = (torneo || '').toLowerCase();
  if (t.includes('davis')) return 'Copa Davis';
  if (t.includes('billie jean')) return 'Billie Jean King Cup';
  if (t.includes('finals')) return tour === 'wta' ? 'WTA Finals' : 'ATP Finals';
  if (tier && CATEGORIAS[tier]) return CATEGORIAS[tier];
  if (tier && tier.startsWith('challenger_')) return 'Challenger ' + tier.split('_')[1];
  if (tour === 'challenger') return 'Challenger';
  if (tour === 'atp') return 'ATP';
  if (tour === 'wta') return 'WTA';
  if (tour === 'itf') return 'ITF';
  return '';
}

export const SUPERFICIES = { clay: 'polvo de ladrillo', hard: 'cemento', grass: 'césped', carpet: 'carpeta' };

const PAISES = {
  arg: 'Argentina', esp: 'España', ita: 'Italia', ger: 'Alemania', deu: 'Alemania', fra: 'Francia', usa: 'Estados Unidos',
  gbr: 'Gran Bretaña', srb: 'Serbia', rus: 'Rusia', bra: 'Brasil', chi: 'Chile', col: 'Colombia', uru: 'Uruguay',
  per: 'Perú', par: 'Paraguay', mex: 'México', ecu: 'Ecuador', bol: 'Bolivia', ven: 'Venezuela', can: 'Canadá',
  aus: 'Australia', nor: 'Noruega', den: 'Dinamarca', gre: 'Grecia', pol: 'Polonia', cze: 'República Checa',
  svk: 'Eslovaquia', cro: 'Croacia', bel: 'Bélgica', ned: 'Países Bajos', sui: 'Suiza', aut: 'Austria',
  por: 'Portugal', jpn: 'Japón', chn: 'China', kaz: 'Kazajistán', ukr: 'Ucrania', blr: 'Bielorrusia',
  bul: 'Bulgaria', hun: 'Hungría', rou: 'Rumania', tur: 'Turquía', fin: 'Finlandia', swe: 'Suecia',
  rsa: 'Sudáfrica', tun: 'Túnez', egy: 'Egipto', ind: 'India', kor: 'Corea del Sur', tpe: 'Taipéi',
  nzl: 'Nueva Zelanda', geo: 'Georgia', arm: 'Armenia', lat: 'Letonia', est: 'Estonia', ltu: 'Lituania',
  slo: 'Eslovenia', bih: 'Bosnia', mon: 'Mónaco', isr: 'Israel', tha: 'Tailandia', phi: 'Filipinas', ina: 'Indonesia',
  uzb: 'Uzbekistán', hkg: 'Hong Kong'
};
export const nombrePais = (c) => (c && PAISES[c.toLowerCase()]) || (c ? c.toUpperCase() : '');

// ---------- Marcadores ----------

// games: [[p1 set1, p1 set2...], [p2 set1, ...]]
export function sets(score) {
  if (!score || !Array.isArray(score.games) || score.games.length !== 2) return [];
  const [a, b] = score.games;
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] == null || b[i] == null) continue;
    out.push([a[i], b[i]]);
  }
  return out;
}

// Ganador: 1 o 2 según sets ganados (null si no se puede saber)
export function ganador(score) {
  if (!score || !Array.isArray(score.sets)) return null;
  const [s1, s2] = score.sets;
  if (s1 === s2) return null;
  return s1 > s2 ? 1 : 2;
}

// Marcador visto desde el ganador: "6-4 3-6 10-7"
export function marcadorTexto(score, desde = 1) {
  return sets(score).map(([x, y]) => (desde === 1 ? `${x}-${y}` : `${y}-${x}`)).join(' ');
}

export function slugify(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function apellido(nombre) {
  if (!nombre) return '';
  if (nombre.includes('/')) return nombre.split('/').map((x) => apellido(x.trim())).join(' / ');
  const partes = nombre.trim().split(/\s+/);
  return partes.length > 1 ? partes.slice(1).join(' ') : partes[0];
}

export function fechaArg(iso, opciones) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: CONFIG.sitio.zonaHoraria, ...opciones }).format(new Date(iso));
}

// "atp_doubles" -> "atp", "challenger_women" -> "challenger"; null/itf/utr -> null (no se muestran)
export function tourBase(tour) {
  if (!tour) return null;
  const b = tour.replace(/_doubles$/, '').replace(/_women$/, '');
  return ['atp', 'wta', 'challenger'].includes(b) ? b : null;
}
