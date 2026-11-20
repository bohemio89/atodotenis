// Redactor: escribe notas con Gemini a partir de resultados reales confirmados.
// Nunca inventa: solo usa los datos del partido y valida que los números del texto existan en los datos.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  CONFIG, ROOT, leerJSON, guardarJSON, log, nombreRonda, nombreCategoria, SUPERFICIES,
  nombrePais, sets, marcadorTexto, slugify, apellido, fechaArg, nombreTorneo, conGrafia
} from './lib/util.mjs';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.log('Sin GEMINI_API_KEY: no se escriben notas en esta corrida.'); process.exit(0); }

const partidos = leerJSON('data/partidos.json', {});
const registro = leerJSON('data/notas-registro.json', {}); // partidoId -> slug | 'descartada'
const TORNEOS = leerJSON('data/torneos.json', {});
const PARTIDOS_TODOS = leerJSON('data/partidos.json', {});

// Datos del partido que usa la placa gráfica de la nota (nombres, países, ranking, sets desde el ganador)
function resultadoParaNota(p) {
  if (!p?.ganador || !p.score) return null;
  const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
  const jug = (j) => ({ nombre: j?.nombre || '', pais: j?.pais || '', ranking: j?.ranking || null });
  const gs = p.score.games || [[], []];
  const setsG = (gs[0] || []).map((x, i) => p.ganador === 1 ? [x, gs[1][i]] : [gs[1][i], x]).filter(([a, b]) => a != null && b != null);
  return { ganador: jug(g), perdedor: jug(pe), sets: setsG, tieBreaks: p.score.tiebreaks ?? p.score.tieBreaks ?? p.score.tie_breaks ?? p.score.tiebreak_scores ?? p.score.tiebreakScores ?? null, ronda: p.rondaCod || null, resultado: p.resultado || null };
}
for (const f of fs.readdirSync(path.join(ROOT, 'content/notas')).filter((x) => x.endsWith('.json'))) {
  const ruta = path.join(ROOT, 'content/notas', f);
  const n = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  if (n.resultado || !n.partidoId) continue;
  const r = resultadoParaNota(PARTIDOS_TODOS[n.partidoId]);
  if (r) { n.resultado = r; fs.writeFileSync(ruta, JSON.stringify(n, null, 1) + '\n'); }
}
const N = CONFIG.notas;

// Modo prueba: PRUEBA_PARTIDOS="id1,id2" escribe notas de esos partidos sin publicarlas
const PRUEBA = (process.env.PRUEBA_PARTIDOS || '').split(',').map((x) => x.trim()).filter(Boolean);
// ---------- Importancia y tope por jornada ----------
// Máximo de notas automáticas por jornada (día del partido, hora de Argentina); quedan las más importantes.
const MAX_JORNADA = N.maxNotasPorJornada || 5;
// Solo duelos significativos: cuartos de Masters/WTA 1000, Grand Slam desde octavos, Finals, finales de 500 y grandes sorpresas
const MIN_IMPORTANCIA = N.importanciaMinima || 60;
const jornadaDe = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const BASE_RONDA = {
  grand_slam: { F: 100, SF: 90, QF: 80, R16: 68, R32: 55 },
  finals: { F: 95, SF: 85, RR: 65 },
  atp_1000: { F: 85, SF: 75, QF: 65, R16: 52 }, wta_1000: { F: 85, SF: 75, QF: 65, R16: 52 },
  atp_500: { F: 65, SF: 52, QF: 42 }, wta_500: { F: 65, SF: 52, QF: 42 },
  otros: { F: 50, SF: 38 }
};
function importancia(p) {
  const t = String(p.tier || ''), r = p.rondaCod || '';
  const tabla = /finals/.test(t) || /finals/i.test(p.torneo || '') ? BASE_RONDA.finals : BASE_RONDA[t] || (/davis|bjk|billie/i.test(p.torneo || '') ? { F: 70, SF: 60, QF: 58, RR: 55 } : BASE_RONDA.otros);
  let v = tabla[r || (tabla === BASE_RONDA.finals ? 'RR' : '')] ?? 30;
  const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
  const rg = g?.ranking || 999, rp = pe?.ranking || 999;
  if (rp <= 3) v += 20;                       // cae un top 3
  else if (rp <= 10 && rg > 30) v += 25;      // batacazo grande
  else if (rp <= 20 && rg - rp >= 40) v += 15; // sorpresa
  if (rg <= 5 && r === 'F') v += 5;           // final con una figura
  if (p.dobles) v -= 25;
  return v;
}
// Notas automáticas ya escritas, agrupadas por jornada
const NOTAS_DIR = path.join(ROOT, 'content/notas');
const leerNotas = () => fs.readdirSync(NOTAS_DIR).filter((x) => x.endsWith('.json')).map((f) => ({ f, n: JSON.parse(fs.readFileSync(path.join(NOTAS_DIR, f), 'utf8')) }));
function importanciaNota(n) {
  const p = partidos[n.partidoId];
  if (p) return importancia(p);
  return typeof n.importancia === 'number' ? n.importancia : 40;
}
// Deja publicadas solo las MAX_JORNADA más importantes de cada jornada; el resto queda archivado (no se muestra)
function curarJornadas() {
  const grupos = {};
  for (const x of leerNotas()) {
    if (x.n.manual || !['publicada', 'archivada'].includes(x.n.estado) || !x.n.fechaPartido) continue;
    (grupos[jornadaDe(x.n.fechaPartido)] ||= []).push(x);
  }
  for (const [dia, lista] of Object.entries(grupos)) {
    lista.sort((a, b) => importanciaNota(b.n) - importanciaNota(a.n) || String(a.n.fecha).localeCompare(String(b.n.fecha)));
    lista.forEach((x, i) => {
      const estado = i < MAX_JORNADA ? 'publicada' : 'archivada';
      x.n.importancia = importanciaNota(x.n);
      if (x.n.estado !== estado || !('importancia' in x.n)) log(`Jornada ${dia}: "${x.n.titulo}" → ${estado}`);
      x.n.estado = estado;
      fs.writeFileSync(path.join(NOTAS_DIR, x.f), JSON.stringify(x.n, null, 1) + '\n');
    });
  }
}
// Para no gastar escritura en partidos que no entrarían entre los 5 de su jornada
function entraEnJornada(p) {
  const dia = jornadaDe(p.horario);
  const vals = leerNotas().filter((x) => !x.n.manual && ['publicada', 'archivada'].includes(x.n.estado) && x.n.fechaPartido && jornadaDe(x.n.fechaPartido) === dia).map((x) => importanciaNota(x.n)).sort((a, b) => b - a);
  return vals.length < MAX_JORNADA || importancia(p) > vals[MAX_JORNADA - 1];
}

