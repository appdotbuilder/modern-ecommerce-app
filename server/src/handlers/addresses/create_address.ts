import { db } from '../../db';
import { userAddressesTable, usersTable } from '../../db/schema';
import { type CreateAddressInput, type UserAddress, type AuthContext } from '../../schema';
import { eq, and } from 'drizzle-orm';

export async function createAddress(input: CreateAddressInput, context: AuthContext): Promise<UserAddress> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, context.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    await db.transaction(async (tx) => {
      // If this address should be default, unset other default addresses of same type
      if (input.is_default) {
        await tx.update(userAddressesTable)
          .set({ is_default: false })
          .where(
            and(
              eq(userAddressesTable.user_id, context.user_id),
              eq(userAddressesTable.type, input.type)
            )
          )
          .execute();
      }

      // Insert new address record
      await tx.insert(userAddressesTable)
        .values({
          user_id: context.user_id,
          type: input.type,
          first_name: input.first_name,
          last_name: input.last_name,
          street_address: input.street_address,
          city: input.city,
          state: input.state,
          postal_code: input.postal_code,
          country: input.country,
          phone: input.phone || null,
          is_default: input.is_default,
        })
        .execute();
    });

    // Retrieve and return the created address
    const createdAddresses = await db.select()
      .from(userAddressesTable)
      .where(
        and(
          eq(userAddressesTable.user_id, context.user_id),
          eq(userAddressesTable.type, input.type),
          eq(userAddressesTable.first_name, input.first_name),
          eq(userAddressesTable.last_name, input.last_name),
          eq(userAddressesTable.street_address, input.street_address)
        )
      )
      .orderBy(userAddressesTable.created_at)
      .execute();

    return createdAddresses[createdAddresses.length - 1]; // Return the most recently created
  } catch (error) {
    console.error('Address creation failed:', error);
    throw error;
  }
}