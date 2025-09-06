import { db } from '../../db';
import { usersTable } from '../../db/schema';
import { type UpdateProfileInput, type User, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function updateProfile(input: UpdateProfileInput, context: AuthContext): Promise<User> {
  try {
    // If email is being updated, check for uniqueness
    if (input.email) {
      const existingUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, input.email))
        .execute();

      // If email exists and belongs to a different user, throw error
      if (existingUser.length > 0 && existingUser[0].id !== context.user_id) {
        throw new Error('Email already exists');
      }
    }

    // Update user data in database with provided fields
    const result = await db.update(usersTable)
      .set({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        updated_at: new Date(),
      })
      .where(eq(usersTable.id, context.user_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return result[0];
  } catch (error) {
    console.error('Profile update failed:', error);
    throw error;
  }
}