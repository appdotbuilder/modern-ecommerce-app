import { db } from '../../db';
import { userAddressesTable } from '../../db/schema';
import { type AuthContext } from '../../schema';
import { eq, and } from 'drizzle-orm';

export async function deleteAddress(addressId: number, context: AuthContext): Promise<boolean> {
  try {
    // Delete the address, but only if it belongs to the authenticated user
    const result = await db.delete(userAddressesTable)
      .where(
        and(
          eq(userAddressesTable.id, addressId),
          eq(userAddressesTable.user_id, context.user_id)
        )
      )
      .execute();

    // Check if any rows were affected (address existed and was deleted)
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Address deletion failed:', error);
    throw error;
  }
}