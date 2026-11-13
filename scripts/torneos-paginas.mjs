// Sección de torneos: índice, página por torneo y cuadro interactivo.
// Se llama desde build.mjs con las herramientas que ya usa el resto del sitio.
import { nombreRonda, nombreCategoria, nombreTorneo, tourBase, slugify, SUPERFICIES, IOC_ISO2, LANG, LOCALE } from './lib/util.mjs';

const ORDEN = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
const NOMBRE_RONDA_CORTO = LANG === 'en' ? { R128: '1st round', R64: '2nd round', R32: 'Round of 32', R16: 'Round of 16', QF: 'QF', SF: 'SF', F: 'Final' } : { R128: '1ª ronda', R64: '2ª ronda', R32: 'Ronda de 32', R16: 'Octavos', QF: 'Cuartos', SF: 'Semis', F: 'Final' };
const NIVEL = { grand_slam: 0, atp_finals: 0, wta_finals: 0, masters_1000: 1, atp_1000: 1, wta_1000: 1, davis_cup: 1, bjk_cup: 1, atp_500: 2, wta_500: 2, atp_250: 3, wta_250: 3 };
const regionES = new Intl.DisplayNames([LANG], { type: 'region' });

export function generarTorneos({ torneos, partidos, esc, paisTag, filaPartido, hora, pagina, escribir, cancha, ARG }) {
  const ahora = Date.now();
  const lista = Object.values(torneos)
    .filter((t) => tourBase(t.tour))
    .map((t) => {
      const finals = /finals/i.test(t.nombre);
      const ms = partidos.filter((p) => p.torneoClave === t.clave && !p.clasificacion)
        .map((p) => (!p.rondaCod && finals ? { ...p, rondaCod: 'RR' } : p)); // en las Finales, los partidos sin ronda son de la fase de grupos
      const singles = ms.filter((p) => !p.dobles), dobles = ms.filter((p) => p.dobles && tourBase(t.tour) !== 'challenger');
      const cat = nombreCategoria(t.tier || (t.meta?.categoria === 'masters_1000' ? 'atp_1000' : t.meta?.categoria), t.tour, t.nombre) || 'Torneo';
      const anio = String(new Date().getFullYear());
      const camp = t.campeones?.[anio]?.singles || null;
      const ultimoCamp = camp ? { anio, ...camp } : Object.entries(t.campeones || {}).sort((a, b) => b[0].localeCompare(a[0])).map(([a, c]) => c.singles && { anio: a, ...c.singles }).find(Boolean) || null;
      // Un estado "en_vivo" solo es confiable si fue refrescado recientemente.
      // Los partidos programados cuya hora ya pasó no deben mantener vivo un torneo.
      const partidoVivo = (p) => p?.estado === 'en_vivo' && ahora - new Date(p.visto || 0).getTime() <= 90 * 60e3;
      const partidoFuturo = (p) => p?.estado === 'programado' && Number.isFinite(Date.parse(p.horario)) && Date.parse(p.horario) > ahora;
      const inicio = Date.parse(t.primeraVez || '');
      const fin = Date.parse(t.ultimaVez || '');
      const dentroDelCalendario = Number.isFinite(inicio) && Number.isFinite(fin) && inicio <= ahora && fin >= ahora;
      const enJuego = !camp && Number.isFinite(inicio) && inicio <= ahora &&
        (ms.some((p) => partidoVivo(p) || partidoFuturo(p)) || dentroDelCalendario);
      const reciente = Number.isFinite(fin) && Number.isFinite(inicio) && inicio <= ahora && ahora - fin < 10 * 86400e3;
      const rondaActual = [...ORDEN].reverse().find((r) => singles.some((p) => p.rondaCod === r)) || (singles.some((p) => p.rondaCod === 'RR') ? 'RR' : null);
      return { ...t, ms, singles, dobles, cat, camp, ultimoCamp, enJuego, reciente, rondaActual,
        slug: finals ? slugify(nombreTorneo(t.nombre)) : slugify(`${nombreTorneo(t.nombre)} ${tourBase(t.tour) === 'challenger' ? (t.tour.includes('women') ? 'wta-125' : 'challenger') : t.tour}`),
        nivel: NIVEL[t.tier] ?? NIVEL[t.meta?.categoria] ?? (tourBase(t.tour) === 'challenger' ? 5 : 4) };
    })
    .filter((t) => t.singles.length && (t.enJuego || t.reciente))
    .sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre));

  const banderaISO = (iso2) => iso2 ? `<img class="bandera" src="/banderas/${iso2.toLowerCase()}.svg" width="20" height="15" alt="${esc(regionES.of(iso2.toUpperCase()))}" loading="lazy">` : '';
  const ciudadPais = (t) => {
    const c = nombreTorneo(t.meta?.ciudad || t.nombre);
    const pais = t.meta?.pais ? regionES.of(t.meta.pais.toUpperCase()) : '';
    return { c, pais, html: `${banderaISO(t.meta?.pais)}<span>${esc(c)}${pais ? `, ${esc(pais)}` : ''}</span>` };
  };
  const sup = (t) => t.meta?.superficie || t.superficie || 'hard';
  const chipSup = (t) => `<span class="chip sup-${esc(sup(t))}">${esc(SUPERFICIES[sup(t)] || sup(t))}${t.meta?.cubierto ? ' · bajo techo' : ''}</span>`;
  const circuito = (t) => tourBase(t.tour) === 'challenger' ? (t.tour.includes('women') ? 'WTA 125' : 'ATP Challenger') : t.tour.toUpperCase();

  // ---------- Cuadro ----------
  function armarCuadro(ms) {
    const porRonda = {};
    for (const p of ms) if (ORDEN.includes(p.rondaCod)) (porRonda[p.rondaCod] ||= []).push(p);
    const primera = ORDEN.findIndex((r) => porRonda[r]?.length);
    if (primera < 0) return null;
    const rondas = ORDEN.slice(primera);
    const slots = {};
    slots.F = [porRonda.F?.[0] || null];
    const ganadorId = (p) => p && p.confirmado && p.ganador ? (p.ganador === 1 ? p.j1 : p.j2)?.id : null;
    for (let i = rondas.length - 2; i >= 0; i--) {
      const r = rondas[i], padre = rondas[i + 1];
      const libres = [...(porRonda[r] || [])];
      const tomar = (id) => { if (!id) return null; const k = libres.findIndex((m) => m.j1?.id === id || m.j2?.id === id); return k >= 0 ? libres.splice(k, 1)[0] : null; };
      let nuevo = [];
      for (const m of slots[padre]) nuevo.push(tomar(m?.j1?.id), tomar(m?.j2?.id));
      // Partidos sin cruce conocido todavía: se ubican en los lugares vacíos, de a pares
      for (let k = 0; k < nuevo.length && libres.length; k++) if (!nuevo[k]) nuevo[k] = libres.shift();
      nuevo.push(...libres);
      if (nuevo.length % 2) nuevo.push(null);
      slots[r] = nuevo;
    }
    // Rondas posteriores: si el partido todavía no existe, se muestran los clasificados
    return rondas.map((r, i) => ({ r, slots: slots[r].map((m, k) => {
      // Partido ya jugado antes de que el sistema lo registrara (o ronda libre): se muestra quién avanzó
      const padre = i < rondas.length - 1 ? slots[rondas[i + 1]][Math.floor(k / 2)] : null;
      if (!m && padre) { const j = k % 2 === 0 ? padre.j1 : padre.j2; if (j) return { m: null, avanzo: j }; }
      if (m || i === 0) return { m };
      const prev = slots[rondas[i - 1]];
      const a = prev[k * 2], b = prev[k * 2 + 1];
      const wa = a && a.confirmado && a.ganador ? (a.ganador === 1 ? a.j1 : a.j2) : null;
      const wb = b && b.confirmado && b.ganador ? (b.ganador === 1 ? b.j1 : b.j2) : null;
      return { m: null, j1: wa, j2: wb };
    }) }));
  }

  function tarjeta({ m, j1, j2, avanzo }) {
    if (avanzo) return `<div class="cm sin-datos"><button type="button" class="cj gana" data-j="${esc(avanzo.id || avanzo.nombre)}">${paisTag(avanzo)}<span class="n">${esc(avanzo.nombre)}</span><span class="sets"></span></button><div class="cm-pie">Sin datos de este partido</div></div>`;
    if (!m && !j1 && !j2) return '<div class="cm vacio-cm"><div class="cj">Por definir</div><div class="cj">Por definir</div></div>';
    const a = m ? m.j1 : j1, b = m ? m.j2 : j2;
    const sv = m?.score?.games?.length === 2 ? m.score.games[0].map((x, i) => [x, m.score.games[1][i]]).filter(([x, y]) => x != null && y != null) : [];
    const fin = m?.confirmado && m?.ganador;
    const vivo = m?.estado === 'en_vivo' && ahora - new Date(m.visto || 0).getTime() <= 90 * 60e3;
    const fila = (j, k) => {
      if (!j) return '<div class="cj tbd">Por definir</div>';
      const gana = fin && m.ganador === k, pierde = fin && m.ganador !== k;
      const celdas = (vivo || fin) ? sv.map(([x, y]) => { const mio = k === 1 ? x : y, otro = k === 1 ? y : x; return `<i${mio > otro ? ' class="g"' : ''}>${mio}</i>`; }).join('') : '';
      return `<button type="button" class="cj${gana ? ' gana' : ''}${pierde ? ' pierde' : ''}" data-j="${esc(j.id || j.nombre)}">${paisTag(j)}<span class="n">${esc(j.nombre)}</span><span class="sets">${celdas}</span></button>`;
    };
    let pie = '';
    if (vivo) pie = '<div class="cm-pie vivo"><span class="vivo-dot"></span>En vivo</div>';
    else if (m?.estado === 'programado' && m.horario) pie = `<div class="cm-pie">${hora(m.horario, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`;
    else if (m && !fin && ['finalizado', 'por_confirmar'].includes(m.estado)) pie = '<div class="cm-pie">Resultado a confirmar</div>';
    else if (m?.resultado && ['retired', 'walkover'].includes(m.resultado)) pie = `<div class="cm-pie">${m.resultado === 'retired' ? 'Retiro' : 'W.O.'}</div>`;
    return `<div class="cm${vivo ? ' en-vivo' : ''}">${fila(a, 1)}${fila(b, 2)}${pie}</div>`;
  }

  function htmlCuadro(ms, id) {
    const c = armarCuadro(ms);
    if (!c) return '<div class="panel"><div class="vacio" style="border:0">El cuadro se arma a medida que se juegan los partidos.</div></div>';
    const chips = c.map(({ r }, i) => `<button type="button" class="ronda-chip" data-ir="${id}-${i}">${NOMBRE_RONDA_CORTO[r]}</button>`).join('');
    const cols = c.map(({ r, slots }, i) => `<section class="rcol" id="${id}-${i}" aria-label="${esc(nombreRonda(r))}"><h3>${NOMBRE_RONDA_CORTO[r]}</h3><div class="rslots">${slots.map((s) => `<div class="slot">${tarjeta(s)}</div>`).join('')}</div></section>`).join('');
    return `<div class="cuadro" data-cuadro>
<div class="cuadro-barra"><div class="ronda-chips" role="group" aria-label="Ir a la ronda">${chips}</div>
<label class="buscar-j"><span class="saltar">Buscar jugador en el cuadro</span><input type="search" placeholder="Buscar jugador…" data-buscar></label></div>
<p class="cuadro-ayuda">Tocá un jugador para ver su camino en el cuadro.</p>
<div class="cuadro-scroll"><div class="cuadro-grid">${cols}</div></div></div>`;
  }

  // ---------- Páginas ----------
  const cardTorneo = (t) => {
    const cp = ciudadPais(t);
    const estado = t.camp ? `<div class="tc-camp"><span class="tc-lbl">Campeón ${t.ultimoCamp.anio}</span><span class="tc-j">${paisTag({ pais: t.camp.pais })}${esc(t.camp.campeon)}</span></div>`
      : t.enJuego ? `<div class="tc-camp"><span class="tc-lbl"><span class="vivo-dot"></span>En juego</span><span class="tc-j">${esc(nombreRonda(t.rondaActual))}</span></div>`
        : '<div class="tc-camp"><span class="tc-lbl">Finalizado</span></div>';
    return `<a class="tcard" href="/torneo/${t.slug}"><div class="tc-top sup-${esc(sup(t))}">${cancha(sup(t)).replace('class="fondo', 'class="fondo tc-fondo')}<span class="etiqueta">${esc(t.cat)}</span></div>
<div class="tc-body"><h3>${esc(nombreTorneo(t.nombre))}</h3>${t.meta ? `<div class="tc-lugar">${cp.html}</div>` : ''}<div class="tc-chips">${chipSup(t)}<span class="chip">${esc(circuito(t))}</span></div>${estado}</div></a>`;
  };

  const enJuego = lista.filter((t) => t.enJuego), terminados = lista.filter((t) => !t.enJuego);
  const grupo = (titulo, ts) => ts.length ? `<section class="sec"><div class="sec-tit"><h2>${titulo}</h2></div><div class="tgrid">${ts.map(cardTorneo).join('')}</div></section>` : '';
  escribir('torneos.html', pagina({ titulo: 'Torneos', descripcion: 'Cuadros interactivos, campeones y resultados de los torneos ATP, WTA y Challenger.', ruta: '/torneos', activo: 'torneos', cuerpo: `
<div class="sec"><div class="sec-tit"><h1>Torneos</h1></div><p class="meta" style="margin:-6px 0 0">Cuadros interactivos, resultados y campeones de cada torneo del circuito.</p></div>
${grupo('En juego', enJuego)}${grupo('Terminados recientemente', terminados)}
${!lista.length ? '<div class="panel sec"><div class="vacio" style="border:0">No hay torneos en juego en este momento.</div></div>' : ''}` }));

  for (const t of lista) {
    const cp = ciudadPais(t);
    const nombre = nombreTorneo(t.nombre);
    const supTxt = SUPERFICIES[sup(t)] || sup(t);
    const esFinals = /finals/i.test(t.nombre);
    let desc = esFinals
      ? `Las ${t.cat} cierran la temporada del circuito ${circuito(t)}: se juegan con fase de grupos, semifinales y final, sobre ${supTxt}${t.meta?.cubierto ? ', bajo techo' : ''}${cp.pais ? `, en ${cp.c} (${cp.pais})` : ''}.`
      : `${t.cat === 'Torneo' ? 'Este torneo' : `El ${t.cat} de ${nombre}`} forma parte del circuito ${circuito(t)} y se juega sobre ${supTxt}${t.meta?.cubierto ? ', bajo techo' : ', al aire libre'}${cp.pais ? `, en ${cp.c} (${cp.pais})` : ''}.`;
    if (LANG === 'en') {
      const ind = t.meta?.cubierto ? 'indoor ' : '';
      desc = esFinals
        ? `The ${t.cat} close the ${circuito(t)} season with a group stage, semifinals and final, played on ${ind}${supTxt}${cp.pais ? ` in ${cp.c} (${cp.pais})` : ''}.`
        : `${t.cat === 'Torneo' ? 'This tournament' : `The ${nombre} ${t.cat}`} is part of the ${circuito(t)} tour and is played on ${t.meta?.cubierto ? 'indoor' : 'outdoor'} ${supTxt}${cp.pais ? ` in ${cp.c} (${cp.pais})` : ''}.`;
      if (t.camp) desc += ` The ${t.ultimoCamp.anio} edition ended with ${t.camp.campeon} taking the title, beating ${t.camp.finalista} ${t.camp.marcador} in the final.`;
      else if (t.enJuego && t.rondaActual) desc += ` The current edition has reached the ${nombreRonda(t.rondaActual).toLowerCase()}.`;
    } else if (t.camp) desc += ` La edición ${t.ultimoCamp.anio} terminó con el título de ${t.camp.campeon}, que le ganó la final a ${t.camp.finalista} por ${t.camp.marcador}.`;
    else if (t.enJuego && t.rondaActual) desc += ` La edición en curso ya está en ${nombreRonda(t.rondaActual).toLowerCase()}.`;
    const campeonHTML = t.ultimoCamp ? `<div class="campeon"><div class="campeon-lbl">${t.camp ? 'Campeón' : 'Último campeón registrado'} ${t.ultimoCamp.anio}</div>
<div class="campeon-j">${paisTag({ pais: t.ultimoCamp.pais })}<strong>${esc(t.ultimoCamp.campeon)}</strong></div>
<div class="campeon-f">Final: venció a ${esc(t.ultimoCamp.finalista)} · ${esc(t.ultimoCamp.marcador)}</div></div>`
      : t.enJuego
        ? `<div class="campeon pend"><div class="campeon-lbl">Campeón</div><div class="campeon-f">Se conoce el día de la final${t.rondaActual ? ` · hoy: ${esc(nombreRonda(t.rondaActual).toLowerCase())}` : ''}.</div></div>`
        : `<div class="campeon pend"><div class="campeon-lbl">Edición finalizada</div><div class="campeon-f">El resultado final todavía no pudo confirmarse con la fuente de datos.</div></div>`;
    const hoy = t.ms.filter((p) =>
      (p.estado === 'en_vivo' && ahora - new Date(p.visto || 0).getTime() <= 90 * 60e3) ||
      (p.estado === 'programado' && Number.isFinite(Date.parse(p.horario)) && Date.parse(p.horario) > ahora)
    ).sort((a, b) => String(a.horario).localeCompare(String(b.horario)));
    const tabs = t.dobles.length ? `<div class="tabs cuadro-tabs" role="tablist"><button role="tab" id="t-s" aria-controls="cs" aria-selected="true">Singles</button><button role="tab" id="t-d" aria-controls="cd" aria-selected="false">Dobles</button></div>` : '';
    escribir(`torneo/${t.slug}.html`, pagina({
      titulo: `${nombre} ${t.ultimoCamp?.anio || new Date().getFullYear()}: ${LANG === 'en' ? 'draw and results' : 'cuadro y resultados'}`, descripcion: desc, ruta: `/torneo/${t.slug}`, activo: 'torneos',
      cuerpo: `<section class="t-hero sup-${esc(sup(t))}">${cancha(sup(t))}<div class="t-hero-in">
<span class="etiqueta">${esc(t.cat)}</span><h1>${esc(nombre)}</h1>
${t.meta ? `<div class="t-lugar">${cp.html}</div>` : ''}<div class="tc-chips">${chipSup(t)}<span class="chip">${esc(circuito(t))}</span>${t.enJuego ? '<span class="chip vivo"><span class="vivo-dot"></span>En juego</span>' : ''}</div></div>${campeonHTML}</section>
<p class="t-desc">${esc(desc)}</p>
${t.singles.some((p) => p.rondaCod === 'RR') ? `<section class="sec"><div class="sec-tit"><h2>Fase de grupos</h2></div><div class="panel"><div class="grupo">${t.singles.filter((p) => p.rondaCod === 'RR').sort((a, b) => String(b.horario).localeCompare(String(a.horario))).map(filaPartido).join('')}</div></div></section>` : ''}
<section class="sec"><div class="sec-tit"><h2>${t.singles.some((p) => p.rondaCod === 'RR') ? 'Etapa final' : 'Cuadro'}</h2></div>
<div data-tabs>${tabs}<div id="cs" role="tabpanel"${t.dobles.length ? ' aria-labelledby="t-s"' : ''}>${htmlCuadro(t.singles, 'cs')}</div>
${t.dobles.length ? `<div id="cd" role="tabpanel" aria-labelledby="t-d" class="oculto">${htmlCuadro(t.dobles, 'cd')}</div>` : ''}</div></section>
${hoy.length ? `<section class="sec"><div class="sec-tit"><h2>Próximos partidos y en vivo</h2></div><div class="panel"><div class="grupo">${hoy.slice(0, 20).map(filaPartido).join('')}</div></div></section>` : ''}`
    }));
  }
  return { lista, cardTorneo, htmlCuadro };
}
