import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userAddressesTable } from '../db/schema';
import { type AuthContext, type CreateAddressInput } from '../schema';
import { getUserAddresses } from '../handlers/addresses/get_user_addresses';

describe('getUserAddresses', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testContext: AuthContext;

  beforeEach(async () => {
    // Create a test user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    testUserId = users[0].id;
    testContext = { user_id: testUserId, role: 'customer' };
  });

  it('should return empty array when user has no addresses', async () => {
    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(0);
    expect(Array.isArray(addresses)).toBe(true);
  });

  it('should return user addresses ordered by default status', async () => {
    // Create multiple addresses for the user
    const addressesToInsert = [
      {
        user_id: testUserId,
        type: 'shipping',
        first_name: 'John',
        last_name: 'Doe',
        street_address: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA',
        phone: '555-0123',
        is_default: false
      },
      {
        user_id: testUserId,
        type: 'billing',
        first_name: 'John',
        last_name: 'Doe',
        street_address: '456 Oak Ave',
        city: 'Boston',
        state: 'MA',
        postal_code: '02101',
        country: 'USA',
        phone: '555-0456',
        is_default: true
      },
      {
        user_id: testUserId,
        type: 'shipping',
        first_name: 'John',
        last_name: 'Doe',
        street_address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        postal_code: '60601',
        country: 'USA',
        phone: null,
        is_default: false
      }
    ];

    await db.insert(userAddressesTable)
      .values(addressesToInsert)
      .execute();

    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(3);

    // Check that default address comes first
    expect(addresses[0].is_default).toBe(true);
    expect(addresses[0].street_address).toBe('456 Oak Ave');
    expect(addresses[0].type).toBe('billing');

    // Check that non-default addresses follow
    expect(addresses[1].is_default).toBe(false);
    expect(addresses[2].is_default).toBe(false);

    // Verify all addresses belong to the test user
    addresses.forEach(address => {
      expect(address.user_id).toBe(testUserId);
      expect(address.id).toBeDefined();
      expect(address.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return addresses with all required fields', async () => {
    const addressData = {
      user_id: testUserId,
      type: 'shipping',
      first_name: 'Jane',
      last_name: 'Smith',
      street_address: '999 Elm St',
      city: 'Seattle',
      state: 'WA',
      postal_code: '98101',
      country: 'USA',
      phone: '555-9999',
      is_default: true
    };

    await db.insert(userAddressesTable)
      .values(addressData)
      .execute();

    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(1);
    const address = addresses[0];

    expect(address.user_id).toBe(testUserId);
    expect(address.type).toBe('shipping');
    expect(address.first_name).toBe('Jane');
    expect(address.last_name).toBe('Smith');
    expect(address.street_address).toBe('999 Elm St');
    expect(address.city).toBe('Seattle');
    expect(address.state).toBe('WA');
    expect(address.postal_code).toBe('98101');
    expect(address.country).toBe('USA');
    expect(address.phone).toBe('555-9999');
    expect(address.is_default).toBe(true);
    expect(address.id).toBeDefined();
    expect(address.created_at).toBeInstanceOf(Date);
  });

  it('should handle nullable phone field correctly', async () => {
    const addressWithoutPhone = {
      user_id: testUserId,
      type: 'billing',
      first_name: 'Bob',
      last_name: 'Wilson',
      street_address: '321 Cedar Rd',
      city: 'Miami',
      state: 'FL',
      postal_code: '33101',
      country: 'USA',
      phone: null,
      is_default: false
    };

    await db.insert(userAddressesTable)
      .values(addressWithoutPhone)
      .execute();

    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(1);
    expect(addresses[0].phone).toBeNull();
    expect(addresses[0].first_name).toBe('Bob');
  });

  it('should only return addresses for the authenticated user', async () => {
    // Create another user
    const otherUsers = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashed_password',
        first_name: 'Other',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    const otherUserId = otherUsers[0].id;

    // Create addresses for both users
    await db.insert(userAddressesTable)
      .values([
        {
          user_id: testUserId,
          type: 'shipping',
          first_name: 'Test',
          last_name: 'User',
          street_address: '123 Test St',
          city: 'Test City',
          state: 'TC',
          postal_code: '12345',
          country: 'USA',
          is_default: true
        },
        {
          user_id: otherUserId,
          type: 'billing',
          first_name: 'Other',
          last_name: 'User',
          street_address: '456 Other St',
          city: 'Other City',
          state: 'OC',
          postal_code: '67890',
          country: 'USA',
          is_default: true
        }
      ])
      .execute();

    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(1);
    expect(addresses[0].user_id).toBe(testUserId);
    expect(addresses[0].first_name).toBe('Test');
    expect(addresses[0].street_address).toBe('123 Test St');
  });

  it('should handle multiple default addresses correctly', async () => {
    // Create multiple addresses with different default statuses
    await db.insert(userAddressesTable)
      .values([
        {
          user_id: testUserId,
          type: 'shipping',
          first_name: 'John',
          last_name: 'Doe',
          street_address: '111 First St',
          city: 'City1',
          state: 'ST',
          postal_code: '11111',
          country: 'USA',
          is_default: true
        },
        {
          user_id: testUserId,
          type: 'billing',
          first_name: 'John',
          last_name: 'Doe',
          street_address: '222 Second St',
          city: 'City2',
          state: 'ST',
          postal_code: '22222',
          country: 'USA',
          is_default: true
        },
        {
          user_id: testUserId,
          type: 'shipping',
          first_name: 'John',
          last_name: 'Doe',
          street_address: '333 Third St',
          city: 'City3',
          state: 'ST',
          postal_code: '33333',
          country: 'USA',
          is_default: false
        }
      ])
      .execute();

    const addresses = await getUserAddresses(testContext);

    expect(addresses).toHaveLength(3);

    // First two should be default addresses (ordered by is_default desc)
    expect(addresses[0].is_default).toBe(true);
    expect(addresses[1].is_default).toBe(true);
    expect(addresses[2].is_default).toBe(false);
    expect(addresses[2].street_address).toBe('333 Third St');
  });
});