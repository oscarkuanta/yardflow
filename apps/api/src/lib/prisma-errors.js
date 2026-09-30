const UNIQUE_CONSTRAINT_FAILED = 'P2002';

export function isUniqueViolation(error) {
  return error?.code === UNIQUE_CONSTRAINT_FAILED;
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
