import { db } from '../../db';
import { userAddressesTable } from '../../db/schema';
import { type UserAddress, type AuthContext } from '../../schema';
import { eq, desc } from 'drizzle-orm';

export async function getUserAddresses(context: AuthContext): Promise<UserAddress[]> {
  try {
    // Query addresses for the authenticated user, ordered by default status first
    const results = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.user_id, context.user_id))
      .orderBy(desc(userAddressesTable.is_default))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch user addresses:', error);
    throw error;
  }
}