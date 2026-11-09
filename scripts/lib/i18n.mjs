// Versión en inglés del sitio: traduce los textos fijos de la interfaz y reescribe los enlaces internos a /en/...
// Los textos de las notas no pasan por acá: se traducen aparte (scripts/traducir-notas.mjs) y se guardan en cada nota.

// Textos completos (se comparan sin espacios a los costados)
const EXACTO = {
  'Inicio': 'Home', 'Noticias': 'News', 'Resultados': 'Results', 'Torneos': 'Tournaments', 'Ranking': 'Rankings', 'Calendario': 'Calendar',
  'Argentinos': 'Argentines', 'Acerca del sitio': 'About', 'Créditos de imágenes': 'Image credits', 'Saltar al contenido': 'Skip to content',
  'Buscar en el sitio': 'Search the site', 'Buscar': 'Search', 'Buscador': 'Search', 'A Todo Tenis, inicio': 'A Todo Tenis, home',
  'Instagram de A Todo Tenis': 'A Todo Tenis on Instagram', 'Principal': 'Main', 'Pie': 'Footer', 'Idioma / Language': 'Language',
  'En la red desde 2007. Resultados, ranking y noticias de todo el circuito.': 'Online since 2007. Results, rankings and news from across the tour.',
  'Por definir': 'TBD', 'Resultado a confirmar': 'Result to be confirmed', 'Sin datos de este partido': 'No data for this match',
  'Octavos': 'R16', 'Cuartos': 'QF', 'Semis': 'SF', 'En juego': 'In progress', 'En vivo': 'Live', 'Próximos': 'Upcoming',
  'sin cambios': 'no change', 'subió': 'up', 'bajó': 'down', 'Campeón': 'Champion', 'Campeona': 'Champion', 'Finalizado': 'Completed',
  'Buscar jugador en el cuadro': 'Find a player in the draw', 'Buscar jugador…': 'Find a player…', 'Ir a la ronda': 'Go to round',
  'Tocá un jugador para ver su camino en el cuadro.': 'Tap a player to see their path through the draw.',
  'El cuadro se arma a medida que se juegan los partidos.': 'The draw fills in as matches are played.',
  'Cuadro': 'Draw', 'Cuadros': 'Draws', 'Etapa final': 'Knockout stage', 'Fase de grupos': 'Group stage', 'Retiro': 'Ret.',
  'Próximos partidos y en vivo': 'Upcoming and live matches', 'Próximos partidos': 'Upcoming matches', 'Más noticias': 'More news',
  'Crédito de la imagen:': 'Image credit:', 'licencia': 'license', 'Lo mejor del partido': 'Match highlights', 'Puntos': 'Points',
  'Jugador': 'Player', 'Jugadora': 'Player', 'Ver todos': 'See all', 'Anterior': 'Previous', 'Siguiente': 'Next',
  'Torneos y resultados': 'Tournaments and results', 'Ver todos los resultados →': 'All results →', 'Ranking A Todo Tenis': 'A Todo Tenis rankings',
  'Ranking completo →': 'Full rankings →', 'Un día como hoy': 'On this day', 'Torneos en juego': 'Tournaments in progress',
  'Tu marca acá': 'Your brand here', 'Espacios publicitarios': 'Advertising', 'Próximos torneos': 'Upcoming tournaments',
  'Calendario 2027 →': '2027 calendar →', 'Calendario 2027': '2027 calendar', 'Clasificados': 'Qualified', 'Grupo 1': 'Group 1', 'Grupo 2': 'Group 2',
  'Partidos ganados y perdidos en la fase de grupos. Avanzan las dos primeras de cada grupo.': 'Matches won and lost in the group stage. The top two in each group advance.',
  'Terminados recientemente': 'Recently completed', 'No hay torneos en juego en este momento.': 'No tournaments in progress right now.',
  'Cuadros interactivos, resultados y campeones de cada torneo del circuito.': 'Interactive draws, results and champions from every tournament on the tour.',
  'Cuadros interactivos, campeones y resultados de los torneos ATP, WTA y Challenger.': 'Interactive draws, champions and results from ATP, WTA and Challenger tournaments.',
  'Australian Open, Roland Garros, Wimbledon y US Open: campeones, finales y cuadros.': 'Australian Open, Roland Garros, Wimbledon and US Open: champions, finals and draws.',
  'Los cuatro Grand Slam de la temporada: campeones, finales y cuadros completos.': "The season's four Grand Slams: champions, finals and full draws.",
  'Lo que cada uno sumó en la edición anterior y que pierde del ranking al terminar el torneo. "Si es campeón" muestra el puesto al que llegaría ganando el título, con el resto en los puntos que ya tiene asegurados.': 'What each player earned at last year\'s edition and drops from the rankings when the tournament ends. "If champion" shows the ranking they would reach by winning the title, with everyone else on the points already secured.',
  'Puntos por ronda: ATP (Media Guide 2025) y WTA (tabla de puntos 2026). Ranking y puntos actuales: Live Tennis API.': 'Points per round: ATP (2025 Media Guide) and WTA (2026 points table). Current rankings and points: Live Tennis API.',
  'Si es campeón': 'If champion', 'Defiende': 'Defending', 'Ronda actual': 'Current round', 'Ronda anterior': 'Previous round', '(eliminado)': '(out)', 'no jugó': 'did not play',
  'Singles masculino': "Men's singles", 'Singles femenino': "Women's singles", 'Dobles masculino': "Men's doubles", 'Dobles femenino': "Women's doubles",
  'Singles': 'Singles', 'Dobles': 'Doubles', 'Sin datos todavía': 'No data yet', 'Sin datos.': 'No data.',
  'El cuadro completo de esta edición se publica próximamente. Por ahora se muestra la final.': 'The full draw for this edition is coming soon. For now, only the final is shown.',
  'Fuentes: sitios oficiales de ATP, WTA y del torneo.': 'Sources: official ATP, WTA and tournament websites.',
  'Grand Slam, Masters y WTA 1000, Finals y competencias por equipos. Fuente: calendarios oficiales de la ATP y la WTA. Sujeto a cambios.': 'Grand Slams, Masters and WTA 1000 events, Finals and team competitions. Source: official ATP and WTA calendars. Subject to change.',
  'Calendario 2027 del circuito ATP y WTA: Grand Slam, Masters 1000, WTA 1000, Finals y Copa Davis.': '2027 ATP and WTA calendar: Grand Slams, Masters 1000, WTA 1000, Finals and Davis Cup.',
  'Resultados y partidos en vivo': 'Results and live matches', 'Resultados del día, partidos en vivo y próximos partidos del circuito ATP, WTA y Challenger.': "Today's results, live matches and upcoming matches on the ATP, WTA and Challenger tours.",
  'Ranking ATP y WTA': 'ATP and WTA rankings', 'Ranking ATP y WTA actualizado.': 'Latest ATP and WTA rankings.',
  'Fotos de los jugadores: Wikimedia Commons, con licencia libre (': 'Player photos: Wikimedia Commons, freely licensed (', 'ver créditos': 'see credits',
  'Argentinos en el circuito': 'Argentines on tour', 'Mejores rankeados': 'Top ranked', 'Notas': 'Stories', 'Sin partidos por ahora.': 'No matches for now.',
  'Sin argentinas entre las primeras del listado.': 'No Argentine women near the top of the list.',
  'Acerca de A Todo Tenis': 'About A Todo Tenis', 'Página no encontrada': 'Page not found', 'Esta pelota se fue afuera': 'That ball went out',
  'La página que buscás no existe.': "The page you're looking for doesn't exist.", 'Volver al inicio': 'Back to home',
  'Las fotos de los jugadores provienen de Wikimedia Commons y se publican bajo las licencias libres indicadas, con el crédito de su autor.': 'Player photos come from Wikimedia Commons and are published under the free licenses shown, credited to their authors.',
  'Todavía no hay fotos cargadas.': 'No photos yet.', 'Todavía no hay notas publicadas.': 'No stories published yet.',
  'No hay partidos programados por ahora.': 'No matches scheduled for now.', 'Partidos': 'Matches', 'Torneo': 'Tournament',
  'Último campeón registrado': 'Last recorded champion', 'Por equipos': 'Team event', 'Highlights del partido': 'Match highlights',
  'Foto de Getty Images': 'Getty Images photo', 'Crédito de la imagen: Getty Images': 'Image credit: Getty Images', 'A confirmar': 'TBC',
  'Todo el tenis, en un solo lugar': 'All the tennis, in one place', 'Destacadas': 'Top stories',
  'Resultados, ranking y noticias del circuito ATP, WTA, Challenger, Copa Davis y Billie Jean King Cup.': 'Results, rankings and news from the ATP, WTA and Challenger tours, the Davis Cup and the Billie Jean King Cup.',
  'Todos los resultados del circuito': 'All the results from the tour', 'Cuadros de cada torneo': 'Every tournament draw', 'Los cuatro Grand Slam': 'The four Grand Slams',
  'A Todo Tenis | Todo el tenis': 'A Todo Tenis | All the tennis', 'Todo el tenis': 'All the tennis', 'Cancelado': 'Cancelled', 'Suspendido': 'Suspended'
};