const candidatos = Object.values(partidos)
  .filter((p) => PRUEBA.length
    ? PRUEBA.includes(String(p.id)) && p.confirmado && p.ganador
    : p.importante && importancia(p) >= MIN_IMPORTANCIA && p.confirmado && p.estado === 'finalizado' && p.ganador && !registro[p.id] && Date.now() - new Date(p.horario).getTime() < 60 * 3600e3)
  .sort((a, b) => importancia(b) - importancia(a) || String(b.horario).localeCompare(String(a.horario)))
  .slice(0, N.maxNotasPorCorrida);

function datosDelPartido(p) {
  const g = p.ganador === 1 ? p.j1 : p.j2;
  const pe = p.ganador === 1 ? p.j2 : p.j1;
  const jugador = (j) => ({
    nombre: j.nombre, pais: nombrePais(j.pais), ranking: j.ranking ?? 'sin dato'
  });
  // otros resultados del mismo torneo ese día: solo los más relevantes (caídas de favoritos primero)
  const dia = (p.horario || '').slice(0, 10);
  const relevancia = (o) => { const og = o.ganador === 1 ? o.j1 : o.j2, op = o.ganador === 1 ? o.j2 : o.j1; return Math.min(op?.ranking || 999, og?.ranking || 999) - ((op?.ranking || 999) < (og?.ranking || 999) ? 50 : 0); };
  const contexto = Object.values(partidos)
    .filter((o) => o.id !== p.id && o.torneo === p.torneo && o.confirmado && o.ganador && !o.dobles && (o.horario || '').slice(0, 10) === dia)
    .sort((x, y) => relevancia(x) - relevancia(y))
    .slice(0, 2)
    .map((o) => {
      const og = o.ganador === 1 ? o.j1 : o.j2, op = o.ganador === 1 ? o.j2 : o.j1;
      return `${og.nombre} (ranking ${og.ranking ?? 's/d'}) venció a ${op.nombre} (ranking ${op.ranking ?? 's/d'}) ${marcadorTexto(o.score, o.ganador)}`;
    });
  const rg = g.ranking || 9999, rp = pe.ranking || 9999;
  const sorpresa = rp < rg && (rg - rp >= 20 || (rp <= 10 && rg > 20)) ? (rg - rp >= 50 || rp <= 5 ? 'grande' : 'moderada') : 'no';
  const sv = sets(p.score).map(([a, b]) => (p.ganador === 1 ? [a, b] : [b, a]));
  const desarrollo = sv.map(([a, b], i) => `set ${i + 1}: lo ganó ${a > b ? g.nombre : pe.nombre} ${Math.max(a, b)}-${Math.min(a, b)}${(a === 7 && b === 6) || (a === 6 && b === 7) ? ' (tie-break)' : ''}${i === 2 && Math.max(a, b) >= 10 ? ' (super tie-break)' : ''}`);
  // próximo rival del ganador, si ya figura en el calendario
  const proximo = Object.values(partidos).find((o) => o.estado === 'programado' && o.torneo === p.torneo &&
    [o.j1?.id, o.j2?.id].includes(g.id));
  const rival = proximo && (proximo.j1?.id === g.id ? proximo.j2 : proximo.j1);
  const anio = Number((p.horario || '').slice(0, 4)) || new Date().getFullYear();
  const catalogo = TORNEOS[`${(p.tour || '').replace(/_doubles$/, '')}|${(p.torneo || '').trim()}`];
  const defensor = catalogo?.campeones?.[anio - 1]?.[p.dobles ? 'dobles' : 'singles']?.campeon;
  // recorrido de cada jugador en este torneo (partidos anteriores confirmados)
  const recorrido = (j) => Object.values(partidos)
    .filter((o) => o.id !== p.id && o.torneo === p.torneo && o.confirmado && o.ganador && !o.dobles && [o.j1?.id, o.j2?.id].includes(j.id) && (o.horario || '') < (p.horario || ''))
    .sort((x, y) => String(x.horario).localeCompare(String(y.horario)))
    .map((o) => {
      const gano = (o.ganador === 1 ? o.j1 : o.j2)?.id === j.id;
      const rival = o.j1?.id === j.id ? o.j2 : o.j1;
      return `${nombreRonda(o.rondaCod, o.ronda)}: ${gano ? 'venció a' : 'perdió con'} ${rival?.nombre} (ranking ${rival?.ranking ?? 's/d'}) ${marcadorTexto(o.score, o.ganador)}`;
    });
  return {
    importancia: importancia(p) >= 75 ? 'alta' : 'normal',
    recorrido_del_ganador_en_el_torneo: recorrido(g),
    recorrido_del_perdedor_en_el_torneo: recorrido(pe),
    torneo: nombreTorneo(p.torneo),
    categoria: nombreCategoria(p.tier, p.tour, p.torneo),
    circuito: p.genero === 'women' || /wta|women/.test(p.tour || '') ? 'femenino' : 'masculino',
    ronda: nombreRonda(p.rondaCod, p.ronda),
    superficie: SUPERFICIES[p.superficie] || p.superficie || 'sin dato',
    bajo_techo: p.cubierto ? 'sí' : 'no',
    dobles: p.dobles ? 'sí' : 'no',
    fecha: fechaArg(p.horario, { day: 'numeric', month: 'long', year: 'numeric' }),
    ganador: jugador(g), perdedor: jugador(pe),
    marcador_desde_el_ganador: marcadorTexto(p.score, p.ganador),
    sets_jugados: sets(p.score).length,
    desarrollo_por_set: desarrollo,
    sorpresa_por_ranking: sorpresa,
    remontada: sv.length >= 2 && sv[0][0] < sv[0][1] ? 'sí, perdió el primer set y dio vuelta el partido' : 'no',
    resultado_especial: p.resultado || 'ninguno',
    el_perdedor_era_el_campeon_defensor: defensor && defensor === pe.nombre ? 'sí' : 'no',
    el_ganador_es_el_campeon_defensor: defensor && defensor === g.nombre ? 'sí' : 'no',
    otros_resultados_destacados_del_dia: contexto,
    proximo_partido_del_ganador: rival ? `${nombreRonda(proximo.rondaCod, proximo.ronda)} ante ${rival.nombre}` : 'todavía no confirmado',
    ...situacionDeGrupo(p, g, pe)
  };
}

