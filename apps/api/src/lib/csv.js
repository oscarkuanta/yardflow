import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { stringify } from 'csv-stringify';

export const EXPORT_BATCH_SIZE = 500;

export async function* batchesOf(model, { where, include, batchSize = EXPORT_BATCH_SIZE }) {
  let lastId = null;
  for (;;) {
    const rows = await model.findMany({
      where,
      include,
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(lastId !== null && { cursor: { id: lastId }, skip: 1 }),
    });
    if (rows.length > 0) {
      yield rows;
    }
    if (rows.length < batchSize) {
      return;
    }
    lastId = rows.at(-1).id;
  }
}

export async function streamCsv(response, { filename, columns, batches, toRow }) {
  response.type('text/csv; charset=utf-8').attachment(filename);
  const stringifier = stringify({
    header: true,
    columns,
    cast: { boolean: (value) => (value ? 'true' : 'false') },
  });
  stringifier.pipe(response);
  for await (const rows of batches) {
    for (const row of rows) {
      if (!stringifier.write(toRow(row))) {
        await once(stringifier, 'drain');
      }
    }
  }
  stringifier.end();
  await finished(response);
}

export function isoOrEmpty(date) {
  return date ? date.toISOString() : '';
}
