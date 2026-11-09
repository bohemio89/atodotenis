// Versión en inglés de las notas publicadas. Traduce título, bajada, cuerpo y categoría con Gemini (plan gratuito)
// y guarda el resultado en n.en. Si la nota en español cambia, se vuelve a traducir.
// Controles: mismos párrafos, mismos números (marcadores, rankings) y mismos nombres de los jugadores.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, leerJSON, log } from './lib/util.mjs';

const CONFIG = leerJSON('config.json', {});
const KEY = process.env.GEMINI_API_KEY;
const DIR = path.join(ROOT, 'content/notas');
const MAX_POR_CORRIDA = 6;
const DIAS_MAX = 21; // las notas viejas no se traducen

const huella = (n) => crypto.createHash('sha1').update(JSON.stringify([n.titulo, n.bajada, n.cuerpo, n.categoria])).digest('hex').slice(0, 12);
const nums = (s) => (String(s).match(/\d+/g) || []).sort().join(',');

async function traducir(n) {
  const fuente = { titulo: n.titulo, bajada: n.bajada, cuerpo: n.cuerpo, categoria: n.categoria };
  const prompt = `You are a sports editor. Translate this Spanish tennis news story into natural, idiomatic English as written by a professional tennis journalist.
Rules: keep exactly the same facts, names, scores and numbers; do not add or remove information; keep the same number of paragraphs (the "cuerpo" array must have ${n.cuerpo.length} items); write scores like "6-4, 6-3"; "N° 5 del mundo" becomes "world No. 5"; "polvo de ladrillo" is "clay", "cemento" is "hard court"; keep tournament names in their usual English form (e.g. "Masters 1000 de París" -> "Paris Masters"). If a quotation appears, keep it as a quotation.
Return ONLY JSON with the same keys: {"titulo": "...", "bajada": "...", "cuerpo": ["..."], "categoria": "..."}.

${JSON.stringify(fuente)}`;
  for (const modelo of CONFIG.notas?.modelos || ['gemini-flash-latest']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
      });
      if (!r.ok) { log(`Gemini ${modelo} HTTP ${r.status}`); if (r.status === 429) return 'cupo'; continue; }
      const j = await r.json();
      const t = JSON.parse((j.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '{}').replace(/^```json\s*|```\s*$/g, ''));
      if (!t.titulo || !t.bajada || !Array.isArray(t.cuerpo)) { log('Respuesta incompleta'); continue; }
      if (t.cuerpo.length !== n.cuerpo.length) { log('Descartada: cambia la cantidad de párrafos'); continue; }
      if (nums([n.titulo, n.bajada, ...n.cuerpo].join(' ').replace(/N° ?/g, '')) !== nums([t.titulo, t.bajada, ...t.cuerpo].join(' '))) { log('Descartada: cambian los números'); continue; }
      const faltan = (n.jugadores || []).filter((x) => !t.cuerpo.join(' ').includes(String(x).split(' ').pop()));
      if (faltan.length) { log('Descartada: faltan nombres', faltan.join(', ')); continue; }
      if (/[áéíóúñ¿¡]/.test(t.titulo + t.bajada) && !(n.jugadores || []).some((x) => /[áéíóúñ]/.test(x))) { log('Descartada: quedó en español'); continue; }
      return { titulo: t.titulo.trim(), bajada: t.bajada.trim(), cuerpo: t.cuerpo.map((x) => String(x).trim()), categoria: String(t.categoria || n.categoria).trim(), modelo };
    } catch (e) { log('Gemini falló:', e.message); }
  }
  return null;
}

async function main() {
  if (!KEY) { log('Sin GEMINI_API_KEY: no se traducen notas.'); return; }
  const limite = Date.now() - DIAS_MAX * 86400e3;
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().reverse();
  let hechas = 0;
  for (const f of archivos) {
    if (hechas >= MAX_POR_CORRIDA) break;
    const ruta = path.join(DIR, f);
    const n = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (n.estado !== 'publicada' || new Date(n.fecha).getTime() < limite) continue;
    const h = huella(n);
    if (n.en?.huella === h) continue;
    const en = await traducir(n);
    if (en === 'cupo') { log('Cupo de Gemini agotado por ahora.'); break; }
    hechas++;
    if (!en) { log(`Sin traducción: ${n.slug}`); continue; }
    n.en = { ...en, huella: h, fecha: new Date().toISOString() };
    fs.writeFileSync(ruta, JSON.stringify(n, null, 2) + '\n');
    log(`Traducida: ${n.slug} → ${en.titulo}`);
  }
}
main().catch((e) => { log('Error:', e.message); process.exit(0); });