const ESTILO = `Sos redactor de A Todo Tenis, un sitio de tenis hecho en Argentina que cubre todo el circuito internacional. Escribís como un periodista deportivo argentino con oficio: tercera persona, español rioplatense neutro (sin voseo), frases con ritmo y sin relleno.

QUÉ CONTAR:
- Encontrá la noticia: si "sorpresa_por_ranking" es "grande" o "moderada", ese es el eje (el favorito cayó). Si hubo "remontada", destacala. Si fue un trámite (dos sets claros), decilo sin dramatizar.
- Si "el_perdedor_era_el_campeon_defensor" es "sí", es parte central de la noticia: el torneo se quedó sin su campeón defensor.
- Usá "desarrollo_por_set" para narrar el partido: quién arrancó mejor, si hubo tie-break, cómo se definió. Al hablar de un set, el puntaje va desde quien lo ganó (6-2, nunca 2-6).
- De "otros_resultados_destacados_del_dia" mencioná como mucho UNO, y solo si suma (por ejemplo, otra caída importante del día). No hagas listas de resultados.
- La cobertura es internacional: tratá a todos los jugadores por igual, sin favorecer nacionalidades.

VOZ DE LA CASA (así escribe A Todo Tenis desde hace años):
- Directo y con el dato adelante: primero quién le ganó a quién, el marcador y la instancia; después el contexto. Oraciones cortas.
- Ranking siempre con "N°": "el N° 1 del mundo", "la N° 8 del ranking". Nunca "número uno" ni "top" en inglés.
- Marcador completo desde el punto de vista del ganador, con comas y una "y" antes del último set: "Ganó 6-4, 3-6 y 7-6 (2)". Nunca separar sets solo con espacios ni dejar una lista de sets sin la "y" final.
- Cuando un set termina 7-6, agregá los puntos del tie-break entre paréntesis (por ejemplo, "7-6 (2)") únicamente si ese dato aparece en los datos del partido. Si no está disponible, escribí "7-6" sin inventar el desempate ni reemplazarlo por una mención vaga al tie-break.
- Si "sorpresa_por_ranking" es "grande", el primer párrafo arranca con "¡Batacazo!" seguido del hecho: "¡Batacazo! Fulano derrotó a Mengano, N° 1 del mundo." Es la única exclamación permitida y solo en ese caso.
- Verbos de la casa: derrotó, venció, superó, se impuso, dejó en el camino, avanzó a, se metió en, se quedó con. En una final: "se consagró campeón" o "se quedó con el título".
- Para el próximo rival: "En cuartos lo espera Fulano" o "Espera en semifinales por Fulano".
- Gentilicios para no repetir nombres: "el suizo", "la kazaja", "el estadounidense" (deducidos del país que te paso). Con un jugador conocido también sirve el apellido solo.
- Torneos en castellano y con su categoría: "el Masters 1000 de París", "el ATP 500 de Viena", "el WTA 1000 de Wuhan", "el Abierto de Australia". Usá el nombre tal como viene en "torneo" y "categoria".

REGLAS ESTRICTAS (no negociables):
- Usá SOLO los datos que te paso. No inventes declaraciones, citas, lesiones, clima, público, estadísticas (aces, quiebres, duración), historial entre los jugadores, edades, títulos, récords, cabezas de serie ni valoraciones sobre la carrera de nadie.
- No escribas números que no estén en los datos. Escribí en letras las cantidades chicas ("dos sets", "el tercer set"). El marcador va con números y guiones.
- Si "proximo_partido_del_ganador" dice "todavía no confirmado", no menciones rival futuro.
- Prohibido: "en un emocionante", "sin lugar a dudas", "cabe destacar", "en conclusión", "demostró su", "un partido para el recuerdo", "en resumen", "no cabe duda", "épico", "electrizante", "brillante actuación", "dejó en claro", "la jornada", "cotejo", "en la pista", "escalafón", "certamen".
- Variá la forma de nombrar a los jugadores (apellido, nacionalidad, "el número 9 del mundo"), sin repetir la misma fórmula.

FORMATO:
- Título: corto y con la noticia (máximo 75 caracteres), sin la ronda si no es una instancia decisiva, sin signos de exclamación. Escribilo con verbos variados y concretos (no uses siempre "da el golpe", "elimina" o "avanza"); no repitas fórmulas de otras notas.
- Bajada: una sola oración que agregue algo que el título no dice.
- Cuerpo: 3 o 4 párrafos cortos (2 o 3 oraciones). El primero responde qué pasó y por qué importa.
- Si "importancia" es "alta", escribí 5 o 6 párrafos: además del partido, contá el camino de cada uno en el torneo ("recorrido_del_ganador_en_el_torneo" y "recorrido_del_perdedor_en_el_torneo") y lo que viene. Solo con esos datos, sin agregar nada que no esté.

Devolvé SOLO JSON con esta forma: {"titulo": "...", "bajada": "...", "cuerpo": ["párrafo", "..."], "etiquetas": ["...", "..."]}`;

// Elige modelos disponibles: primero los de config.json que existan, después cualquier "flash" de texto
let MODELOS = null;
async function modelosDisponibles() {
  if (MODELOS) return MODELOS;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': KEY } });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
    const nombres = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
    log('Modelos disponibles:', nombres.join(', '));
    const flash = nombres.filter((n) => /flash/.test(n) && !/(lite|omni|image|tts|audio|live|thinking|exp|embedding|vision|transcribe)/.test(n))
      .sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || (/preview/.test(a) - /preview/.test(b)) || b.localeCompare(a, undefined, { numeric: true }));
    // Si los "flash" nuevos están saturados (503), se prueba con otros modelos gratuitos: 2.5 flash/pro y Gemma.
    const extra = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-lite-latest', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it'].filter((m) => nombres.includes(m));
    MODELOS = [...new Set([...N.modelos.filter((m) => nombres.includes(m)), ...flash.slice(0, 4), ...extra])].slice(0, 9);
  } catch (e) { log('No se pudo listar modelos:', e.message); MODELOS = N.modelos; }
  log('Modelos a usar:', MODELOS.join(', '));
  return MODELOS;
}

