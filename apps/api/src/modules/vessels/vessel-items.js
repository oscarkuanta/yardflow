import { parse } from 'csv-parse/sync';
import { visitItemSchema } from './vessels.schemas.js';

export const CSV_COLUMNS = [
  'containerNumber',
  'size',
  'isHighCube',
  'loadStatus',
  'isDangerous',
  'imoClass',
  'grossWeightKg',
  'ownerCode',
  'direction',
];

const HEADER_LINE = 1;
const TRUE_WORDS = ['true', 'yes', '1'];
const FALSE_WORDS = ['false', 'no', '0'];

export function csvBoolean(value) {
  const word = value.trim().toLowerCase();
  if (word === '') {
    return undefined;
  }
  if (TRUE_WORDS.includes(word)) {
    return true;
  }
  return FALSE_WORDS.includes(word) ? false : value;
}

export function csvNumberOrNull(value) {
  const text = value.trim();
  if (text === '') {
    return null;
  }
  return /^\d+$/.test(text) ? Number(text) : text;
}

export function csvRecordToInput(record) {
  return {
    containerNumber: record.containerNumber,
    size: record.size.trim().toUpperCase(),
    isHighCube: csvBoolean(record.isHighCube),
    loadStatus: record.loadStatus.trim().toUpperCase(),
    isDangerous: csvBoolean(record.isDangerous),
    imoClass: record.imoClass.trim() === '' ? null : record.imoClass.trim(),
    grossWeightKg: csvNumberOrNull(record.grossWeightKg),
    ownerCode: record.ownerCode,
    direction: record.direction.trim().toUpperCase(),
  };
}

function headerProblems(columns) {
  const missing = CSV_COLUMNS.filter((column) => !columns.includes(column));
  const unknown = columns.filter((column) => !CSV_COLUMNS.includes(column));
  return [
    ...missing.map((column) => ({
      line: HEADER_LINE,
      field: column,
      message: `Column ${column} is missing`,
    })),
    ...unknown.map((column) => ({
      line: HEADER_LINE,
      field: column,
      message: `Column ${column} is not expected`,
    })),
  ];
}

export function readItemsCsv(text) {
  let entries;
  try {
    entries = parse(text, {
      columns: (header) => header.map((column) => column.trim()),
      info: true,
      skip_empty_lines: true,
      bom: true,
    });
  } catch (error) {
    return {
      rows: [],
      problems: [{ line: error.lines ?? HEADER_LINE, field: 'file', message: error.message }],
    };
  }
  if (entries.length === 0) {
    return {
      rows: [],
      problems: [{ line: HEADER_LINE, field: 'file', message: 'The file has no rows' }],
    };
  }
  const problems = headerProblems(entries[0].info.columns.map((column) => column.name));
  if (problems.length > 0) {
    return { rows: [], problems };
  }
  return {
    rows: entries.map(({ record, info }) => ({
      line: info.lines,
      input: csvRecordToInput(record),
    })),
    problems: [],
  };
}

export function validateItemRows(rows) {
  const items = [];
  const problems = [];
  for (const { line, input } of rows) {
    const result = visitItemSchema.safeParse(input);
    if (result.success) {
      items.push({ line, value: result.data });
    } else {
      problems.push(
        ...result.error.issues.map((issue) => ({
          line,
          field: issue.path.join('.') || 'row',
          message: issue.message,
        })),
      );
    }
  }
  return { items, problems };
}

export function duplicateRowProblems(items) {
  const firstLineByKey = new Map();
  const problems = [];
  for (const { line, value } of items) {
    const key = `${value.containerNumber}-${value.direction}`;
    if (firstLineByKey.has(key)) {
      problems.push({
        line,
        field: 'containerNumber',
        message: `Same container and direction as line ${firstLineByKey.get(key)}`,
      });
    } else {
      firstLineByKey.set(key, line);
    }
  }
  return problems;
}
