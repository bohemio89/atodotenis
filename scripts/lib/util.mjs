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

// ---------- Textos en español (o inglés si SITIO_LANG=en) ----------
export const LANG = process.env.SITIO_LANG === 'en' ? 'en' : 'es';
export const LOCALE = LANG === 'en' ? 'en-US' : 'es-AR';

const RONDAS = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos de final', R16: 'Octavos de final',
  R32: 'Ronda de 32', R64: 'Ronda de 64', R128: 'Primera ronda', RR: 'Fase de grupos',
  Q1: 'Clasificación (1ª ronda)', Q2: 'Clasificación (2ª ronda)', Q3: 'Clasificación (ronda final)'
};
const RONDAS_EN = { '1/16-finals': 'Ronda de 32', '1/8-finals': 'Octavos de final', '1/4-finals': 'Cuartos de final', '1/2-finals': 'Semifinal', 'final': 'Final', '1/32-finals': 'Ronda de 64', '1/64-finals': 'Ronda de 128' };
const RONDAS_I = {
  F: 'Final', SF: 'Semifinal', QF: 'Quarterfinal', R16: 'Round of 16', R32: 'Round of 32', R64: 'Round of 64', R128: 'First round', RR: 'Group stage',
  Q1: 'Qualifying (1st round)', Q2: 'Qualifying (2nd round)', Q3: 'Qualifying (final round)'
};
const RONDAS_TXT_I = { '1/16-finals': 'Round of 32', '1/8-finals': 'Round of 16', '1/4-finals': 'Quarterfinal', '1/2-finals': 'Semifinal', 'final': 'Final', '1/32-finals': 'Round of 64', '1/64-finals': 'Round of 128' };
export const nombreRonda = (code, texto) => {
  if (LANG === 'en') { if (RONDAS_I[code]) return RONDAS_I[code]; const t = (texto || '').replace(/^.* - /, '').trim(); return RONDAS_TXT_I[t.toLowerCase()] || t; }
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
  if (t.includes('davis')) return LANG === 'en' ? 'Davis Cup' : 'Copa Davis';
  if (t.includes('billie jean')) return 'Billie Jean King Cup';
  if (t.includes('finals')) return tour === 'wta' ? 'WTA Finals' : 'ATP Finals';
  if (tier && CATEGORIAS[tier]) return LANG === 'en' && tier === 'davis_cup' ? 'Davis Cup' : CATEGORIAS[tier];
  if (tier && tier.startsWith('challenger_')) return 'Challenger ' + tier.split('_')[1];
  if (tour === 'challenger') return 'Challenger';
  if (tour === 'atp') return 'ATP';
  if (tour === 'wta') return 'WTA';
  if (tour === 'itf') return 'ITF';
  return '';
}

export const SUPERFICIES = LANG === 'en' ? { clay: 'clay', hard: 'hard court', grass: 'grass', carpet: 'carpet' } : { clay: 'polvo de ladrillo', hard: 'cemento', grass: 'césped', carpet: 'carpeta' };

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
  uzb: 'Uzbekistán', hkg: 'Hong Kong', and: 'Andorra', lux: 'Luxemburgo', mar: 'Marruecos', mlt: 'Malta', tai: 'Taipéi', irl: 'Irlanda', mda: 'Moldavia', cyp: 'Chipre', dom: 'República Dominicana', pur: 'Puerto Rico', ksa: 'Arabia Saudita', uae: 'Emiratos Árabes', vie: 'Vietnam', mas: 'Malasia', sgp: 'Singapur', lbn: 'Líbano', jam: 'Jamaica', crc: 'Costa Rica', gua: 'Guatemala', esa: 'El Salvador', cub: 'Cuba', bar: 'Barbados', mkd: 'Macedonia del Norte', mne: 'Montenegro', alb: 'Albania', isl: 'Islandia', lie: 'Liechtenstein', irn: 'Irán', iri: 'Irán', pak: 'Pakistán', sri: 'Sri Lanka', nga: 'Nigeria', ken: 'Kenia', zim: 'Zimbabue', sen: 'Senegal', civ: 'Costa de Marfil', alg: 'Argelia'
};
const REGION_EN = new Intl.DisplayNames(['en'], { type: 'region' });
export const nombrePais = (c) => {
  if (LANG === 'en' && c) { const iso = IOC_ISO2[c.toLowerCase()]; try { if (iso) return REGION_EN.of(iso.toUpperCase()); } catch {} }
  return (c && PAISES[c.toLowerCase()]) || (c ? c.toUpperCase() : '');
};

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
  const tb = score?.tiebreaks ?? score?.tieBreaks ?? score?.tie_breaks ?? score?.tiebreak_scores ?? score?.tiebreakScores ?? [];
  const valores = sets(score).map(([x, y], i) => {
    const a = desde === 1 ? x : y, b = desde === 1 ? y : x;
    let puntos = Array.isArray(tb) ? tb[i] : (tb && typeof tb === 'object' ? (tb[i] ?? tb[String(i + 1)]) : null);
    if (puntos && typeof puntos === 'object') {
      const p1 = Number(puntos.p1 ?? puntos.player1 ?? puntos[0]);
      const p2 = Number(puntos.p2 ?? puntos.player2 ?? puntos[1]);
      const ganadorSet = x > y ? 1 : 2;
      const puntosGanador = (desde === 1 ? ganadorSet === 1 : ganadorSet === 2) ? p1 : p2;
      puntos = Number.isFinite(puntosGanador) ? puntosGanador : null;
    } else puntos = Number(puntos);
    const desempate = (a === 7 && b === 6) && Number.isFinite(puntos) && puntos > 0 ? ` (${puntos})` : '';
    return `${a}-${b}${desempate}`;
  });
  return valores.length < 2 ? valores.join('') : `${valores.slice(0, -1).join(', ')} y ${valores.at(-1)}`;
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
  return new Intl.DateTimeFormat(LOCALE, { timeZone: CONFIG.sitio.zonaHoraria, ...opciones }).format(new Date(iso));
}

