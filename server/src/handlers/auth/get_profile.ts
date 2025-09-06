import { db } from '../../db';
import { usersTable } from '../../db/schema';
import { type User, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function getProfile(context: AuthContext): Promise<User> {
  try {
    // Fetch user data from database using the user_id from auth context
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, context.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Return user profile with all fields
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
    console.error('Profile fetch failed:', error);
    throw error;
  }
}