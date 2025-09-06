import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userAddressesTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { deleteAddress } from '../handlers/addresses/delete_address';
import { eq } from 'drizzle-orm';

describe('deleteAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let otherUserId: number;
  let testAddressId: number;
  let otherUserAddressId: number;
  let authContext: AuthContext;

  beforeEach(async () => {
    // Create test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          role: 'customer'
        },
        {
          email: 'other@example.com',
          password_hash: 'hashed_password',
          first_name: 'Other',
          last_name: 'User',
          role: 'customer'
        }
      ])
      .returning({ id: usersTable.id })
      .execute();

    testUserId = userResults[0].id;
    otherUserId = userResults[1].id;

    // Create test addresses
    const addressResults = await db.insert(userAddressesTable)
      .values([
        {
          user_id: testUserId,
          type: 'shipping',
          first_name: 'Test',
          last_name: 'User',
          street_address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
          country: 'US',
          phone: '555-0123',
          is_default: true
        },
        {
          user_id: otherUserId,
          type: 'billing',
          first_name: 'Other',
          last_name: 'User',
          street_address: '456 Other Ave',
          city: 'Other City',
          state: 'OT',
          postal_code: '67890',
          country: 'US',
          phone: '555-0456',
          is_default: false
        }
      ])
      .returning({ id: userAddressesTable.id })
      .execute();

    testAddressId = addressResults[0].id;
    otherUserAddressId = addressResults[1].id;

    authContext = {
      user_id: testUserId,
      role: 'customer'
    };
  });

  it('should delete user address successfully', async () => {
    const result = await deleteAddress(testAddressId, authContext);

    expect(result).toBe(true);

    // Verify address was deleted from database
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, testAddressId))
      .execute();

    expect(addresses).toHaveLength(0);
  });

  it('should return false when address does not exist', async () => {
    const nonExistentId = 99999;
    const result = await deleteAddress(nonExistentId, authContext);

    expect(result).toBe(false);
  });

  it('should return false when trying to delete another user address', async () => {
    const result = await deleteAddress(otherUserAddressId, authContext);

    expect(result).toBe(false);

    // Verify other user's address still exists
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, otherUserAddressId))
      .execute();

    expect(addresses).toHaveLength(1);
    expect(addresses[0].user_id).toBe(otherUserId);
  });

  it('should work with admin context but still respect user ownership', async () => {
    const adminContext: AuthContext = {
      user_id: testUserId,
      role: 'admin'
    };

    const result = await deleteAddress(testAddressId, adminContext);

    expect(result).toBe(true);

    // Verify address was deleted
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, testAddressId))
      .execute();

    expect(addresses).toHaveLength(0);
  });

  it('should not delete default address from wrong user even as admin', async () => {
    const adminContext: AuthContext = {
      user_id: testUserId, // Admin trying to delete using their own user_id
      role: 'admin'
    };

    // Try to delete other user's address
    const result = await deleteAddress(otherUserAddressId, adminContext);

    expect(result).toBe(false);

    // Verify other user's address still exists
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, otherUserAddressId))
      .execute();

    expect(addresses).toHaveLength(1);
  });

  it('should handle multiple addresses for same user', async () => {
    // Create second address for test user
    const secondAddress = await db.insert(userAddressesTable)
      .values({
        user_id: testUserId,
        type: 'billing',
        first_name: 'Test',
        last_name: 'User',
        street_address: '789 Second St',
        city: 'Test City',
        state: 'TS',
        postal_code: '54321',
        country: 'US',
        is_default: false
      })
      .returning({ id: userAddressesTable.id })
      .execute();

    const secondAddressId = secondAddress[0].id;

    // Delete first address
    const result1 = await deleteAddress(testAddressId, authContext);
    expect(result1).toBe(true);

    // Delete second address
    const result2 = await deleteAddress(secondAddressId, authContext);
    expect(result2).toBe(true);

    // Verify both addresses are deleted
    const remainingAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.user_id, testUserId))
      .execute();

    expect(remainingAddresses).toHaveLength(0);
  });
});