// Frases dentro de textos más largos (se reemplazan de la más larga a la más corta)
const FRASES = {
  'Estados Unidos': 'United States', 'Gran Bretaña': 'Great Britain', 'República Checa': 'Czech Republic', 'España': 'Spain', 'Japón': 'Japan',
  'Canadá': 'Canada', 'Bélgica': 'Belgium', 'Países Bajos': 'Netherlands', 'Kazajistán': 'Kazakhstan', 'Perú': 'Peru', 'Hungría': 'Hungary',
  'Taipéi': 'Taipei', 'Uzbekistán': 'Uzbekistan', 'Turquía': 'Turkey', 'Sudáfrica': 'South Africa', 'México': 'Mexico', 'Túnez': 'Tunisia',
  'Costa de Marfil': "Côte d'Ivoire", 'Mónaco': 'Monaco', 'Corea del Sur': 'South Korea', 'Francia': 'France', 'Italia': 'Italy', 'Alemania': 'Germany',
  'Australia': 'Australia', 'Suiza': 'Switzerland', 'Brasil': 'Brazil', 'Rusia': 'Russia', 'Ucrania': 'Ukraine', 'Grecia': 'Greece', 'Polonia': 'Poland',
  'Noruega': 'Norway', 'Dinamarca': 'Denmark', 'Suecia': 'Sweden', 'Finlandia': 'Finland', 'Croacia': 'Croatia', 'Rumania': 'Romania',
  'Eslovaquia': 'Slovakia', 'Eslovenia': 'Slovenia', 'Bielorrusia': 'Belarus', 'Nueva Zelanda': 'New Zealand', 'Arabia Saudita': 'Saudi Arabia',
  'Emiratos Árabes': 'United Arab Emirates', 'Marruecos': 'Morocco', 'Egipto': 'Egypt', 'Filipinas': 'Philippines', 'Tailandia': 'Thailand',
  'París': 'Paris', 'Londres': 'London', 'Nueva York': 'New York', 'Turín': 'Turin', 'Roma': 'Rome', 'Pekín': 'Beijing', 'Shanghái': 'Shanghai',
  'Dubái': 'Dubai', 'Sídney': 'Sydney', 'Montecarlo': 'Monte Carlo', 'Estocolmo': 'Stockholm', 'Viena': 'Vienna', 'Basilea': 'Basel', 'Riad': 'Riyadh',
  'Hamburgo': 'Hamburg', 'Múnich': 'Munich', 'Ginebra': 'Geneva', 'Atenas': 'Athens', 'Bruselas': 'Brussels', 'Tokio': 'Tokyo', 'Róterdam': 'Rotterdam',
  'Marsella': 'Marseille', 'Seúl': 'Seoul', 'Ciudad de México': 'Mexico City', 'San Pablo': 'São Paulo', 'Bogotá': 'Bogotá', 'Estrasburgo': 'Strasbourg',
  'Varsovia': 'Warsaw', 'Praga': 'Prague', 'Florencia': 'Florence', 'Nápoles': 'Naples', 'Milán': 'Milan', 'Lisboa': 'Lisbon', 'Copenhague': 'Copenhagen', 'Amberes': 'Antwerp',
  'Abierto de Australia': 'Australian Open', 'Masters de Canadá': 'Canadian Open', 'Masters de Shanghái': 'Shanghai Masters', 'Masters de París': 'Paris Masters',
  'WTA 1000 de Canadá': 'Canadian Open (WTA 1000)', 'Finales de la Copa Davis': 'Davis Cup Finals', 'Copa Davis': 'Davis Cup', 'Por equipos': 'Team event',
  'Perth y Sídney': 'Perth and Sydney', 'polvo de ladrillo': 'clay', 'cemento': 'hard court', 'césped': 'grass', 'bajo techo': 'indoor',
  ', vía Wikimedia Commons': ', via Wikimedia Commons', 'Grupo John McEnroe': 'John McEnroe Group', 'Grupo Ivan Lendl': 'Ivan Lendl Group',
  'Temporada': 'Season', 'Ronda de 32': 'Round of 32', 'Ronda de 64': 'Round of 64', 'Ronda de 128': 'Round of 128', 'Octavos de final': 'Round of 16',
  'Cuartos de final': 'Quarterfinal', 'Fase de grupos': 'Group stage', 'Primera ronda': 'First round', 'Semifinal': 'Semifinal', 'Clasificación': 'Qualifying',
  'Campeón': 'Champion', 'Campeona': 'Champion', 'Ronda': 'Round', 'Reproducir': 'Play', 'Foto': 'Photo', 'por retiro': 'retirement', 'Final: venció a': 'Final: beat'
};
const MESES = { enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July', agosto: 'August', septiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December' };
const M = Object.keys(MESES).join('|');

