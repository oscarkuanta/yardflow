const UNIQUE_CONSTRAINT_FAILED = 'P2002';
const WRITE_CONFLICT_OR_DEADLOCK = 'P2034';

export function isUniqueViolation(error) {
  return error?.code === UNIQUE_CONSTRAINT_FAILED;
}

export function isWriteConflict(error) {
  return error?.code === WRITE_CONFLICT_OR_DEADLOCK;
}

export async function rethrowUniqueViolation(operation, toConflict) {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toConflict();
    }
    throw error;
  }
}