// Plazo total para Gemini en la corrida. Al terminar un partido de Finals (corrida forzada) la nota no espera a la IA:
// si Gemini no contesta rápido sale con la plantilla verificada y se mejora en una corrida siguiente.
const PLAZO_GEMINI = Date.now() + (process.env.FORZAR === 'si' ? 40e3 : 4 * 60e3);
async function gemini(prompt) {
  let ultimoError = new Error('sin tiempo para Gemini en esta corrida');
  for (const modelo of await modelosDisponibles()) {
    for (let intento = 1; intento <= 2; intento++) {
      const resta = PLAZO_GEMINI - Date.now();
      if (resta < 8000) throw ultimoError;
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
          signal: AbortSignal.timeout(Math.min(45000, resta)),
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            // Gemma no acepta responseMimeType: se le pide JSON en el texto y se limpia la respuesta
            generationConfig: /^gemma/.test(modelo) ? { temperature: 0.85 } : { temperature: 0.85, responseMimeType: 'application/json' }
          })
        });
        if (r.status === 503 || r.status === 500) { ultimoError = new Error(`Gemini ${modelo} saturado (${r.status})`); log(ultimoError.message); if (intento === 1) { await new Promise((s) => setTimeout(s, 4000)); continue; } break; }
        if (r.status === 429) { ultimoError = new Error('429 límite de Gemini'); if (PLAZO_GEMINI - Date.now() < 30000) throw ultimoError; await new Promise((s) => setTimeout(s, 20000)); continue; }
        if ([400, 403, 404].includes(r.status)) { ultimoError = new Error(`Gemini ${modelo} HTTP ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 200)}`); log(ultimoError.message); MODELOS = MODELOS.filter((x) => x !== modelo); break; }
        if (!r.ok) throw new Error(`Gemini ${modelo} HTTP ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 300)}`);
        const j = await r.json();
        const texto = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
        const json = (texto.match(/\{[\s\S]*\}/) || [texto])[0]; // tolera ```json ... ``` o texto alrededor
        return { modelo, nota: JSON.parse(json) };
      } catch (e) { ultimoError = e; log('Gemini falló:', e.message); }
    }
  }
  throw ultimoError;
}

