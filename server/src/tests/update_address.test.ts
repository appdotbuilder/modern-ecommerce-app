import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { userAddressesTable, usersTable } from '../db/schema';
import { type UpdateAddressInput, type AuthContext } from '../schema';
import { updateAddress } from '../handlers/addresses/update_address';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer' as const,
};

const testAddress = {
  type: 'shipping',
  first_name: 'John',
  last_name: 'Doe',
  street_address: '123 Main St',
  city: 'New York',
  state: 'NY',
  postal_code: '10001',
  country: 'USA',
  phone: '555-1234',
  is_default: false,
};

const testUpdateInput: UpdateAddressInput = {
  id: 1,
  first_name: 'Jane',
  last_name: 'Smith',
  street_address: '456 Oak Ave',
  city: 'Los Angeles',
  state: 'CA',
  postal_code: '90210',
  country: 'USA',
  phone: '555-5678',
};

describe('updateAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update address fields successfully', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    const addressId = addressResult[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = { 
      ...testUpdateInput,
      id: addressId 
    };

    const result = await updateAddress(input, context);

    expect(result.id).toBe(addressId);
    expect(result.user_id).toBe(userId);
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Smith');
    expect(result.street_address).toBe('456 Oak Ave');
    expect(result.city).toBe('Los Angeles');
    expect(result.state).toBe('CA');
    expect(result.postal_code).toBe('90210');
    expect(result.phone).toBe('555-5678');
  });

  it('should save updated address to database', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    const addressId = addressResult[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: addressId,
      city: 'San Francisco',
      postal_code: '94102'
    };

    await updateAddress(input, context);

    // Verify in database
    const savedAddress = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, addressId))
      .execute();

    expect(savedAddress).toHaveLength(1);
    expect(savedAddress[0].city).toBe('San Francisco');
    expect(savedAddress[0].postal_code).toBe('94102');
    expect(savedAddress[0].first_name).toBe('John'); // Unchanged field
  });

  it('should set address as default and unset other defaults of same type', async () => {
    // Create user and two addresses of same type
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const address1Result = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId, is_default: true })
      .returning()
      .execute();
    const address1Id = address1Result[0].id;

    const address2Result = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId, street_address: '789 Pine St', is_default: false })
      .returning()
      .execute();
    const address2Id = address2Result[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: address2Id,
      is_default: true
    };

    const result = await updateAddress(input, context);

    expect(result.is_default).toBe(true);

    // Verify first address is no longer default
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.user_id, userId))
      .execute();

    const firstAddress = addresses.find(addr => addr.id === address1Id);
    const secondAddress = addresses.find(addr => addr.id === address2Id);

    expect(firstAddress?.is_default).toBe(false);
    expect(secondAddress?.is_default).toBe(true);
  });

  it('should handle setting default when changing address type', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    // Create shipping address that is default
    const shippingResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId, type: 'shipping', is_default: true })
      .returning()
      .execute();
    const shippingId = shippingResult[0].id;

    // Create billing address that is default
    const billingResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId, type: 'billing', street_address: '789 Pine St', is_default: true })
      .returning()
      .execute();
    const billingId = billingResult[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: shippingId,
      type: 'billing',
      is_default: true
    };

    await updateAddress(input, context);

    // Verify the updated address is now billing and default
    const updatedAddress = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, shippingId))
      .execute();

    expect(updatedAddress[0].type).toBe('billing');
    expect(updatedAddress[0].is_default).toBe(true);

    // Verify the original billing address is no longer default
    const originalBilling = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, billingId))
      .execute();

    expect(originalBilling[0].is_default).toBe(false);
  });

  it('should throw error for non-existent address', async () => {
    const context: AuthContext = { user_id: 999, role: 'customer' };
    const input: UpdateAddressInput = {
      id: 999,
      city: 'New City'
    };

    expect(updateAddress(input, context)).rejects.toThrow(/Address not found or access denied/i);
  });

  it('should throw error when user tries to update address belonging to another user', async () => {
    // Create two users and one address for first user
    const user1Result = await db.insert(usersTable).values(testUser).returning().execute();
    const user1Id = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({ ...testUser, email: 'user2@example.com' })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: user1Id })
      .returning()
      .execute();
    const addressId = addressResult[0].id;

    // Try to update address as user2
    const context: AuthContext = { user_id: user2Id, role: 'customer' };
    const input: UpdateAddressInput = {
      id: addressId,
      city: 'Unauthorized City'
    };

    expect(updateAddress(input, context)).rejects.toThrow(/Address not found or access denied/i);
  });

  it('should handle partial updates correctly', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    const addressId = addressResult[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: addressId,
      phone: '555-9999' // Only update phone
    };

    const result = await updateAddress(input, context);

    expect(result.phone).toBe('555-9999');
    expect(result.first_name).toBe('John'); // Should remain unchanged
    expect(result.street_address).toBe('123 Main St'); // Should remain unchanged
  });

  it('should handle nullable phone field updates', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    const addressId = addressResult[0].id;

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: addressId,
      phone: null
    };

    const result = await updateAddress(input, context);

    expect(result.phone).toBe(null);
  });

  it('should return unchanged address when no update fields provided', async () => {
    // Create user and address
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const userId = userResult[0].id;

    const addressResult = await db.insert(userAddressesTable)
      .values({ ...testAddress, user_id: userId })
      .returning()
      .execute();
    const addressId = addressResult[0].id;
    const originalAddress = addressResult[0];

    const context: AuthContext = { user_id: userId, role: 'customer' };
    const input: UpdateAddressInput = {
      id: addressId
      // No update fields provided
    };

    const result = await updateAddress(input, context);

    expect(result).toEqual(originalAddress);
  });
});