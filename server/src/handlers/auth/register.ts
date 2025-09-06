import { db } from '../../db';
import { usersTable } from '../../db/schema';
import { type RegisterInput, type User } from '../../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

export async function register(input: RegisterInput): Promise<User> {
  try {
    // Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash the password using Node.js crypto
    const salt = randomBytes(32).toString('hex');
    const hashedPassword = pbkdf2Sync(input.password, salt, 10000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hashedPassword}`;

    // Create new user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: 'customer', // Default role for new registrations
      })
      .returning()
      .execute();

    const user = result[0];
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}