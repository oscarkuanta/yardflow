export const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'pin', 'pinHash']);

export function removeSensitiveFields(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(removeSensitiveFields);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_FIELDS.has(key))
        .map(([key, nested]) => [key, removeSensitiveFields(nested)]),
    );
  }
  return value;
}

function toJsonColumn(value) {
  return value === null || value === undefined ? undefined : removeSensitiveFields(value);
}

export function createAuditService({ prisma }) {
  async function record(entry, client = prisma) {
    return client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: String(entry.entityId),
        before: toJsonColumn(entry.before),
        after: toJsonColumn(entry.after),
        ip: entry.ip ?? null,
      },
    });
  }

  return { record };
}
