// Fotos para el ranking: una foto con licencia libre de cada jugador del top,
// tomada de Wikimedia Commons, con el crédito que pide la licencia.
import { leerJSON, guardarJSON, log } from './lib/util.mjs';

import { buscar } from './lib/commons.mjs';
const TOP = 20, MAX_POR_CORRIDA = 45, RENOVAR_DIAS = 60;
const jugadores = leerJSON('data/jugadores.json', { lista: {} });
const avatares = leerJSON('data/avatares.json', {});
async function main() {
  const top = ['atp', 'wta'].flatMap((t) => Object.values(jugadores.lista).filter((j) => j.tour === t).sort((a, b) => a.ranking - b.ranking).slice(0, TOP));
  const pendientes = top.filter((j) => { const a = avatares[j.nombre]; if (a?.manual) return false; return !a || Date.now() - new Date(a.revisado || 0).getTime() > RENOVAR_DIAS * 864e5; })
    .slice(0, MAX_POR_CORRIDA);
  let con = 0;
  for (const j of pendientes) {
    try {
      let f = await buscar(j.nombre);
      const ascii = j.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!f && ascii !== j.nombre) f = await buscar(ascii); // probar sin acentos (ej. Menšik)
      avatares[j.nombre] = f ? { ...f, revisado: new Date().toISOString() } : { url: null, revisado: new Date().toISOString() };
      if (f) con++;
    } catch (e) { log('Commons falló:', j.nombre, e.message); }
    await new Promise((s) => setTimeout(s, 700));
  }
  guardarJSON('data/avatares.json', avatares);
  log(`Fotos de ranking: ${con} encontradas de ${pendientes.length} buscadas`);
}
main().catch((e) => { console.error('ERROR avatares:', e.message); process.exit(0); });
