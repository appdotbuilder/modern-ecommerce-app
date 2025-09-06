import { db } from '../../db';
import { usersTable } from '../../db/schema';
import { type User, type AuthContext } from '../../schema';

export async function getAllUsers(context: AuthContext): Promise<User[]> {
  try {
    // Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // Query all users from database
    const result = await db.select()
      .from(usersTable)
      .execute();

    // Return users (password_hash is already excluded from User type in schema)
    return result.map(user => ({
      ...user,
      // Convert timestamps to Date objects to match schema expectations
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
}