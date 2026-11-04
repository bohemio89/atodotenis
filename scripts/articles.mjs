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
const N = CONFIG.notas;

// Modo prueba: PRUEBA_PARTIDOS="id1,id2" escribe notas de esos partidos sin publicarlas
const PRUEBA = (process.env.PRUEBA_PARTIDOS || '').split(',').map((x) => x.trim()).filter(Boolean);
const candidatos = Object.values(partidos)
  .filter((p) => PRUEBA.length
    ? PRUEBA.includes(String(p.id)) && p.confirmado && p.ganador
    : p.importante && p.confirmado && p.estado === 'finalizado' && p.ganador && !registro[p.id])
  .sort((a, b) => String(b.horario).localeCompare(String(a.horario)))
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
    otros_resultados_destacados_del_dia: contexto,
    proximo_partido_del_ganador: rival ? `${nombreRonda(proximo.rondaCod, proximo.ronda)} ante ${rival.nombre}` : 'todavía no confirmado'
  };
}

const ESTILO = `Sos redactor de A Todo Tenis, un sitio de tenis hecho en Argentina que cubre todo el circuito internacional. Escribís como un periodista deportivo argentino con oficio: tercera persona, español rioplatense neutro (sin voseo), frases con ritmo y sin relleno.

QUÉ CONTAR:
- Encontrá la noticia: si "sorpresa_por_ranking" es "grande" o "moderada", ese es el eje (el favorito cayó). Si hubo "remontada", destacala. Si fue un trámite (dos sets claros), decilo sin dramatizar.
- Usá "desarrollo_por_set" para narrar el partido: quién arrancó mejor, si hubo tie-break, cómo se definió. Al hablar de un set, el puntaje va desde quien lo ganó (6-2, nunca 2-6).
- De "otros_resultados_destacados_del_dia" mencioná como mucho UNO, y solo si suma (por ejemplo, otra caída importante del día). No hagas listas de resultados.
- La cobertura es internacional: tratá a todos los jugadores por igual, sin favorecer nacionalidades.

REGLAS ESTRICTAS (no negociables):
- Usá SOLO los datos que te paso. No inventes declaraciones, citas, lesiones, clima, público, estadísticas (aces, quiebres, duración), historial entre los jugadores, edades, títulos, récords, cabezas de serie ni valoraciones sobre la carrera de nadie.
- No escribas números que no estén en los datos. Escribí en letras las cantidades chicas ("dos sets", "el tercer set"). El marcador va con números y guiones: 7-6 6-3.
- Si "proximo_partido_del_ganador" dice "todavía no confirmado", no menciones rival futuro.
- Prohibido: "en un emocionante", "sin lugar a dudas", "cabe destacar", "en conclusión", "demostró su", "un partido para el recuerdo", "en resumen", "no cabe duda", "épico", "electrizante", "brillante actuación", "dejó en claro", "la jornada", "cotejo", "en la pista", "escalafón", "certamen".
- Variá la forma de nombrar a los jugadores (apellido, nacionalidad, "el número 9 del mundo"), sin repetir la misma fórmula.

FORMATO:
- Título: corto y con la noticia (máximo 75 caracteres), sin la ronda si no es una instancia decisiva, sin signos de exclamación. Ejemplos de tono: "Hijikata da el golpe y elimina a Djokovic en París", "Alcaraz avanza en París sin pasar sobresaltos".
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
  const prohibidas = ['emocionante', 'sin lugar a dudas', 'cabe destacar', 'en conclusión', 'para el recuerdo', 'épico', 'electrizante', 'la jornada', 'cotejo', 'escalafón', 'certamen', 'quiebr', 'quebr', 'break', 'favorito del torneo', 'cabeza de serie', 'preclasificad', 'de su carrera', 'saque', 'aces'];
  for (const f of prohibidas) if (texto.toLowerCase().includes(f)) problemas.push(`frase prohibida: ${f}`);
  return problemas;
}

async function main() {
  log(`Notas candidatas: ${candidatos.length}`);
  for (const p of candidatos) {
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
      torneo: nombreTorneo(p.torneo),
      firma: CONFIG.sitio.firma,
      imagen: null, // { url, credito, enlace } cuando se sume una fuente de imágenes con licencia
      generadoCon: modelo
    };
    fs.writeFileSync(path.join(ROOT, 'content/notas', `${slug}.json`), JSON.stringify(doc, null, 1) + '\n');
    if (!PRUEBA.length) registro[p.id] = slug;
    log(`Nota escrita: ${doc.titulo}`);
    await new Promise((s) => setTimeout(s, 4000)); // cuidar el límite por minuto de Gemini
  }
  guardarJSON('data/notas-registro.json', registro);
}

main().catch((e) => { guardarJSON('data/notas-registro.json', registro); console.error('ERROR:', e.message); process.exit(1); });