// Validación anti-invento
function validar(nota, datos) {
  const problemas = [];
  if (!nota || typeof nota.titulo !== 'string' || !Array.isArray(nota.cuerpo)) return ['formato inválido'];
  if (nota.titulo.length > 110) problemas.push('título demasiado largo');
  if (nota.titulo.length > 90) problemas.push('título de más de 90 caracteres');
  if (/[!¡]/.test(nota.titulo)) problemas.push('el título no lleva exclamaciones');
  const exclam = [nota.bajada, ...nota.cuerpo].join(' ').match(/¡[^!]*!/g) || [];
  if (exclam.some((e) => e !== '¡Batacazo!') || (exclam.length && datos.sorpresa_por_ranking !== 'grande')) problemas.push('exclamación fuera de lugar');
  if (nota.cuerpo.length < 4 || nota.cuerpo.length > 7) problemas.push('la nota tiene que tener entre 4 y 7 párrafos');
  if (nota.cuerpo.join(' ').length < 650) problemas.push('nota demasiado corta: usá todos los datos (desarrollo set por set, recorrido de los dos en el torneo, situación del grupo si la hay y próximo partido)');
  if (/\b(el|del) (ATP|WTA) Finals\b/.test([nota.titulo, nota.bajada, ...nota.cuerpo].join(' '))) problemas.push('se dice "las ATP Finals" / "las WTA Finals" (femenino plural)');
  const texto = [nota.titulo, nota.bajada, ...nota.cuerpo].join(' ');
  const permitidos = new Set(JSON.stringify(datos).match(/\d+/g) || []);
  ['1', '2', '3', '4', '5'].forEach((n) => permitidos.add(n)); // "dos sets", "tercer set", etc.
  const numeros = texto.match(/\d+/g) || [];
  const raros = numeros.filter((n) => !permitidos.has(n));
  if (raros.length) problemas.push(`números que no están en los datos: ${[...new Set(raros)].join(', ')}`);
  for (const j of [datos.ganador, datos.perdedor]) {
    const ap = apellido(j.nombre).split(' / ')[0].split(' ').pop();
    if (ap && !texto.toLowerCase().includes(ap.toLowerCase())) problemas.push(`no menciona a ${j.nombre}`);
  }
  if (!texto.includes(datos.marcador_desde_el_ganador.split(' ')[0])) problemas.push('no incluye el marcador');
  if (/[“”"«»]/.test(nota.cuerpo.join(' ')) && /(dijo|declar|afirm|expres|señal)/i.test(texto)) problemas.push('parece incluir citas');
  const prohibidas = ['emocionante', 'sin lugar a dudas', 'cabe destacar', 'en conclusión', 'para el recuerdo', 'épico', 'electrizante', 'la jornada', 'cotejo', 'escalafón', 'certamen', 'quiebr', 'quebr', 'favorito del torneo', 'cabeza de serie', 'preclasificad', 'de su carrera', 'saque', 'aces'];
  for (const f of prohibidas) if (texto.toLowerCase().includes(f)) problemas.push(`frase prohibida: ${f}`);
  if (/(?<!tie-|tie |super tie-|súper tie-)\bbreak/i.test(texto)) problemas.push('frase prohibida: break (quiebre)');
  return problemas;
}

// ---------- Nota de respaldo (cuando Gemini no responde) ----------
// Nota completa armada SOLO con datos verificados del partido y del torneo: resultado set por set, ranking oficial,
// recorrido de los dos en el torneo, situación del grupo (Finals) y próximo partido. Sale en español y en inglés.
// No inventa nada: si un dato no está, el párrafo no se escribe.
const huellaNota = (n) => crypto.createHash('sha1').update(JSON.stringify([n.titulo, n.bajada, n.cuerpo, n.categoria])).digest('hex').slice(0, 12);
const normNombre = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const RANKING_OFICIAL = (() => {
  const m = new Map();
  for (const j of Object.values(leerJSON('data/jugadores.json', {}).lista || {})) if (j?.ranking && j.nombre) m.set(`${j.tour}|${normNombre(j.nombre)}`, j.ranking);
  return m;
})();
const rankingOficial = (nombre, tour) => RANKING_OFICIAL.get(`${tour}|${normNombre(nombre)}`) ?? null;
const GRUPOS_FINALS = (leerJSON('content/finales.json', {}).eventos || []).flatMap((e) => (e.grupos || []).map((g) => ({ tour: e.tour, nombre: g.nombre, jugadores: g.jugadores.map(normNombre) })));

// Finals: nombre del grupo y récord de cada uno después de este partido (para que la nota cuente cómo quedó el grupo)
function situacionDeGrupo(p, g, pe) {
  const tour = /wta|women/i.test(`${p.tour} ${p.genero}`) ? 'wta' : 'atp';
  const grupo = /finals/i.test(nombreTorneo(p.torneo)) && GRUPOS_FINALS.find((x) => x.tour === tour && x.jugadores.includes(normNombre(g.nombre)) && x.jugadores.includes(normNombre(pe.nombre)));
  if (!grupo) return {};
  const tabla = {};
  for (const o of Object.values(PARTIDOS_TODOS)) {
    if (o.torneo !== p.torneo || !o.confirmado || !o.ganador || o.dobles || String(o.horario) > String(p.horario)) continue;
    const og = o.ganador === 1 ? o.j1 : o.j2, op = o.ganador === 1 ? o.j2 : o.j1;
    if (!grupo.jugadores.includes(normNombre(og?.nombre)) || !grupo.jugadores.includes(normNombre(op?.nombre))) continue;
    (tabla[og.nombre] ||= { ganados: 0, perdidos: 0 }).ganados++; (tabla[op.nombre] ||= { ganados: 0, perdidos: 0 }).perdidos++;
  }
  return {
    grupo: grupo.nombre,
    tabla_del_grupo_tras_este_partido: Object.entries(tabla).sort((a, b) => b[1].ganados - a[1].ganados || a[1].perdidos - b[1].perdidos).map(([n, r]) => `${n}: ${r.ganados} ganados, ${r.perdidos} perdidos`),
    formato: 'fase de grupos (round robin) de 4 jugadores; a las semifinales avanzan los dos primeros de cada grupo. No afirmes que alguien ya se clasificó o quedó eliminado: eso depende de otros resultados.'
  };
}

function notaDeRespaldo(p) {
  const r = resultadoParaNota(p);
  const tour = /wta|women/i.test(`${p.tour} ${p.genero}`) ? 'wta' : 'atp';
  const G = r.ganador.nombre, P = r.perdedor.nombre, ag = apellido(G), ap = apellido(P);
  const gId = (p.ganador === 1 ? p.j1 : p.j2)?.id, pId = (p.ganador === 1 ? p.j2 : p.j1)?.id;
  const rkG = rankingOficial(G, tour), rkP = rankingOficial(P, tour);
  const nomT = nombreTorneo(p.torneo), esFinals = /finals/i.test(nomT);
  const torneoEs = esFinals ? `las ${nomT}` : nomT, torneoEn = esFinals ? `the ${nomT}` : nomT;
  const grupo = esFinals && GRUPOS_FINALS.find((g) => g.tour === tour && g.jugadores.includes(normNombre(G)) && g.jugadores.includes(normNombre(P)));
  const grupoEn = grupo && grupo.nombre.replace(/^Grupo (\d+)$/, 'Group $1').replace(/^Grupo /, '') + (/^Grupo \d/.test(grupo.nombre) ? '' : ' Group');
  const rondaEs = grupo ? `la fase de grupos` : (p.rondaCod || p.ronda ? `${/^(la|el) /i.test(nombreRonda(p.rondaCod, p.ronda)) ? '' : 'la '}${String(nombreRonda(p.rondaCod, p.ronda)).toLowerCase()}` : '');
  const RONDAS_EN = { F: 'the final', SF: 'the semifinals', QF: 'the quarterfinals', R16: 'the round of 16', R32: 'the third round', R64: 'the second round', R128: 'the first round' };
  const rondaEn = grupo ? 'the group stage' : (RONDAS_EN[p.rondaCod] || '');

  // Sets desde el ganador, con el puntaje del tie-break (el del que lo perdió)
  const tbs = Array.isArray(r.tieBreaks) ? r.tieBreaks : [];
  const tbPerdedor = (i) => { let t = tbs[i]; if (t == null) return null; if (typeof t === 'object') { const v = [t.p1 ?? t.player1 ?? t[0], t.p2 ?? t.player2 ?? t[1]].map(Number).filter(Number.isFinite); t = v.length === 2 ? Math.min(...v) : v[0]; } return Number.isFinite(+t) ? +t : null; };
  const setTxt = ([a, b], i) => { const tb = (a === 7 && b === 6) || (a === 6 && b === 7) ? tbPerdedor(i) : null; return `${a}-${b}${tb != null ? ` (${tb})` : ''}`; };
  const sets = r.sets.map(setTxt);
  const marcadorEs = sets.join(', ').replace(/, ([^,]+)$/, ' y $1'), marcadorEn = sets.join(', ');
  const remonto = r.sets[0] && r.sets[0][1] > r.sets[0][0];
  const setsCorridos = r.sets.every(([a, b]) => a > b);

  // Recorrido en el torneo (partidos anteriores confirmados) y récord
  const previos = (id) => Object.values(PARTIDOS_TODOS)
    .filter((o) => o.id !== p.id && o.torneo === p.torneo && o.confirmado && o.ganador && !o.dobles && [o.j1?.id, o.j2?.id].includes(id) && String(o.horario) < String(p.horario))
    .sort((x, y) => String(x.horario).localeCompare(String(y.horario)))
    .map((o) => { const rr = resultadoParaNota(o); const gano = (o.ganador === 1 ? o.j1 : o.j2)?.id === id; return { gano, rival: (o.j1?.id === id ? o.j2 : o.j1)?.nombre, marcador: rr ? rr.sets.map(([a, b]) => gano ? `${a}-${b}` : `${b}-${a}`) : [] }; });
  const prevG = previos(gId), prevP = previos(pId);
  const recG = { g: prevG.filter((x) => x.gano).length + 1, p: prevG.filter((x) => !x.gano).length };
  const recP = { g: prevP.filter((x) => x.gano).length, p: prevP.filter((x) => !x.gano).length + 1 };
  const proximo = (id) => Object.values(PARTIDOS_TODOS).filter((o) => o.estado === 'programado' && o.torneo === p.torneo && [o.j1?.id, o.j2?.id].includes(id) && String(o.horario) > String(p.horario))
    .sort((x, y) => String(x.horario).localeCompare(String(y.horario)))[0];
  const proxG = proximo(gId), proxP = proximo(pId);
  const rivalDe = (o, id) => (o.j1?.id === id ? o.j2 : o.j1)?.nombre;
  const diaEs = (o) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(o.horario));
  const diaEn = (o) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(o.horario));
  const vecesEs = (n) => ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco'][n] ?? String(n), vecesEn = (n) => ['no', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);
  const victoriasEs = (n) => `${vecesEs(n)} ${n === 1 ? 'victoria' : 'victorias'}`, derrotasEs = (n) => `${vecesEs(n)} ${n === 1 ? 'derrota' : 'derrotas'}`;
  const winsEn = (n) => `${vecesEn(n)} ${n === 1 ? 'win' : 'wins'}`, lossesEn = (n) => `${vecesEn(n)} ${n === 1 ? 'loss' : 'losses'}`;
  const invicto = grupo && recG.p === 0 && recG.g >= 2;
  // Lo que significa el resultado: clasificación al cerrar el grupo, pase a la final o título
  let puesto = 0;
  if (grupo) {
    const ids = new Set(Object.values(PARTIDOS_TODOS).filter((o) => o.torneo === p.torneo && !o.dobles && [o.j1, o.j2].every((j) => j && grupo.jugadores.includes(normNombre(j.nombre)))).flatMap((o) => [o.j1.id, o.j2.id]));
    const jugadosGrupo = Object.values(PARTIDOS_TODOS).filter((o) => o.torneo === p.torneo && !o.dobles && (o.id === p.id || (o.confirmado && o.ganador)) && [o.j1?.id, o.j2?.id].every((x) => ids.has(x)));
    if (ids.size === 4 && jugadosGrupo.length >= 6) {
      const gan = {}; for (const o of jugadosGrupo) { const w = o.id === p.id ? gId : (o.ganador === 1 ? o.j1 : o.j2).id; gan[w] = (gan[w] || 0) + 1; }
      const orden = [...ids].sort((x, y) => (gan[y] || 0) - (gan[x] || 0));
      const pos = orden.indexOf(gId);
      if (pos <= 1 && (gan[gId] || 0) > (gan[orden[2]] || 0)) puesto = pos + 1;
    }
  }
  const ultimaRonda = String(p.ronda || '').split(' - ').pop();
  const esSemi = !grupo && (p.rondaCod === 'SF' || /semi/i.test(ultimaRonda)), esFinal = !grupo && (p.rondaCod === 'F' || /^final$/i.test(ultimaRonda.trim()));
  const fem = /women/.test(p.genero || '') || tour === 'wta';

  // ---- Español ----
  const quienEs = (nombre, rk) => rk ? `${nombre}, número ${rk} del ranking,` : nombre;
  const titulo = esFinals && esFinal ? `${ag} ${fem ? 'es campeona' : 'es campeón'} de ${torneoEs}`
    : esFinals && esSemi ? `${ag} le ganó a ${ap} y ${fem ? 'es finalista' : 'es finalista'} de ${torneoEs}`
    : puesto && recG.p === 0 ? `${ag} le ganó a ${ap} y cerró ${fem ? 'invicta' : 'invicto'} el ${grupo.nombre.replace(/^Grupo /, 'grupo ')}`
    : puesto ? `${ag} le ganó a ${ap} y se clasificó a las semifinales de ${torneoEs}`
    : remonto ? `${ag} dio vuelta el partido ante ${ap} en ${torneoEs}`
    : invicto ? `${ag} le ganó a ${ap} y sigue ${/women/.test(p.genero || '') || tour === 'wta' ? 'invicta' : 'invicto'} en ${torneoEs}`
    : `${ag} le ganó a ${ap} en ${torneoEs}`;
  const bajada = puesto ? `${rkG ? `El número ${rkG} del mundo` : ag} se impuso ${marcadorEs}, terminó ${puesto === 1 ? 'primero' : 'segundo'} en el ${grupo.nombre.replace(/^Grupo /, 'grupo ')} y ${recG.p === 0 ? 'jugará' : 'se metió en'} las semifinales.`
    : esFinals && esFinal ? `${ag} le ganó ${marcadorEs} a ${ap} en la final de ${torneoEs}.`
    : esFinals && esSemi ? `${ag} se impuso ${marcadorEs} ante ${ap} y jugará la final de ${torneoEs}.`
    : `${rkG ? `El número ${rkG} del mundo` : ag} se impuso ${marcadorEs}${grupo ? ` en el ${grupo.nombre.replace(/^Grupo /, 'grupo ')}` : rondaEs ? ` en ${rondaEs}` : ''}${grupo ? ` y suma ${victoriasEs(recG.g)}${recG.p ? ` y ${derrotasEs(recG.p)}` : ''}` : ''}.`;
  const cuerpo = [];
  cuerpo.push(`${quienEs(G, rkG)} venció a ${P}${rkP ? ` (${rkP}°)` : ''} por ${marcadorEs} en ${rondaEs ? `${rondaEs} de ` : ''}${torneoEs}.`);
  const tbEs = (i) => { const t = tbPerdedor(i); return t != null ? ` en el tie-break por ${Math.max(7, t + 2)}-${t}` : ' en el tie-break'; };
  const tbEsPerd = (i) => { const t = tbPerdedor(i); return t != null ? ` en el tie-break (${Math.max(7, t + 2)}-${t})` : ' en el tie-break'; };
  const descSet = ([a, b], i) => {
    const n = ['El primer set', 'El segundo', 'El tercero', 'El cuarto', 'El quinto'][i];
    const tb = (a === 7 && b === 6) || (a === 6 && b === 7);
    if (a > b) return `${n} fue para ${ag}, ${tb ? `que lo ganó${tbEs(i)}` : `que lo cerró ${a}-${b}`}`;
    return `${n} se lo llevó ${ap}, ${tb ? `que lo ganó${tbEsPerd(i)}` : `por ${b}-${a}`}`;
  };
  const sinTb = r.sets.every(([a, b]) => !((a === 7 && b === 6) || (a === 6 && b === 7)));
  cuerpo.push(setsCorridos && sinTb
    ? `${ag} ganó el primer set ${sets[0]}${sets.length > 2 ? `, el segundo ${sets[1]} y el tercero ${sets[2]}` : ` y el segundo ${sets[1]}`}, sin ceder sets.`
    : `${r.sets.map(descSet).join('. ')}.${remonto ? ` ${ag} perdió el primer set y dio vuelta el partido.` : setsCorridos ? ` ${ag} ganó el partido sin ceder sets.` : ''}`);
  const recorridoEs = (prev, quien, ap2) => prev.length ? `${quien} venía de ${prev.map((x) => `${x.gano ? 'ganarle' : 'perder con'} ${x.gano ? 'a ' : ''}${apellido(x.rival)} por ${x.marcador.join(', ').replace(/, ([^,]+)$/, ' y $1')}`).join(' y de ')}` : '';
  const ctxEs = [recorridoEs(prevG, ag), recorridoEs(prevP, ap)].filter(Boolean);
  if (ctxEs.length || grupo) {
    let t = ctxEs.length ? `${ctxEs.join('. ')}.` : '';
    if (grupo) t += ` En el ${grupo.nombre.replace(/^Grupo /, 'grupo ')}, ${ag} suma ${victoriasEs(recG.g)}${recG.p ? ` y ${derrotasEs(recG.p)}` : ''}, y ${ap} tiene ${recP.g ? `${victoriasEs(recP.g)} y ` : ''}${derrotasEs(recP.p)}.${esFinals ? ' A las semifinales avanzan los dos primeros de cada grupo.' : ''}`;
    cuerpo.push(t.trim());
  }
  const proxEs = [proxG && `${ag} jugará el ${diaEs(proxG)} ante ${rivalDe(proxG, gId)}`, proxP && `${ap} se medirá con ${rivalDe(proxP, pId)}`].filter(Boolean);
  const jugados = grupo ? recG.g + recG.p : 0;
  const ultima = grupo && jugados === 2;
  const yaSemis = grupo && jugados >= 3; // terminó el grupo: el próximo partido es la semifinal
  if (proxEs.length) cuerpo.push(`${yaSemis ? 'En semifinales, ' : grupo ? (ultima ? 'En la última fecha del grupo, ' : 'En la próxima fecha del grupo, ') : 'En su próximo partido, '}${proxEs.join(', mientras que ')}.`);

  // ---- English (mismo contenido) ----
  const whoEn = (nombre, rk) => rk ? `World No. ${rk} ${nombre}` : nombre;
  const tituloEn = esFinals && esFinal ? `${ag} wins ${torneoEn}`
    : esFinals && esSemi ? `${ag} beats ${ap} to reach the final of ${torneoEn}`
    : puesto && recG.p === 0 ? `${ag} beats ${ap} to finish the ${grupoEn} unbeaten`
    : puesto ? `${ag} beats ${ap} to reach the semi-finals of ${torneoEn}`
    : remonto ? `${ag} comes back to beat ${ap} at ${torneoEn}`
    : invicto ? `${ag} beats ${ap} to stay unbeaten at ${torneoEn}`
    : `${ag} beats ${ap} at ${torneoEn}`;
  const bajadaEn = puesto ? `${rkG ? `The world No. ${rkG}` : ag} won ${marcadorEn}, finished ${puesto === 1 ? 'first' : 'second'} in the ${grupoEn} and goes through to the semi-finals.`
    : esFinals && esFinal ? `${ag} beat ${ap} ${marcadorEn} in the final of ${torneoEn}.`
    : esFinals && esSemi ? `${ag} beat ${ap} ${marcadorEn} and will play the final of ${torneoEn}.`
    : `${rkG ? `The world No. ${rkG}` : ag} won ${marcadorEn}${grupo ? ` in the ${grupoEn}` : rondaEn ? ` in ${rondaEn}` : ''}${grupo ? ` and now has ${winsEn(recG.g)}${recG.p ? ` and ${lossesEn(recG.p)}` : ''}` : ''}.`;
  const cuerpoEn = [];
  cuerpoEn.push(`${whoEn(G, rkG)} beat ${P}${rkP ? ` (No. ${rkP})` : ''} ${marcadorEn} in ${rondaEn ? `${rondaEn} of ` : ''}${torneoEn}.`);
  const descSetEn = ([a, b], i) => {
    const n = ['The first set', 'The second', 'The third', 'The fourth', 'The fifth'][i];
    const tb = (a === 7 && b === 6) || (a === 6 && b === 7), t = tbPerdedor(i);
    const tbTxt = t != null ? `the tiebreak ${Math.max(7, t + 2)}-${t}` : 'the tiebreak';
    if (a > b) return `${n} went to ${ag}, ${tb ? `who won ${tbTxt}` : `${a}-${b}`}`;
    return `${n} went to ${ap}, ${tb ? `who won ${tbTxt}` : `${b}-${a}`}`;
  };
  cuerpoEn.push(setsCorridos && sinTb
    ? `${ag} took the first set ${sets[0]}${sets.length > 2 ? `, the second ${sets[1]} and the third ${sets[2]}` : ` and the second ${sets[1]}`}, without dropping a set.`
    : `${r.sets.map(descSetEn).join('. ')}.${remonto ? ` ${ag} lost the first set and came back to win.` : setsCorridos ? ` ${ag} won without dropping a set.` : ''}`);
  const recorridoEn = (prev, quien) => prev.length ? `${quien} had ${prev.map((x) => `${x.gano ? 'beaten' : 'lost to'} ${apellido(x.rival)} ${x.marcador.join(', ')}`).join(' and ')}` : '';
  const ctxEn = [recorridoEn(prevG, ag), recorridoEn(prevP, ap)].filter(Boolean);
  if (ctxEn.length || grupo) {
    let t = ctxEn.length ? `${ctxEn.join('. ')}.` : '';
    if (grupo) t += ` In the ${grupoEn}, ${ag} has ${winsEn(recG.g)}${recG.p ? ` and ${lossesEn(recG.p)}` : ''}, while ${ap} has ${recP.g ? `${winsEn(recP.g)} and ` : ''}${lossesEn(recP.p)}.${esFinals ? ' The top two in each group advance to the semifinals.' : ''}`;
    cuerpoEn.push(t.trim());
  }
  const proxEn = [proxG && `${ag} will play ${rivalDe(proxG, gId)} on ${diaEn(proxG)}`, proxP && `${ap} will face ${rivalDe(proxP, pId)}`].filter(Boolean);
  if (proxEn.length) cuerpoEn.push(`${yaSemis ? 'In the semi-finals, ' : grupo ? (ultima ? 'On the final day of the group, ' : 'In the next round of group matches, ') : 'Next, '}${proxEn.join(', while ')}.`);

  return {
    titulo, bajada, cuerpo, etiquetas: [nomT, G, P],
    en: { categoria: nombreCategoria(p.tier, p.tour, p.torneo) || 'Tenis', titulo: tituloEn, bajada: bajadaEn, cuerpo: cuerpoEn },
  };
}