const REGLAS = [
  [/ \| A Todo Tenis$/, ' | A Todo Tenis'],
  [/^(.+) (\d{4}): campeones, finales y cuadro$/, '$1 $2: champions, finals and draw'],
  [/^(.+) (\d{4}) \((.+)\): campeones, resultados de las finales y cuadro completo\.$/, '$1 $2 ($3): champions, final results and full draw.'],
  [/^Puntos que defiende el Top Ten en el (.+)$/, 'Points the Top 10 are defending at the $1'],
  [/^Ronda (\d{4})$/, '$1 round'], [/^Campeón (\d{4})$/, '$1 champion'], [/^Campeón(a)? (\d{4})$/, '$2 champion'],
  [/^Temporada (\d{4})$/, '$1 season'], [/^Finals (\d{4})$/, 'Finals $1'],
  [/^Por ahora solo está cargada la final de la edición (\S+): los puntos de los demás jugadores se completan al cargar el cuadro entero\.$/, 'Only the $1 final is loaded so far: the other players\' points will be filled in once the full draw is added.'],
  [new RegExp(`^(\\d{1,2}) de (${M}) al (\\d{1,2}) de (${M}) de (\\d{4})$`), (_, a, m1, b, m2, y) => `${MESES[m1]} ${a} – ${MESES[m2]} ${b}, ${y}`],
  [new RegExp(`foto del (\\d{1,2}) de (${M}) de (\\d{4})`, 'g'), (_, d, m, y) => `photo from ${MESES[m]} ${d}, ${y}`],
  [/^Se conoce el día de la final · hoy: (.+)\.$/, (_, r) => `Decided on finals day · today: ${tr(r)}.`],
  [/^Se conoce el día de la final\.$/, 'Decided on finals day.'],
  [/^Video: (.+) en YouTube$/, 'Video: $1 on YouTube'],
  [/^(.+), en declaraciones publicadas por$/, '$1, as published by'],
  [/^Masters 1000 · (.+)$/, (_, c) => `Masters 1000 · ${tr(c)}`],
  [/\bN° (\d+)/g, 'No. $1']
];

