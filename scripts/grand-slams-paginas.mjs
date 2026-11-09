// Sección Grand Slam: cuadros y finales de la temporada, cargados a mano desde fuentes oficiales
// (content/grand-slams.json). Desde 2027 se pueden complementar con los datos automáticos.
import { slugify, SUPERFICIES, LANG, LOCALE } from './lib/util.mjs';
import { tablaTopTen, RONDA_TXT } from './lib/puntos-gs.mjs';

const RONDAS = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
const regionES = new Intl.DisplayNames([LANG], { type: 'region' });
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

export function generarGrandSlams({ datos, rankingDe, partidos, esc, paisTag, pagina, escribir, cancha, htmlCuadro }) {
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
  const num = (n) => n == null ? '<span class="sd">s/d</span>' : Number(n).toLocaleString(LOCALE);
  const tablaPuntos = (tour, titulo) => {
    const T = tablaTopTen({ ranking: rankingDe ? rankingDe(tour) : [], partidos: partidos || [], grandSlams: datos, tour });
    if (!T.filas.length) return '';
    const fila = (f) => `<tr><td class="pos">${f.ranking}</td><td class="jug">${paisTag(f)}${esc(f.nombre)}</td><td>${num(f.puntos)}</td>
<td>${f.rondaDefendida ? esc(RONDA_TXT[f.rondaDefendida] || f.rondaDefendida) : '<span class="sd">s/d</span>'}</td><td class="def">${num(f.defiende)}</td>
${T.enJuego ? `<td>${f.enVivo ? esc(RONDA_TXT[f.enVivo.ronda]) + (f.enVivo.vivo ? '' : ' <span class="sd">(eliminado)</span>') : '—'}</td>` : ''}
<td>${f.siCampeon ? `N° ${f.siCampeon}${f.siCampeon < f.ranking ? ' <span class="sube">▲</span>' : f.siCampeon > f.ranking ? ' <span class="baja">▼</span>' : ''}` : '—'}</td></tr>`;
    return `<div class="pts-bloque"><h3>${titulo}</h3><div class="tabla-scroll"><table class="pts-tabla">
<thead><tr><th>N°</th><th>Jugador</th><th>Puntos</th><th>Ronda ${T.anterior ? T.anterior.anio : 'anterior'}</th><th>Defiende</th>${T.enJuego ? '<th>Ronda actual</th>' : ''}<th>Si es campeón</th></tr></thead>
<tbody>${T.filas.map(fila).join('')}</tbody></table></div>
${T.completo ? '' : `<p class="cuadro-ayuda">Por ahora solo está cargada la final de la edición ${T.anterior?.anio ?? 'anterior'}: los puntos de los demás jugadores se completan al cargar el cuadro entero.</p>`}</div>`;
  };
  const T0 = tablaTopTen({ ranking: [], partidos: [], grandSlams: datos, tour: 'atp' });
  const seccionPuntos = rankingDe ? `<section class="sec pts"><div class="sec-tit"><h2>Puntos que defiende el Top Ten en el ${esc(T0.slam.nombre)} ${T0.slam.anio}</h2></div>
<p class="meta" style="margin:-6px 0 12px">Lo que cada uno sumó en la edición anterior y que pierde del ranking al terminar el torneo. "Si es campeón" muestra el puesto al que llegaría ganando el título, con el resto en los puntos que ya tiene asegurados.</p>
<div class="pts-grid">${tablaPuntos('atp', 'ATP')}${tablaPuntos('wta', 'WTA')}</div>
<p class="meta">Puntos por ronda: ATP (Media Guide 2025) y WTA (tabla de puntos 2026). Ranking y puntos actuales: Live Tennis API.</p></section>` : '';
  escribir('grand-slams.html', pagina({
    titulo: 'Grand Slam', descripcion: 'Los cuatro Grand Slam de la temporada: campeones, finales y cuadros completos.', ruta: '/grand-slams', activo: 'grand-slam',
    cuerpo: `<div class="sec"><div class="sec-tit"><h1>Grand Slam</h1></div><p class="meta" style="margin:-6px 0 0">Australian Open, Roland Garros, Wimbledon y US Open: campeones, finales y cuadros.</p></div>
${seccionPuntos}
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
