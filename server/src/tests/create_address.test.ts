import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userAddressesTable } from '../db/schema';
import { type CreateAddressInput, type AuthContext } from '../schema';
import { createAddress } from '../handlers/addresses/create_address';
import { eq, and } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer' as const,
};

// Test address input
const testAddressInput: CreateAddressInput = {
  type: 'shipping',
  first_name: 'John',
  last_name: 'Doe',
  street_address: '123 Main St',
  city: 'New York',
  state: 'NY',
  postal_code: '10001',
  country: 'USA',
  phone: '+1-555-123-4567',
  is_default: false,
};

const testContext: AuthContext = {
  user_id: 1,
  role: 'customer',
};

describe('createAddress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new address for valid user', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    const result = await createAddress(testAddressInput, testContext);

    // Verify returned address
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(1);
    expect(result.type).toEqual('shipping');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.street_address).toEqual('123 Main St');
    expect(result.city).toEqual('New York');
    expect(result.state).toEqual('NY');
    expect(result.postal_code).toEqual('10001');
    expect(result.country).toEqual('USA');
    expect(result.phone).toEqual('+1-555-123-4567');
    expect(result.is_default).toEqual(false);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save address to database', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    const result = await createAddress(testAddressInput, testContext);

    // Verify address exists in database
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, result.id))
      .execute();

    expect(addresses).toHaveLength(1);
    expect(addresses[0].user_id).toEqual(1);
    expect(addresses[0].type).toEqual('shipping');
    expect(addresses[0].first_name).toEqual('John');
    expect(addresses[0].last_name).toEqual('Doe');
    expect(addresses[0].street_address).toEqual('123 Main St');
    expect(addresses[0].is_default).toEqual(false);
  });

  it('should handle address without phone', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    const inputWithoutPhone: CreateAddressInput = {
      ...testAddressInput,
      phone: undefined,
    };

    const result = await createAddress(inputWithoutPhone, testContext);

    expect(result.phone).toBeNull();

    // Verify in database
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, result.id))
      .execute();

    expect(addresses[0].phone).toBeNull();
  });

  it('should set address as default when is_default is true', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    const defaultAddressInput: CreateAddressInput = {
      ...testAddressInput,
      is_default: true,
    };

    const result = await createAddress(defaultAddressInput, testContext);

    expect(result.is_default).toEqual(true);

    // Verify in database
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, result.id))
      .execute();

    expect(addresses[0].is_default).toEqual(true);
  });

  it('should unset other default addresses of same type when creating new default', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create first default shipping address
    const firstDefaultAddress: CreateAddressInput = {
      ...testAddressInput,
      street_address: '456 First St',
      is_default: true,
    };

    const firstResult = await createAddress(firstDefaultAddress, testContext);

    // Create second default shipping address
    const secondDefaultAddress: CreateAddressInput = {
      ...testAddressInput,
      street_address: '789 Second St',
      is_default: true,
    };

    const secondResult = await createAddress(secondDefaultAddress, testContext);

    // Verify first address is no longer default
    const firstAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, firstResult.id))
      .execute();

    expect(firstAddresses[0].is_default).toEqual(false);

    // Verify second address is default
    const secondAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, secondResult.id))
      .execute();

    expect(secondAddresses[0].is_default).toEqual(true);
  });

  it('should allow multiple default addresses of different types', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create default shipping address
    const shippingAddress: CreateAddressInput = {
      ...testAddressInput,
      type: 'shipping',
      is_default: true,
    };

    const shippingResult = await createAddress(shippingAddress, testContext);

    // Create default billing address
    const billingAddress: CreateAddressInput = {
      ...testAddressInput,
      type: 'billing',
      street_address: '456 Billing St',
      is_default: true,
    };

    const billingResult = await createAddress(billingAddress, testContext);

    // Verify both addresses remain default
    const shippingAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, shippingResult.id))
      .execute();

    const billingAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, billingResult.id))
      .execute();

    expect(shippingAddresses[0].is_default).toEqual(true);
    expect(billingAddresses[0].is_default).toEqual(true);
  });

  it('should create billing address correctly', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    const billingAddressInput: CreateAddressInput = {
      ...testAddressInput,
      type: 'billing',
      street_address: '456 Billing Ave',
    };

    const result = await createAddress(billingAddressInput, testContext);

    expect(result.type).toEqual('billing');
    expect(result.street_address).toEqual('456 Billing Ave');

    // Verify in database
    const addresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.id, result.id))
      .execute();

    expect(addresses[0].type).toEqual('billing');
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentContext: AuthContext = {
      user_id: 999,
      role: 'customer',
    };

    expect(createAddress(testAddressInput, nonExistentContext)).rejects.toThrow(/user not found/i);
  });

  it('should handle multiple addresses for same user', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Create first address
    const firstAddress: CreateAddressInput = {
      ...testAddressInput,
      street_address: '123 First St',
    };

    const firstResult = await createAddress(firstAddress, testContext);

    // Create second address
    const secondAddress: CreateAddressInput = {
      ...testAddressInput,
      street_address: '456 Second St',
    };

    const secondResult = await createAddress(secondAddress, testContext);

    // Verify both addresses exist for user
    const userAddresses = await db.select()
      .from(userAddressesTable)
      .where(eq(userAddressesTable.user_id, 1))
      .execute();

    expect(userAddresses).toHaveLength(2);
    expect(userAddresses.some(addr => addr.id === firstResult.id)).toBe(true);
    expect(userAddresses.some(addr => addr.id === secondResult.id)).toBe(true);
  });
});