// Cuando Gemini vuelve a responder, las notas que salieron con la plantilla (últimas 12 horas) se reescriben
// con el estilo de redacción completo. Se mantienen el slug, la foto y todo lo demás.
async function mejorarPlantillas() {
  if (PRUEBA.length) return;
  for (const f of fs.readdirSync(path.join(ROOT, 'content/notas')).filter((x) => x.endsWith('.json'))) {
    const ruta = path.join(ROOT, 'content/notas', f);
    const n = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (n.manual || n.generadoCon !== 'plantilla' || n.estado !== 'publicada' || Date.now() - new Date(n.fecha).getTime() > 12 * 3600e3) continue;
    if (n.reintentoGemini && Date.now() - new Date(n.reintentoGemini).getTime() < 25 * 60e3) continue;
    const p = PARTIDOS_TODOS[n.partidoId]; if (!p) continue;
    const datos = datosDelPartido(p);
    let prompt = `${ESTILO}\n\nDATOS DEL PARTIDO:\n${conGrafia(JSON.stringify(datos, null, 2))}`;
    try {
      let nota, modelo, problemas = ['sin intentar'];
      for (let intento = 1; intento <= 2 && problemas.length; intento++) {
        ({ nota, modelo } = await gemini(prompt));
        problemas = validar(nota, datos);
        if (problemas.length) prompt += `\n\nTu versión anterior tenía estos problemas, corregilos: ${problemas.join('; ')}`;
      }
      if (problemas.length) { log(`Plantilla ${n.slug}: Gemini respondió con problemas, queda la plantilla`); n.reintentoGemini = new Date().toISOString(); fs.writeFileSync(ruta, JSON.stringify(n, null, 1) + '\n'); continue; }
      const limpia = JSON.parse(conGrafia(JSON.stringify(nota)));
      n.titulo = limpia.titulo.trim(); n.bajada = (limpia.bajada || '').trim(); n.cuerpo = limpia.cuerpo.map((x) => String(x).trim()).filter(Boolean);
      n.generadoCon = modelo; delete n.reintentoGemini; // el inglés se rehace solo en el paso de traducción (cambia la huella)
      fs.writeFileSync(ruta, JSON.stringify(n, null, 1) + '\n');
      log(`Nota mejorada con Gemini: ${n.slug}`);
    } catch (e) {
      n.reintentoGemini = new Date().toISOString(); fs.writeFileSync(ruta, JSON.stringify(n, null, 1) + '\n');
      log(`Plantilla ${n.slug}: Gemini sigue sin responder (${e.message})`); break;
    }
  }
}

