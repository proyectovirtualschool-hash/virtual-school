import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const outputDir = path.resolve('fixtures');
fs.mkdirSync(outputDir, { recursive: true });

const students = [
  { name: 'Ana María Gómez', document: '1001', mark: '✓', status: 'presente' },
  { name: 'Juan Carlos Pérez', document: '1002', mark: 'X', status: 'falla' },
  { name: 'Laura Sofía Ramírez', document: '1003', mark: 'R', status: 'retardo' },
  { name: 'Pedro Antonio López', document: '1004', mark: 'J', status: 'justificada' },
  { name: 'María Fernanda Torres', document: '1005', mark: '✓', status: 'presente' },
  { name: 'Andrés Felipe Rojas', document: '1006', mark: 'X', status: 'falla' },
  { name: 'Camila Andrea Díaz', document: '1007', mark: '✓', status: 'presente' },
  { name: 'Santiago Herrera', document: '1008', mark: '', status: 'sin_definir' },
];

const omitted = [
  { name: 'Valentina Castro', document: '1009' },
  { name: 'Sebastián Morales', document: '1010' },
];

const width = 1400;
const height = 1600;
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');

context.fillStyle = '#ffffff';
context.fillRect(0, 0, width, height);

context.fillStyle = '#1e3a8a';
context.fillRect(0, 0, width, 110);
context.fillStyle = '#ffffff';
context.font = 'bold 34px Arial';
context.fillText('COLEGIO SAN PEDRO CLAVER', 50, 52);
context.font = '22px Arial';
context.fillText('Planilla de control de asistencia y fallas', 50, 88);

context.fillStyle = '#0f172a';
context.font = 'bold 22px Arial';
context.fillText('FECHA: 10/11/2026', 50, 165);
context.fillText('CURSO: Grado 10°A', 420, 165);
context.fillText('MATERIA: Matemáticas', 760, 165);
context.fillText('HORAS: 2', 1130, 165);

context.font = '20px Arial';
context.fillText('DOCENTE: Lic. Carlos Pérez', 50, 205);
context.fillText('PERIODO: Periodo 4 - 2026', 760, 205);

const tableX = 40;
const tableY = 270;
const rowHeight = 84;
const columns = [0, 70, 760, 1010, 1400];
context.fillStyle = '#e2e8f0';
context.fillRect(tableX, tableY, width - 80, 54);
context.fillStyle = '#0f172a';
context.font = 'bold 21px Arial';
context.fillText('#', tableX + 18, tableY + 34);
context.fillText('ESTUDIANTE (APELLIDOS Y NOMBRES)', tableX + 90, tableY + 34);
context.fillText('DOCUMENTO', tableX + 790, tableY + 34);
context.fillText('MARCA', tableX + 1080, tableY + 34);

context.strokeStyle = '#94a3b8';
context.lineWidth = 2;
for (let index = 0; index <= students.length; index++) {
  const y = tableY + 54 + index * rowHeight;
  context.beginPath();
  context.moveTo(tableX, y);
  context.lineTo(width - 40, y);
  context.stroke();
}
for (const x of columns) {
  context.beginPath();
  context.moveTo(tableX + x, tableY);
  context.lineTo(tableX + x, tableY + 54 + students.length * rowHeight);
  context.stroke();
}

students.forEach((student, index) => {
  const top = tableY + 54 + index * rowHeight;
  const baseY = top + 53;
  context.fillStyle = '#0f172a';
  context.font = 'bold 22px Arial';
  context.fillText(String(index + 1), tableX + 22, baseY);

  context.font = 'italic 30px Arial';
  context.fillText(student.name, tableX + 100, baseY);

  context.font = '24px Arial';
  context.fillStyle = '#334155';
  context.fillText(student.document, tableX + 790, baseY);

  context.font = 'bold 38px Arial';
  context.fillStyle =
    student.status === 'falla'
      ? '#b91c1c'
      : student.status === 'justificada'
        ? '#1d4ed8'
        : student.status === 'retardo'
          ? '#b45309'
          : '#15803d';
  context.fillText(student.mark || '', tableX + 1110, baseY);
});

context.fillStyle = '#334155';
context.font = '20px Arial';
context.fillText('Observación general: planilla sintética para pruebas del digitalizador.', 50, height - 70);
context.fillText('No contiene datos reales de estudiantes.', 50, height - 40);

const imagePath = path.join(outputDir, 'planilla-demo.png');
fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));

const description = {
  fileName: 'planilla-demo.png',
  synthetic: true,
  note: 'Planilla generada artificialmente. No contiene datos personales reales.',
  expected: {
    date: '2026-11-10',
    course: 'Grado 10°A',
    subject: 'Matemáticas',
    hours: 2,
    teacher: 'Lic. Carlos Pérez',
    rows: students.map((student) => ({
      studentName: student.name,
      document: student.document,
      status: student.status,
      mark: student.mark,
    })),
    omitted: omitted.map((student) => ({
      studentName: student.name,
      document: student.document,
      status: 'sin_definir',
    })),
  },
};
fs.writeFileSync(
  path.join(outputDir, 'planilla-demo.expected.json'),
  JSON.stringify(description, null, 2),
  'utf8'
);

console.log(`Fixtures generados en ${outputDir}`);
