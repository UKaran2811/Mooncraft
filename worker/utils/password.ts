/**
 * Password hashing — Workers-compatible.
 * Uses bcryptjs (pure JS, no Node crypto dependency) to stay hash-compatible
 * with the Express backend and any existing rows in the database.
 */

import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (!stored) return false;
    return await bcrypt.compare(password, stored);
  } catch {
    return false;
  }
}