async function main() {
  // En la corrida forzada por fin de partido primero va la nota nueva; las plantillas se mejoran después
  if (process.env.FORZAR !== 'si') await mejorarPlantillas().catch((e) => log('mejorarPlantillas:', e.message));
  log(`Notas candidatas: ${candidatos.length}`);
  for (const p of candidatos) {
    if (!PRUEBA.length && !entraEnJornada(p)) { log(`Fuera de las ${MAX_JORNADA} más importantes de su jornada: ${p.j1?.nombre} - ${p.j2?.nombre}`); registro[p.id] = 'omitida'; continue; }
    const datos = datosDelPartido(p);
    let prompt = `${ESTILO}\n\nDATOS DEL PARTIDO:\n${conGrafia(JSON.stringify(datos, null, 2))}`;
    let nota, modelo, problemas = ['sin intentar'];
    for (let intento = 1; intento <= 2 && problemas.length; intento++) {
      try {
        ({ nota, modelo } = await gemini(prompt));
        problemas = validar(nota, datos);
      } catch (e) { problemas = [e.message]; break; }
      if (problemas.length) {
        log(`Nota de ${p.id} con problemas: ${problemas.join('; ')}`);
        prompt += `\n\nTu versión anterior tenía estos problemas, corregilos: ${problemas.join('; ')}`;
      }
    }
    if (problemas.length) {
      const errorGemini = problemas.some((x) => /Gemini|429|503|fetch|timeout|abort/i.test(x));
      // Si Gemini no responde y el partido terminó hace más de 20 minutos, la nota sale igual, completa, con los datos
      // verificados del partido (también en inglés). Cuando Gemini vuelva, se reescribe (mejorarPlantillas).
      const terminado = new Date(p.score?.received_at || p.score?.timestamp || p.horario).getTime();
      if (!PRUEBA.length && (!errorGemini || Date.now() - terminado > 20 * 60e3)) {
        log(`${errorGemini ? 'Gemini no respondió' : `La nota de Gemini no pasó los controles (${problemas.join('; ')})`}: nota completa con los datos verificados para ${p.id}`);
        nota = JSON.parse(conGrafia(JSON.stringify(notaDeRespaldo(p)))); modelo = 'plantilla'; problemas = [];
      } else {
        // Si fue un error de Gemini (no de contenido) se reintenta en la próxima corrida
        if (!errorGemini) registro[p.id] = 'descartada';
        continue;
      }
    }
    const g = p.ganador === 1 ? p.j1 : p.j2, pe = p.ganador === 1 ? p.j2 : p.j1;
    const slug = slugify(`${(p.horario || '').slice(0, 10)} ${apellido(g.nombre)} ${apellido(pe.nombre)} ${p.torneo}`);
    const doc = {
      slug,
      estado: PRUEBA.length ? 'prueba' : (N.publicarAutomaticamente ? 'publicada' : 'revision'),
      fecha: new Date().toISOString(),
      fechaPartido: p.horario,
      titulo: nota.titulo.trim(),
      bajada: (nota.bajada || '').trim(),
      cuerpo: nota.cuerpo.map((x) => String(x).trim()).filter(Boolean),
      etiquetas: (nota.etiquetas || []).slice(0, 6),
      categoria: nombreCategoria(p.tier, p.tour, p.torneo) || 'Tenis',
      argentina: [p.j1, p.j2].some((j) => j?.pais === CONFIG.notas.paisDestacado),
      superficie: p.superficie,
      partidoId: p.id,
      jugadores: [g.nombre, pe.nombre],
      torneo: nombreTorneo(p.torneo),
      resultado: resultadoParaNota(p),
      importancia: importancia(p),
      firma: CONFIG.sitio.firma,
      imagen: null, // { url, credito, enlace } cuando se sume una fuente de imágenes con licencia
      generadoCon: modelo
    };
    if (modelo === 'plantilla' && nota.en) doc.en = { ...nota.en, huella: huellaNota(doc), modelo: 'plantilla', fecha: new Date().toISOString() };
    fs.writeFileSync(path.join(ROOT, 'content/notas', `${slug}.json`), JSON.stringify(doc, null, 1) + '\n');
    if (!PRUEBA.length) registro[p.id] = slug;
    log(`Nota escrita: ${doc.titulo}`);
    await new Promise((s) => setTimeout(s, 4000)); // cuidar el límite por minuto de Gemini
  }
  if (!PRUEBA.length) curarJornadas();
  guardarJSON('data/notas-registro.json', registro);
}

main().catch((e) => { guardarJSON('data/notas-registro.json', registro); console.error('ERROR:', e.message); process.exit(1); });
