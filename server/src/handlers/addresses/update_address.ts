import { db } from '../../db';
import { userAddressesTable } from '../../db/schema';
import { type UpdateAddressInput, type UserAddress, type AuthContext } from '../../schema';
import { eq, and } from 'drizzle-orm';

export const updateAddress = async (input: UpdateAddressInput, context: AuthContext): Promise<UserAddress> => {
  try {
    // First, verify the address exists and belongs to the authenticated user
    const existingAddress = await db.select()
      .from(userAddressesTable)
      .where(and(
        eq(userAddressesTable.id, input.id),
        eq(userAddressesTable.user_id, context.user_id)
      ))
      .execute();

    if (existingAddress.length === 0) {
      throw new Error('Address not found or access denied');
    }

    // If setting this address as default, unset other default addresses of same type
    if (input.is_default === true && input.type) {
      await db.update(userAddressesTable)
        .set({ is_default: false })
        .where(and(
          eq(userAddressesTable.user_id, context.user_id),
          eq(userAddressesTable.type, input.type)
        ))
        .execute();
    }

    // If setting as default but type not provided, use existing type
    if (input.is_default === true && !input.type) {
      await db.update(userAddressesTable)
        .set({ is_default: false })
        .where(and(
          eq(userAddressesTable.user_id, context.user_id),
          eq(userAddressesTable.type, existingAddress[0].type)
        ))
        .execute();
    }

    // Update the address with provided fields
    const updateData: any = {};
    if (input.type !== undefined) updateData.type = input.type;
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.street_address !== undefined) updateData.street_address = input.street_address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.postal_code !== undefined) updateData.postal_code = input.postal_code;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.is_default !== undefined) updateData.is_default = input.is_default;

    // Only update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return existingAddress[0];
    }

    const result = await db.update(userAddressesTable)
      .set(updateData)
      .where(and(
        eq(userAddressesTable.id, input.id),
        eq(userAddressesTable.user_id, context.user_id)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update address');
    }

    return result[0];
  } catch (error) {
    console.error('Address update failed:', error);
    throw error;
  }
};