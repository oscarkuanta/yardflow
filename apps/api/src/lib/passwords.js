import bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 10;

export function hashSecret(secret) {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}
