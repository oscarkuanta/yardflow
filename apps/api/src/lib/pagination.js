import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const SORT_PATTERN = /^(\w+):(asc|desc)$/;

function sortSchema(sortFields, defaultSort) {
  return z
    .string()
    .default(defaultSort)
    .refine(
      (value) => {
        const match = SORT_PATTERN.exec(value);
        return match !== null && sortFields.includes(match[1]);
      },
      `Sort must look like field:asc or field:desc, with field one of ${sortFields.join(', ')}`,
    )
    .transform((value) => {
      const [, field, direction] = SORT_PATTERN.exec(value);
      return { field, direction };
    });
}

export function listQuerySchema({ sortFields, defaultSort, filters = {} }) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sort: sortSchema(sortFields, defaultSort),
    ...filters,
  });
}

export async function paginate(prisma, model, { where, include, query, present }) {
  const { page, pageSize, sort } = query;
  const [rows, total] = await prisma.$transaction([
    model.findMany({
      where,
      include,
      orderBy: [{ [sort.field]: sort.direction }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    model.count({ where }),
  ]);
  return { data: rows.map(present), page, pageSize, total };
}
