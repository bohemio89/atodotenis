// Marcador de las Finals desde el scoreboard público de ESPN (gratis y sin cupo).
// Sirve para dos cosas sin gastar consultas de la API de resultados:
//  - saber al instante que terminó un partido (y con qué marcador) para publicar la nota en el momento;
//  - mantener el marcador en vivo (sets y games) entre una consulta de la API y la siguiente.
// Solo singles. Cada partido se cruza con el de data/partidos.json por los apellidos de los dos jugadores.
const URLS = ['https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard'];
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim();
const apellido = (s) => norm(s).split(/\s+/).filter(Boolean).slice(-1)[0] || '';

// Recorre el JSON y junta las "competencias" (partidos) con el nombre del torneo que las contiene.
function partidosDe(j) {
  const out = [];
  const visitar = (o, torneo) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((x) => visitar(x, torneo)); return; }
    const t = o.name && o.shortName !== undefined && o.groupings ? o.name : (o.groupings || o.competitions) && o.name ? o.name : torneo;
    if (Array.isArray(o.competitors) && o.competitors.length === 2 && o.status?.type) out.push({ c: o, torneo: t || '' });
    for (const k of Object.keys(o)) if (k !== 'competitors' && typeof o[k] === 'object') visitar(o[k], t);
  };
  visitar(j, '');
  return out;
}

function nombreDe(c) {
  return c.athlete?.displayName || c.athlete?.fullName || c.roster?.displayName || c.team?.displayName || '';
}

// Devuelve { [idPartido]: { estado, sets, tiebreaks, ganador } } para los partidos de Finals de singles que encuentra.
export async function marcadoresESPN(partidos, esFinals) {
  const candidatos = Object.values(partidos).filter((p) => esFinals(p) && !p.dobles && !/\//.test(`${p.j1?.nombre}${p.j2?.nombre}`) && p.j1?.nombre && p.j2?.nombre);
  const res = {};
  let respondio = 0;
  for (const url of URLS) {
    let j;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ATodoTenis' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      j = await r.json(); respondio++;
    } catch { continue; }
    for (const { c, torneo } of partidosDe(j)) {
      if (!/finals/i.test(torneo) || /next ?gen/i.test(torneo)) continue;
      const [a, b] = c.competitors;
      const na = nombreDe(a), nb = nombreDe(b);
      if (!na || !nb || /\//.test(na + nb) || (a.roster?.athletes?.length > 1)) continue; // dobles
      const aa = apellido(na), ab = apellido(nb);
      const p = candidatos.find((x) => {
        const p1 = apellido(x.j1.nombre), p2 = apellido(x.j2.nombre);
        return (p1 === aa && p2 === ab) || (p1 === ab && p2 === aa);
      });
      if (!p) continue;
      // ordenar como en nuestros datos: j1 primero
      const [c1, c2] = apellido(p.j1.nombre) === aa ? [a, b] : [b, a];
      const l1 = c1.linescores || [], l2 = c2.linescores || [];
      const n = Math.max(l1.length, l2.length);
      const sets = [], tiebreaks = [];
      for (let i = 0; i < n; i++) {
        const g1 = Number(l1[i]?.value ?? 0), g2 = Number(l2[i]?.value ?? 0);
        sets.push([g1, g2]);
        const t1 = l1[i]?.tiebreak, t2 = l2[i]?.tiebreak;
        tiebreaks.push(t1 != null || t2 != null ? { p1: Number(t1 ?? (g1 > g2 ? Math.max(7, Number(t2) + 2) : 0)), p2: Number(t2 ?? (g2 > g1 ? Math.max(7, Number(t1) + 2) : 0)) } : null);
      }
      const st = c.status.type;
      const terminado = st.completed === true || st.state === 'post';
      const ganador = terminado ? (c1.winner === true ? 1 : c2.winner === true ? 2 : null) : null;
      res[p.id] = {
        estado: terminado ? (ganador ? 'terminado' : 'interrumpido') : st.state === 'in' ? 'en_vivo' : 'programado',
        detalle: st.detail || st.description || '',
        sets, tiebreaks, ganador,
        j1: p.j1.nombre, j2: p.j2.nombre,
      };
    }
  }
  if (!respondio) throw new Error('ESPN sin respuesta');
  return res;
}
