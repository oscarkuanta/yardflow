import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCALAR_TYPES = {
  Int: 'int',
  String: 'string',
  Boolean: 'boolean',
  DateTime: 'datetime',
  Json: 'json',
  Decimal: 'decimal',
  Float: 'float',
};

export const ERD_START = '<!-- erd:start -->';
export const ERD_END = '<!-- erd:end -->';

function blocksOf(schema, keyword) {
  const pattern = new RegExp(String.raw`^${keyword} (\w+) \{([\s\S]*?)^\}`, 'gm');
  return [...schema.matchAll(pattern)].map(([, name, body]) => ({ name, body }));
}

function parseField(line) {
  const [name, rawType, ...rest] = line.trim().split(/\s+/);
  const attributes = rest.join(' ');
  const relation = /@relation\((?:"(\w+)",?\s*)?(?:fields:\s*\[([^\]]+)\])?/.exec(attributes);
  return {
    name,
    type: rawType.replace(/[[\]?]/g, ''),
    isList: rawType.endsWith('[]'),
    isOptional: rawType.endsWith('?'),
    isId: attributes.includes('@id'),
    isUnique: attributes.includes('@unique'),
    relationName: relation?.[1] ?? null,
    relationFields: relation?.[2] ? relation[2].split(',').map((field) => field.trim()) : [],
  };
}

export function parseSchema(schema) {
  const enums = new Set(blocksOf(schema, 'enum').map((block) => block.name));
  const models = blocksOf(schema, 'model').map(({ name, body }) => ({
    name,
    fields: body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('@@') && !line.startsWith('//'))
      .map(parseField),
  }));
  return { enums, models };
}

function attributeLine(field, foreignKeys, enums) {
  const type = SCALAR_TYPES[field.type] ?? (enums.has(field.type) ? field.type : null);
  if (!type) {
    return null;
  }
  const keys = [
    field.isId && 'PK',
    foreignKeys.has(field.name) && 'FK',
    field.isUnique && 'UK',
  ].filter(Boolean);
  return `    ${type} ${field.name}${keys.length ? ` ${keys.join(', ')}` : ''}`;
}

function backReference(models, owner, field) {
  const target = models.find((model) => model.name === field.type);
  return target?.fields.find(
    (candidate) =>
      candidate.type === owner.name &&
      candidate.relationFields.length === 0 &&
      candidate.relationName === field.relationName,
  );
}

function relationshipLine(models, owner, field) {
  const back = backReference(models, owner, field);
  const ownerSide = field.isOptional ? '|o' : '||';
  const manySide = back && !back.isList ? 'o|' : 'o{';
  return `  ${field.type} ${ownerSide}--${manySide} ${owner.name} : "${field.name}"`;
}

export function toMermaid({ enums, models }) {
  const lines = ['erDiagram'];
  for (const model of models) {
    const foreignKeys = new Set(model.fields.flatMap((field) => field.relationFields));
    const attributes = model.fields
      .map((field) => attributeLine(field, foreignKeys, enums))
      .filter(Boolean);
    lines.push(`  ${model.name} {`, ...attributes, '  }');
  }
  for (const model of models) {
    for (const field of model.fields.filter((candidate) => candidate.relationFields.length > 0)) {
      lines.push(relationshipLine(models, model, field));
    }
  }
  return lines.join('\n');
}

export function replaceErdBlock(readme, mermaid) {
  const start = readme.indexOf(ERD_START);
  const end = readme.indexOf(ERD_END);
  if (start === -1 || end === -1) {
    throw new Error(`README needs ${ERD_START} and ${ERD_END} markers`);
  }
  const block = `${ERD_START}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n`;
  return `${readme.slice(0, start)}${block}${readme.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  const readmePath = fileURLToPath(new URL('../../../README.md', import.meta.url));
  const mermaid = toMermaid(parseSchema(readFileSync(schemaPath, 'utf8')));
  writeFileSync(readmePath, replaceErdBlock(readFileSync(readmePath, 'utf8'), mermaid));
  console.log('README ERD updated from prisma/schema.prisma');
}
