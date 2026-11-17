import { describe, expect, it } from 'vitest';
import { Student } from '../../../types';
import {
  cleanDocument,
  nameSimilarity,
  normalizeText,
  parseDateValue,
  parseHours,
  pickBestDate,
} from '../textUtils';
import {
  cleanOcrName,
  detectColumns,
  OcrLine,
  parseMark,
  parseTesseractTsv,
} from '../sheetParser';
import {
  canConfirm,
  createOmittedRows,
  isBlockingRow,
  markDuplicateRows,
  resolveMatches,
  resolveRowMatch,
} from '../reconcile';
import { DigitizerRow } from '../types';

function student(id: string, name: string, document: string): Student {
  return {
    id,
    name,
    document,
    documentType: 'TI',
    courseId: 'course-1',
    status: 'activo',
  };
}

const roster: Student[] = [
  student('s1', 'Ana María Gómez', '1001'),
  student('s2', 'Juan Carlos Pérez', '1002'),
  student('s3', 'Laura Sofía Ramírez', '1003'),
  student('s4', 'Pedro Antonio López', '1004'),
];

function row(partial: Partial<DigitizerRow>): DigitizerRow {
  return {
    id: partial.id || 'row-1',
    sheetRow: partial.sheetRow || 1,
    studentName: partial.studentName || '',
    status: partial.status || 'presente',
    confidence: partial.confidence ?? 0.8,
    candidates: partial.candidates || [],
    flags: partial.flags || [],
    hours: partial.hours || 2,
    ...partial,
  };
}

describe('textUtils', () => {
  it('normaliza tildes y signos sin perder palabras', () => {
    expect(normalizeText('  José   MUÑOZ  ')).toBe('jose munoz');
    expect(cleanDocument('1.001-ABC')).toBe('1001abc');
  });

  it('compara nombres con orden invertido y errores menores', () => {
    expect(nameSimilarity('Gómez Ana María', 'Ana María Gómez')).toBeGreaterThan(0.92);
    expect(nameSimilarity('Ana Maria Gomes', 'Ana María Gómez')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Ana Gómez', 'Pedro López')).toBeLessThan(0.5);
  });

  it('interpreta fechas y horas', () => {
    expect(parseDateValue('10/11/2026')).toBe('2026-11-10');
    expect(parseDateValue('2026-11-10')).toBe('2026-11-10');
    expect(parseDateValue('10 de noviembre de 2026')).toBe('2026-11-10');
    expect(pickBestDate('Fecha: 10/11/2026 Curso: 10A')).toBe('2026-11-10');
    expect(parseHours('Horas: 3')).toBe(3);
    expect(parseHours('2')).toBe(2);
  });
});

describe('sheetParser', () => {
  it('parsea marcas manuscritas sin inventar estados', () => {
    expect(parseMark('X').status).toBe('falla');
    expect(parseMark('✓').status).toBe('presente');
    expect(parseMark('R').status).toBe('retardo');
    expect(parseMark('J').status).toBe('justificada');
    expect(parseMark('').status).toBe('sin_definir');
    expect(parseMark('duda').status).toBe('sin_definir');
  });

  it('limpia nombres con tildes y eñes', () => {
    expect(cleanOcrName('  JOSÉ   MUÑOZ  ')).toBe('José Muñoz');
    expect(cleanOcrName('123 Juan Pérez X')).toBe('Juan Pérez');
    expect(cleanOcrName('1234')).toBe('');
  });

  it('lee TSV de Tesseract y detecta columnas', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t50\t40\t60\t20\t92\tNombre',
      '5\t1\t1\t1\t1\t2\t300\t40\t90\t20\t90\tAsistencia',
      '5\t1\t1\t2\t1\t1\t60\t100\t160\t20\t88\tAna',
      '5\t1\t1\t2\t1\t2\t230\t100\t80\t20\t88\tGómez',
    ].join('\n');
    const parsed = parseTesseractTsv(tsv);
    expect(parsed.words).toHaveLength(4);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[1].text).toContain('Ana Gómez');

    const lines: OcrLine[] = [
      { text: 'Nombre del estudiante', confidence: 90, bbox: { x: 50, y: 40, width: 220, height: 20 }, words: [{ text: 'Nombre', confidence: 90, bbox: { x: 50, y: 40, width: 60, height: 20 } }] },
      { text: 'Asistencia', confidence: 90, bbox: { x: 400, y: 40, width: 90, height: 20 }, words: [{ text: 'Asistencia', confidence: 90, bbox: { x: 400, y: 40, width: 90, height: 20 } }] },
    ];
    const columns = detectColumns(lines, 1000);
    expect(columns.explicit).toBe(true);
    expect(columns.nameStart).toBeLessThan(columns.markStart);
    expect(columns.markStart).toBeGreaterThanOrEqual(400);
  });
});

describe('reconcile', () => {
  it('coteja coincidencias exactas y cercanas', () => {
    const exact = resolveRowMatch(row({ studentName: 'Ana Maria Gomez' }), roster);
    expect(exact.matchedStudentId).toBe('s1');
    expect(exact.flags).toContain('cotejado');

    const near = resolveRowMatch(row({ studentName: 'Ana Maria Gomes' }), roster);
    expect(near.matchedStudentId).toBe('s1');
  });

  it('marca ilegibles y no inscritos sin asignar estudiantes', () => {
    const blank = resolveRowMatch(row({ studentName: '' }), roster);
    expect(blank.matchedStudentId).toBeUndefined();
    expect(blank.flags).toContain('ilegible');

    const unknown = resolveRowMatch(row({ studentName: 'Zacarías Forastero' }), roster);
    expect(unknown.matchedStudentId).toBeUndefined();
    expect(unknown.flags).toContain('no_inscrito');
  });

  it('agrega filas omitidas de la matrícula', () => {
    const matched = resolveMatches([row({ studentName: 'Ana María Gómez' })], roster);
    const omitted = createOmittedRows(matched, roster, 2);
    expect(omitted).toHaveLength(3);
    expect(omitted.every((item) => item.rosterOnly && item.status === 'sin_definir')).toBe(true);
    expect(omitted.every((item) => item.flags.includes('omitido'))).toBe(true);
  });

  it('detecta duplicados y bloquea la confirmación', () => {
    const rows = [
      resolveRowMatch(row({ id: 'r1', studentName: 'Ana María Gómez' }), roster),
      resolveRowMatch(row({ id: 'r2', studentName: 'Ana María Gómez' }), roster),
    ];
    const withDuplicates = markDuplicateRows(rows);
    expect(withDuplicates.every((item) => item.flags.includes('duplicado'))).toBe(true);
    expect(canConfirm(withDuplicates)).toBe(false);
    expect(isBlockingRow(withDuplicates[0])).toBe(true);

    const resolved = markDuplicateRows(
      withDuplicates.map((item, index) => ({
        ...item,
        id: `fixed-${index}`,
        matchedStudentId: index === 0 ? 's1' : 's2',
        studentName: index === 0 ? 'Ana María Gómez' : 'Juan Carlos Pérez',
      }))
    );
    expect(canConfirm(resolved)).toBe(true);
  });

  it('permite excluir filas bloqueantes con motivo', () => {
    const unknown = resolveRowMatch(row({ studentName: 'Zacarías Forastero' }), roster);
    expect(canConfirm([unknown])).toBe(false);
    expect(canConfirm([{ ...unknown, excluded: true }])).toBe(false);
    expect(canConfirm([{ ...unknown, excluded: true }, resolveRowMatch(row({ studentName: 'Ana María Gómez' }), roster)])).toBe(true);
  });
});
