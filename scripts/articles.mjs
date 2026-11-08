// Redactor: escribe notas con Gemini a partir de resultados reales confirmados.
// Nunca inventa: solo usa los datos del partido y valida que los números del texto existan en los datos.
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG, ROOT, leerJSON, guardarJSON, log, nombreRonda, nombreCategoria, SUPERFICIES,
  nombrePais, sets, marcadorTexto, slugify, apellido, fechaArg, nombreTorneo
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
  return { ganador: jug(g), perdedor: jug(pe), sets: setsG, ronda: p.rondaCod || null, resultado: p.resultado || null };
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
  let v = tabla[r] ?? 30;
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
  if (typeof n.importancia === 'number') return n.importancia;
  const p = partidos[n.partidoId];
  return p ? importancia(p) : 40;
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
      if (typeof x.n.importancia !== 'number') x.n.importancia = importanciaNota(x.n);
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
    : p.importante && p.confirmado && p.estado === 'finalizado' && p.ganador && !registro[p.id] && Date.now() - new Date(p.horario).getTime() < 60 * 3600e3)
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
  return {
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
    proximo_partido_del_ganador: rival ? `${nombreRonda(proximo.rondaCod, proximo.ronda)} ante ${rival.nombre}` : 'todavía no confirmado'
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
- Marcador completo con comas y una "y" antes del último set: "Fue 7-5, 5-7, 6-2 y 6-4." En dos sets parejos vale "por un doble 6-4".
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
    MODELOS = [...new Set([...N.modelos.filter((m) => nombres.includes(m)), ...flash])].slice(0, 4);
  } catch (e) { log('No se pudo listar modelos:', e.message); MODELOS = N.modelos; }
  log('Modelos a usar:', MODELOS.join(', '));
  return MODELOS;
}

async function gemini(prompt) {
  let ultimoError;
  for (const modelo of await modelosDisponibles()) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.85, responseMimeType: 'application/json' }
          })
        });
        if (r.status === 503) { ultimoError = new Error(`Gemini ${modelo} saturado (503)`); log(ultimoError.message); break; }
        if (r.status === 429) { ultimoError = new Error('429 límite de Gemini'); await new Promise((s) => setTimeout(s, 20000)); continue; }
        if ([400, 403, 404].includes(r.status)) { ultimoError = new Error(`Gemini ${modelo} HTTP ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 200)}`); log(ultimoError.message); MODELOS = MODELOS.filter((x) => x !== modelo); break; }
        if (!r.ok) throw new Error(`Gemini ${modelo} HTTP ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 300)}`);
        const j = await r.json();
        const texto = j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
        return { modelo, nota: JSON.parse(texto.replace(/^```json\s*|```\s*$/g, '')) };
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
  if (nota.cuerpo.length < 3 || nota.cuerpo.length > 5) problemas.push('cantidad de párrafos fuera de rango');
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

async function main() {
  log(`Notas candidatas: ${candidatos.length}`);
  for (const p of candidatos) {
    if (!PRUEBA.length && !entraEnJornada(p)) { log(`Fuera de las ${MAX_JORNADA} más importantes de su jornada: ${p.j1?.nombre} - ${p.j2?.nombre}`); registro[p.id] = 'omitida'; continue; }
    const datos = datosDelPartido(p);
    let prompt = `${ESTILO}\n\nDATOS DEL PARTIDO:\n${JSON.stringify(datos, null, 2)}`;
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
      // Si fue un error de Gemini (no de contenido) se reintenta en la próxima corrida
      if (!problemas.some((x) => /Gemini|429|fetch|timeout/i.test(x))) registro[p.id] = 'descartada';
      continue;
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
    fs.writeFileSync(path.join(ROOT, 'content/notas', `${slug}.json`), JSON.stringify(doc, null, 1) + '\n');
    if (!PRUEBA.length) registro[p.id] = slug;
    log(`Nota escrita: ${doc.titulo}`);
    await new Promise((s) => setTimeout(s, 4000)); // cuidar el límite por minuto de Gemini
  }
  if (!PRUEBA.length) curarJornadas();
  guardarJSON('data/notas-registro.json', registro);
}

main().catch((e) => { guardarJSON('data/notas-registro.json', registro); console.error('ERROR:', e.message); process.exit(1); });