// "atp_doubles" -> "atp", "challenger_women" -> "challenger"; null/itf/utr -> null (no se muestran)
export function tourBase(tour) {
  if (!tour) return null;
  const b = tour.replace(/_doubles$/, '').replace(/_women$/, '');
  return ['atp', 'wta', 'challenger'].includes(b) ? b : null;
}

const CIUDADES = { Paris: 'París', London: 'Londres', Rome: 'Roma', Beijing: 'Pekín', Shanghai: 'Shanghái', Vienna: 'Viena', Basel: 'Basilea',
  Turin: 'Turín', Riyadh: 'Riad', 'Monte Carlo': 'Montecarlo', Hamburg: 'Hamburgo', Munich: 'Múnich', Geneva: 'Ginebra', Stockholm: 'Estocolmo',
  Athens: 'Atenas', Brussels: 'Bruselas', Tokyo: 'Tokio', Dubai: 'Dubái', Rotterdam: 'Róterdam', Marseille: 'Marsella', Moscow: 'Moscú',
  Seoul: 'Seúl', Mexico: 'México', 'Mexico City': 'Ciudad de México', Cordoba: 'Córdoba', 'Villa Maria': 'Villa María', 'Sao Paulo': 'San Pablo',
  'Costa do Sauipe': 'Costa do Sauípe', Bogota: 'Bogotá', Lyon: 'Lyon', Strasbourg: 'Estrasburgo', Warsaw: 'Varsovia', Prague: 'Praga',
  Florence: 'Florencia', Naples: 'Nápoles', Milan: 'Milán', Lisbon: 'Lisboa', Copenhagen: 'Copenhague', Helsinki: 'Helsinki', Antwerp: 'Amberes',
  'Finals - Riyadh': 'WTA Finals', 'Finals - Turin': 'ATP Finals' };
export function nombreTorneo(t) {
  if (!t) return '';
  const limpio = t.trim().replace(/\s*\([A-Za-z ]+\)(?=\s*(-|$))/, '');
  if (LANG === 'en') return /^Finals - Riyadh$/.test(limpio) ? 'WTA Finals' : /^Finals - Turin$/.test(limpio) ? 'ATP Finals' : limpio;
  if (CIUDADES[limpio]) return CIUDADES[limpio];
  return limpio.split(/(\s+\d+$)/)[0] in CIUDADES ? CIUDADES[limpio.split(/(\s+\d+$)/)[0]] + limpio.slice(limpio.split(/(\s+\d+$)/)[0].length) : limpio;
}

// Código de país del circuito (IOC) -> ISO 3166 de 2 letras (para la bandera)
export const IOC_ISO2 = {
  afg:'af', alb:'al', alg:'dz', and:'ad', ang:'ao', arg:'ar', arm:'am', aus:'au', aut:'at', aze:'az', bah:'bs', bar:'bb', bel:'be',
  ben:'bj', ber:'bm', bih:'ba', bol:'bo', bot:'bw', bra:'br', bul:'bg', bur:'bf', can:'ca', chi:'cl', chn:'cn', civ:'ci', cmr:'cm',
  col:'co', crc:'cr', cro:'hr', cub:'cu', cyp:'cy', cze:'cz', den:'dk', dom:'do', ecu:'ec', egy:'eg', esa:'sv', esp:'es', est:'ee',
  fin:'fi', fra:'fr', gbr:'gb', geo:'ge', ger:'de', gha:'gh', gre:'gr', gua:'gt', hkg:'hk', hon:'hn', hun:'hu', ina:'id', ind:'in',
  irl:'ie', iri:'ir', irq:'iq', isl:'is', isr:'il', ita:'it', jam:'jm', jor:'jo', jpn:'jp', kaz:'kz', ken:'ke', kgz:'kg', kor:'kr',
  ksa:'sa', kuw:'kw', lat:'lv', lbn:'lb', lie:'li', ltu:'lt', lux:'lu', mad:'mg', mar:'ma', mas:'my', mda:'md', mex:'mx', mkd:'mk',
  mlt:'mt', mne:'me', mon:'mc', mgl:'mn', ned:'nl', nga:'ng', nor:'no', nzl:'nz', pak:'pk', pan:'pa', par:'py', per:'pe', phi:'ph',
  pol:'pl', por:'pt', pur:'pr', qat:'qa', rou:'ro', rsa:'za', sen:'sn', sgp:'sg', slo:'si', srb:'rs', sri:'lk', sui:'ch', svk:'sk',
  swe:'se', syr:'sy', tai:'tw', tpe:'tw', tha:'th', tjk:'tj', tkm:'tm', tog:'tg', tun:'tn', tur:'tr', uae:'ae', uga:'ug', ukr:'ua',
  uru:'uy', usa:'us', uzb:'uz', ven:'ve', rus:'ru', blr:'by', vie:'vn', zim:'zw', deu:'de', nmi:'mp', pr:'pr'
};
// Jugadores que compiten sin bandera (atletas neutrales)
export const NEUTRALES = new Set(['wor']);
