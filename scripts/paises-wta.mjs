// Nacionalidad de las jugadoras según el ranking oficial de la WTA (api.wtatennis.com).
// La API de resultados no informa país para las atletas neutrales; acá se completa. Se actualiza una vez por día.
import { leerJSON, guardarJSON, log } from './lib/util.mjs';

const RUTA = 'data/paises-wta.json';
const actual = leerJSON(RUTA, { actualizado: null, jugadoras: {} });
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function main() {
  if (actual.actualizado && Date.now() - new Date(actual.actualizado).getTime() < 20 * 3600e3 && !process.env.FORZAR) { log('Países WTA: actualizados hace menos de 20 horas'); return; }
  const jugadoras = { ...actual.jugadoras };
  let total = 0;
  for (let page = 0; page < 6; page++) {
    const r = await fetch(`https://api.wtatennis.com/tennis/players/ranked?page=${page}&pageSize=100&type=rankSingles&sort=asc&metric=SINGLES`, {
      headers: { 'User-Agent': 'AtodoTenis/1.0 (+https://atodotenis.vercel.app)' }, signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) throw new Error(`WTA HTTP ${r.status}`);
    const lista = await r.json();
    if (!Array.isArray(lista) || !lista.length) break;
    for (const x of lista) {
      const p = x.player || {};
      if (p.fullName && p.countryCode) { jugadoras[norm(p.fullName)] = p.countryCode.toLowerCase(); total++; }
    }
  }
  guardarJSON(RUTA, { actualizado: new Date().toISOString(), fuente: 'api.wtatennis.com (ranking oficial)', jugadoras });
  log(`Países WTA: ${total} jugadoras del ranking oficial`);
}
main().catch((e) => { console.log('::warning::Países WTA:', e.message); process.exit(0); });