const ESCAPES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const desc = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ESCAPES[m]);
const enc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FR = Object.entries(FRASES).sort((a, b) => b[0].length - a[0].length)
  .map(([es, en]) => [new RegExp(`(^|[^\\p{L}])${es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'gu'), en]);

export function tr(texto) {
  const t = texto.trim();
  if (!t) return texto;
  if (EXACTO[t] !== undefined) return texto.replace(t, EXACTO[t]);
  if (t.includes(' | ')) return texto.replace(t, t.split(' | ').map(tr).join(' | '));
  if (/^[^·]+( · [^·]+)+$/.test(t) && t.split(' · ').some((x) => EXACTO[x.trim()] !== undefined)) return texto.replace(t, t.split(' · ').map(tr).join(' · '));
  let s = t;
  for (const [re, en] of REGLAS) s = s.replace(re, en);
  for (const [re, en] of FR) s = s.replace(re, (_, pre) => pre + en);
  return texto.replace(t, s);
}

const ASSET = /^\/(estilos\.css|rss\.xml|banderas\/|_vercel\/|en(\/|$))/;
export function traducirHTML(html) {
  // 1) Separar scripts y estilos: no se tocan
  const guardados = [];
  html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, (m) => { guardados.push(m); return `\u0000${guardados.length - 1}\u0000`; });
  // 2) Enlaces internos -> /en (salvo archivos y el selector de idioma)
  html = html.replace(/<(a|form)\b[^>]*>/g, (tag) => {
    if (/\sdata-lang\b/.test(tag)) return tag;
    return tag.replace(/\s(href|action)="(\/[^"]*)"/g, (m, attr, url) => ASSET.test(url) ? m : ` ${attr}="/en${url === '/' ? '' : url}"`);
  });
  // 3) Atributos con texto visible o leído por lectores de pantalla
  html = html.replace(/\s(aria-label|title|placeholder|alt)="([^"]*)"/g, (m, a, v) => ` ${a}="${enc(tr(desc(v)))}"`);
  html = html.replace(/(<meta (?:name="description"|property="og:(?:title|description)") content=")([^"]*)"/g, (m, a, v) => `${a}${enc(tr(desc(v)))}"`);
  // 4) Texto entre etiquetas
  html = html.replace(/>([^<>\u0000]+)</g, (m, txt) => `>${enc(tr(desc(txt)))}<`);
  // 5) Volver a poner los scripts
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[+i]);
}
