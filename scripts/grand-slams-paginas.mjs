// Sección Grand Slam: cuadros y finales de la temporada, cargados a mano desde fuentes oficiales
// (content/grand-slams.json). Desde 2027 se pueden complementar con los datos automáticos.
import { slugify, SUPERFICIES } from './lib/util.mjs';

const RONDAS = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
const regionES = new Intl.DisplayNames(['es'], { type: 'region' });
const CLASE = { 'Australian Open': 'gs-ao', 'Roland Garros': 'gs-rg', Wimbledon: 'gs-wb', 'US Open': 'gs-uso' };

function aPartido(m, i, cuadro) {
  const sets = String(m.marcador || '').trim().split(/\s+/).map((s) => s.match(/^(\d+)-(\d+)/)).filter(Boolean).map((x) => [+x[1], +x[2]]);
  const jug = (x) => ({ id: slugify(x.nombre), nombre: x.seed ? `${x.nombre} [${x.seed}]` : x.nombre, pais: (x.pais || '').toLowerCase() || null });
  const sg = sets.filter(([a, b]) => a > b).length, sp = sets.length - sg;
  return {
    id: `${cuadro}-${i}`, rondaCod: m.ronda, j1: jug(m.ganador), j2: jug(m.perdedor),
    score: { games: [sets.map((s) => s[0]), sets.map((s) => s[1])], sets: [sg, sp] },
    confirmado: true, ganador: 1, estado: 'finalizado', resultado: m.retiro ? 'retired' : m.wo ? 'walkover' : null
  };
}

export function generarGrandSlams({ datos, esc, paisTag, pagina, escribir, cancha, htmlCuadro }) {
  const torneos = (datos?.torneos || []).slice().sort((a, b) => b.anio - a.anio);
  const finalDe = (t, c) => (t.cuadros?.[c]?.partidos || []).find((p) => p.ronda === 'F');
  const bandera = (iso2) => iso2 ? `<img class="bandera" src="/banderas/${iso2.toLowerCase()}.svg" width="20" height="15" alt="${esc(regionES.of(iso2))}">` : '';
  const seedTxt = (j) => (j?.seed ? ` <span class="seed">[${j.seed}]</span>` : '');

  const campeonCard = (t, c, titulo) => {
    const f = finalDe(t, c);
    if (!f) return `<div class="gs-camp"><div class="gs-camp-lbl">${titulo}</div><div class="gs-camp-f">Sin datos todavía</div></div>`;
    return `<div class="gs-camp"><div class="gs-camp-lbl">${titulo}</div>
<div class="gs-camp-j">${paisTag({ pais: f.ganador.pais })}<strong>${esc(f.ganador.nombre)}</strong>${seedTxt(f.ganador)}</div>
<div class="gs-camp-f">Final: venció a ${paisTag({ pais: f.perdedor.pais })} ${esc(f.perdedor.nombre)}${seedTxt(f.perdedor)} · <span class="marc">${esc(f.marcador)}</span></div></div>`;
  };

  const card = (t) => `<a class="gs-card ${CLASE[t.nombre] || ''}" href="/grand-slam/${t.slug}">
<div class="gs-card-top">${cancha(t.superficie)}<div class="gs-card-tit"><span class="etiqueta">Grand Slam ${t.anio}</span><h2>${esc(t.nombre)}</h2>
<div class="t-lugar">${bandera(t.pais)}<span>${esc(t.ciudad)} · ${esc(SUPERFICIES[t.superficie] || t.superficie)}</span></div></div></div>
<div class="gs-card-body">${campeonCard(t, 'masculino', 'Campeón')}${campeonCard(t, 'femenino', 'Campeona')}</div></a>`;

  const anios = [...new Set(torneos.map((t) => t.anio))];
  escribir('grand-slams.html', pagina({
    titulo: 'Grand Slam', descripcion: 'Los cuatro Grand Slam de la temporada: campeones, finales y cuadros completos.', ruta: '/grand-slams', activo: 'grand-slam',
    cuerpo: `<div class="sec"><div class="sec-tit"><h1>Grand Slam</h1></div><p class="meta" style="margin:-6px 0 0">Australian Open, Roland Garros, Wimbledon y US Open: campeones, finales y cuadros.</p></div>
${anios.map((a) => `<section class="sec"><div class="sec-tit"><h2>Temporada ${a}</h2></div><div class="gs-grid">${torneos.filter((t) => t.anio === a).map(card).join('')}</div></section>`).join('')}`
  }));

  for (const t of torneos) {
    const cuadros = ['masculino', 'femenino', 'dobles-masculino', 'dobles-femenino'].filter((c) => t.cuadros?.[c]?.partidos?.length);
    const nombres = { masculino: 'Singles masculino', femenino: 'Singles femenino', 'dobles-masculino': 'Dobles masculino', 'dobles-femenino': 'Dobles femenino' };
    const completo = (c) => { const ps = t.cuadros[c].partidos; return RONDAS.filter((r) => ps.some((p) => p.ronda === r)).length; };
    const tabs = `<div class="tabs cuadro-tabs gs-tabs" role="tablist">${cuadros.map((c, i) => `<button role="tab" id="gt-${c}" aria-controls="gc-${c}" aria-selected="${i === 0}">${nombres[c]}</button>`).join('')}</div>`;
    const paneles = cuadros.map((c, i) => {
      const ps = t.cuadros[c].partidos.map((m, k) => aPartido(m, k, c));
      const aviso = completo(c) < 5 ? '<p class="cuadro-ayuda" style="margin:0 0 10px">El cuadro completo de esta edición se publica próximamente. Por ahora se muestra la final.</p>' : '';
      return `<div id="gc-${c}" role="tabpanel" aria-labelledby="gt-${c}"${i ? ' class="oculto"' : ''}>${aviso}${htmlCuadro(ps, `g${i}`)}</div>`;
    }).join('');
    escribir(`grand-slam/${t.slug}.html`, pagina({
      titulo: `${t.nombre} ${t.anio}: campeones, finales y cuadro`, descripcion: `${t.nombre} ${t.anio} (${t.ciudad}): campeones, resultados de las finales y cuadro completo.`,
      ruta: `/grand-slam/${t.slug}`, activo: 'grand-slam',
      cuerpo: `<section class="t-hero sup-${esc(t.superficie)} ${CLASE[t.nombre] || ''}">${cancha(t.superficie)}<div class="t-hero-in">
<span class="etiqueta">Grand Slam ${t.anio}</span><h1>${esc(t.nombre)}</h1>
<div class="t-lugar">${bandera(t.pais)}<span>${esc(t.ciudad)}, ${esc(regionES.of(t.pais))}</span></div>
<div class="tc-chips"><span class="chip sup-${esc(t.superficie)}">${esc(SUPERFICIES[t.superficie] || t.superficie)}</span><span class="chip">${esc(t.fechas || '')}</span></div></div></section>
<div class="gs-camps">${campeonCard(t, 'masculino', 'Campeón')}${campeonCard(t, 'femenino', 'Campeona')}</div>
<section class="sec"><div class="sec-tit"><h2>Cuadros</h2></div><div data-tabs class="gs-cuadro">${cuadros.length > 1 ? tabs : ''}${paneles}</div></section>
<p class="meta sec">Fuentes: sitios oficiales de ATP, WTA y del torneo.</p>`
    }));
  }
  return { torneos };
}
