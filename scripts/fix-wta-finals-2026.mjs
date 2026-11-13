import fs from 'fs';
import path from 'path';

const baseDir = path.dirname(fileURLToPath(import.meta.url));

// Fix partidos.json: id 216547
const partidosPath = path.join(baseDir, '..', 'data', 'partidos.json');
const partidos = JSON.parse(fs.readFileSync(partidosPath, 'utf8'));
const partido216547 = partidos.find(p => p.id === 216547);
if (partido216547) {
  partido216547.estado = 'finalizado';
  partido216547.cubierto = true;
  partido216547.score = {
    games: [[2, 4], [6, 6]],
    sets: [0, 2],
    puntos: ['0', '0'],
    saca: 2
  };
  partido216547.confirmado = true;
  partido216547.ganador = 2;
  fs.writeFileSync(partidosPath, JSON.stringify(partidos, null, 2) + '\n', 'utf8');
  console.log('Fixed partidos.json id 216547');
}

// Fix notas-registro.json: set key 215418 to the note slug
const registroPath = path.join(baseDir, '..', 'data', 'notas-registro.json');
const registro = JSON.parse(fs.readFileSync(registroPath, 'utf8'));
registro['215418'] = '2026-11-13-pegula-noskova-finals-riyadh';
fs.writeFileSync(registroPath, JSON.stringify(registro, null, 2) + '\n', 'utf8');
console.log('Fixed notas-registro.json key 215418');

// Fix finales.json: reorder Grupo 1 jugadores
const finalesPath = path.join(baseDir, '..', 'content', 'finales.json');
const finales = JSON.parse(fs.readFileSync(finalesPath, 'utf8'));
const wtaEvent = finales.eventos.find(e => e.id === 'wta-finals-2026');
if (wtaEvent) {
  const grupo1 = wtaEvent.grupos.find(g => g.nombre === 'Grupo 1');
  if (grupo1) {
    grupo1.jugadores = ['Linda Noskova', 'Jessica Pegula', 'Coco Gauff', 'Marta Kostyuk'];
    fs.writeFileSync(finalesPath, JSON.stringify(finales, null, 2) + '\n', 'utf8');
    console.log('Fixed finales.json Grupo 1 roster order');
  }
}

console.log('All fixes applied successfully');
