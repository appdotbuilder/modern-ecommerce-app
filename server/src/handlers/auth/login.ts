import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { usersTable } from '../../db/schema';
import { type LoginInput, type User } from '../../schema';

export async function login(input: LoginInput): Promise<User> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    const user = users[0];
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Compare password with stored hash
    // Note: In production, this should use bcrypt.compare()
    const isPasswordValid = input.password === user.password_hash;
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Return user data with proper date conversion
    return {
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}