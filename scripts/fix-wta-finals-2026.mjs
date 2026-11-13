import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n', 'utf8');

const partidos = read('data/partidos.json');
const partido = partidos['216547'];
if (!partido) throw new Error('No se encontró el partido WTA Finals 216547.');
Object.assign(partido, {
  estado: 'finalizado',
  cubierto: true,
  score: { games: [[2, 4], [6, 6]], sets: [0, 2], puntos: ['0', '0'], saca: 2 },
  confirmado: true,
  ganador: 2
});
write('data/partidos.json', partidos);
console.log('Resultado Noskova-Kostyuk corregido.');

const finales = read('content/finales.json');
const evento = finales.eventos.find((e) => e.id === 'wta-finals-2026');
if (!evento) throw new Error('No se encontró el evento WTA Finals 2026.');
evento.sede = 'Riad, Arabia Saudita';
evento.sede_en = 'Riyadh, Saudi Arabia';
const grupo = evento.grupos?.find((g) => g.nombre === 'Grupo 1');
if (grupo) grupo.jugadores = ['Linda Noskova', 'Jessica Pegula', 'Coco Gauff', 'Marta Kostyuk'];
write('content/finales.json', finales);
console.log('Sede y orden del Grupo 1 corregidos.');

const slug = '2026-11-13-pegula-noskova-finals-riyadh';
const nota = read(`content/notas/${slug}.json`);
nota.bajada = 'La estadounidense remontó, salvó un match point y se clasificó para las semifinales del torneo de fin de temporada en Riad.';
nota.cuerpo[0] = 'Jessica Pegula superó a Linda Noskova por 7-6(2), 4-6, 7-5 en un encuentro de la fase de grupos de las WTA Finals. La estadounidense salvó un match point y consiguió un triunfo decisivo para avanzar a las semifinales.';
nota.cuerpo[2] = 'Con esta victoria, Pegula se clasificó para las semifinales y dejó a Coco Gauff fuera de la lucha por el título. El Grupo 1 terminó con Noskova en el primer puesto (2-1 en victorias y 5-2 en sets), Pegula segunda (2-1 y 5-3), Gauff tercera (2-1 y 4-3) y Kostyuk cuarta (0-3).';
write(`content/notas/${slug}.json`, nota);
console.log('Artículo de Pegula corregido sin duplicarlo.');
