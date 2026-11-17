export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDocument(document: string): string {
  return (document || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }
  return previous[b.length];
}

export function stringSimilarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshteinDistance(left, right);
  return Math.max(0, 1 - distance / Math.max(left.length, right.length));
}

function tokenOverlap(a: string, b: string): number {
  const left = new Set(normalizeText(a).split(' ').filter((token) => token.length > 1));
  const right = new Set(normalizeText(b).split(' ').filter((token) => token.length > 1));
  if (!left.size || !right.size) return 0;
  let matches = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      matches++;
      return;
    }
    let best = 0;
    right.forEach((other) => {
      if (token.length > 2 && other.length > 2) {
        best = Math.max(best, stringSimilarity(token, other));
      }
    });
    if (best >= 0.82) matches += best;
  });
  return matches / Math.max(left.size, right.size);
}

export function nameSimilarity(a: string, b: string): number {
  const direct = stringSimilarity(a, b);
  const overlap = tokenOverlap(a, b);
  const reversed = stringSimilarity(
    a,
    normalizeText(b).split(' ').reverse().join(' ')
  );
  return Math.max(direct, overlap, reversed * 0.98);
}

export function parseDateValue(raw: string, fallbackYear?: number): string | null {
  const text = (raw || '').trim();
  if (!text) return null;

  const iso = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (isValidDate(year, month, day)) return formatIso(year, month, day);
  }

  const dmy = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (isValidDate(year, month, day)) return formatIso(year, month, day);
  }

  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };
  const normalized = normalizeText(text);
  for (const [name, month] of Object.entries(months)) {
    if (!normalized.includes(name)) continue;
    const dayMatch = normalized.match(/(\d{1,2})\s*(?:de\s*)?/);
    const yearMatch = normalized.match(/(\d{4})/);
    const day = dayMatch ? Number(dayMatch[1]) : NaN;
    const year = yearMatch ? Number(yearMatch[1]) : fallbackYear || new Date().getFullYear();
    if (Number.isFinite(day) && isValidDate(year, month, day)) return formatIso(year, month, day);
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseHours(raw: string): number | null {
  const normalized = normalizeText(raw);
  const explicit = normalized.match(/(?:horas?|h)\s*:?\s*(\d{1,2})/);
  if (explicit) {
    const value = Number(explicit[1]);
    if (value >= 1 && value <= 12) return value;
  }
  const standalone = normalized.match(/^(\d{1,2})$/);
  if (standalone) {
    const value = Number(standalone[1]);
    if (value >= 1 && value <= 12) return value;
  }
  return null;
}

export function takeLabeledValue(text: string, labels: string[]): string {
  const lines = (text || '').split(/\r?\n/);
  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    for (const label of labels) {
      const normalizedLabel = normalizeText(label);
      const index = normalizedLine.indexOf(normalizedLabel);
      if (index === -1) continue;
      const after = line.slice(Math.min(line.length, index + label.length)).replace(/^[\s:.-]+/, '').trim();
      if (after.length >= 2) return after;
    }
  }
  return '';
}

export function toTitleCase(value: string): string {
  return (value || '')
    .toLocaleLowerCase('es')
    .replace(/(^|\s|\/)([a-záéíóúñü])/g, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('es')}`);
}

export function pickBestDate(text: string, fallbackYear?: number): string | null {
  const patterns = [
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g,
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+(?:de|del)?\s*\d{4}\b/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (!matches) continue;
    for (const match of matches) {
      const parsed = parseDateValue(match, fallbackYear);
      if (parsed) return parsed;
    }
  }
  return null;
}
