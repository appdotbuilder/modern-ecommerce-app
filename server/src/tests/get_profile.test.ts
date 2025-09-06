import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { getProfile } from '../handlers/auth/get_profile';
import { eq } from 'drizzle-orm';

describe('getProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile for valid user_id', async () => {
    // Create a test user
    const userData = {
      email: 'test@example.com',
      password_hash: 'hashed_password_123',
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer' as const,
    };

    const createdUsers = await db.insert(usersTable)
      .values(userData)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Create auth context
    const authContext: AuthContext = {
      user_id: createdUser.id,
      role: 'customer',
    };

    // Call getProfile
    const result = await getProfile(authContext);

    // Verify the returned profile
    expect(result.id).toEqual(createdUser.id);
    expect(result.email).toEqual('test@example.com');
    expect(result.password_hash).toEqual('hashed_password_123');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('customer');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should return profile with admin role', async () => {
    // Create admin user
    const adminUserData = {
      email: 'admin@example.com',
      password_hash: 'admin_hashed_password',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin' as const,
    };

    const createdUsers = await db.insert(usersTable)
      .values(adminUserData)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Create auth context for admin
    const authContext: AuthContext = {
      user_id: createdUser.id,
      role: 'admin',
    };

    const result = await getProfile(authContext);

    expect(result.id).toEqual(createdUser.id);
    expect(result.email).toEqual('admin@example.com');
    expect(result.first_name).toEqual('Admin');
    expect(result.last_name).toEqual('User');
    expect(result.role).toEqual('admin');
  });

  it('should throw error for non-existent user', async () => {
    // Create auth context with non-existent user_id
    const authContext: AuthContext = {
      user_id: 9999, // Non-existent user ID
      role: 'customer',
    };

    // Expect the function to throw an error
    await expect(getProfile(authContext)).rejects.toThrow(/User not found/i);
  });

  it('should fetch updated user data from database', async () => {
    // Create initial user
    const userData = {
      email: 'initial@example.com',
      password_hash: 'initial_hash',
      first_name: 'Initial',
      last_name: 'Name',
      role: 'customer' as const,
    };

    const createdUsers = await db.insert(usersTable)
      .values(userData)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    // Update the user data directly in database
    await db.update(usersTable)
      .set({
        first_name: 'Updated',
        last_name: 'User',
        email: 'updated@example.com',
        updated_at: new Date(),
      })
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    // Create auth context
    const authContext: AuthContext = {
      user_id: createdUser.id,
      role: 'customer',
    };

    // Get profile should return updated data
    const result = await getProfile(authContext);

    expect(result.first_name).toEqual('Updated');
    expect(result.last_name).toEqual('User');
    expect(result.email).toEqual('updated@example.com');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should return all required user fields', async () => {
    // Create user with all possible field values
    const userData = {
      email: 'complete@example.com',
      password_hash: 'complete_hash_value',
      first_name: 'Complete',
      last_name: 'Profile',
      role: 'customer' as const,
    };

    const createdUsers = await db.insert(usersTable)
      .values(userData)
      .returning()
      .execute();

    const createdUser = createdUsers[0];

    const authContext: AuthContext = {
      user_id: createdUser.id,
      role: 'customer',
    };

    const result = await getProfile(authContext);

    // Verify all required fields are present
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('password_hash');
    expect(result).toHaveProperty('first_name');
    expect(result).toHaveProperty('last_name');
    expect(result).toHaveProperty('role');
    expect(result).toHaveProperty('created_at');
    expect(result).toHaveProperty('updated_at');

    // Verify field types
    expect(typeof result.id).toBe('number');
    expect(typeof result.email).toBe('string');
    expect(typeof result.password_hash).toBe('string');
    expect(typeof result.first_name).toBe('string');
    expect(typeof result.last_name).toBe('string');
    expect(typeof result.role).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});