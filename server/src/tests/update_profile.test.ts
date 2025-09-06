import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateProfileInput, type AuthContext } from '../schema';
import { updateProfile } from '../handlers/auth/update_profile';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer' as const,
};

const otherUser = {
  email: 'other@example.com',
  password_hash: 'hashed_password_2',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'customer' as const,
};

describe('updateProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all profile fields', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser])
      .returning()
      .execute();

    const user = users[0];

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      first_name: 'Updated John',
      last_name: 'Updated Doe',
      email: 'updated@example.com'
    };

    const result = await updateProfile(input, context);

    // Verify returned data
    expect(result.first_name).toEqual('Updated John');
    expect(result.last_name).toEqual('Updated Doe');
    expect(result.email).toEqual('updated@example.com');
    expect(result.id).toEqual(user.id);
    expect(result.role).toEqual('customer');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toEqual('hashed_password');
  });

  it('should update partial profile fields', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser])
      .returning()
      .execute();

    const user = users[0];

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      first_name: 'Only First Name Updated'
    };

    const result = await updateProfile(input, context);

    // Verify only first_name was updated
    expect(result.first_name).toEqual('Only First Name Updated');
    expect(result.last_name).toEqual('Doe'); // Original value
    expect(result.email).toEqual('test@example.com'); // Original value
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated data to database', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser])
      .returning()
      .execute();

    const user = users[0];

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      first_name: 'Database Test',
      last_name: 'Updated Name',
      email: 'database-test@example.com'
    };

    await updateProfile(input, context);

    // Query database directly to verify changes
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers).toHaveLength(1);
    const updatedUser = updatedUsers[0];
    expect(updatedUser.first_name).toEqual('Database Test');
    expect(updatedUser.last_name).toEqual('Updated Name');
    expect(updatedUser.email).toEqual('database-test@example.com');
    expect(updatedUser.updated_at).toBeInstanceOf(Date);
    expect(updatedUser.updated_at > user.updated_at).toBe(true);
  });

  it('should allow updating to same email', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser])
      .returning()
      .execute();

    const user = users[0];

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      email: 'test@example.com', // Same email as current
      first_name: 'Updated Name'
    };

    const result = await updateProfile(input, context);

    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('Updated Name');
  });

  it('should throw error when updating to existing email of another user', async () => {
    // Create two test users
    const users = await db.insert(usersTable)
      .values([testUser, otherUser])
      .returning()
      .execute();

    const user1 = users[0];

    const context: AuthContext = {
      user_id: user1.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      email: 'other@example.com' // Email of second user
    };

    await expect(updateProfile(input, context)).rejects.toThrow(/email already exists/i);
  });

  it('should throw error when user does not exist', async () => {
    const context: AuthContext = {
      user_id: 999, // Non-existent user ID
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      first_name: 'Test'
    };

    await expect(updateProfile(input, context)).rejects.toThrow(/user not found/i);
  });

  it('should handle admin role correctly', async () => {
    // Create test admin user
    const adminUser = {
      ...testUser,
      email: 'admin@example.com',
      role: 'admin' as const
    };

    const users = await db.insert(usersTable)
      .values([adminUser])
      .returning()
      .execute();

    const user = users[0];

    const context: AuthContext = {
      user_id: user.id,
      role: 'admin'
    };

    const input: UpdateProfileInput = {
      first_name: 'Admin Updated'
    };

    const result = await updateProfile(input, context);

    expect(result.first_name).toEqual('Admin Updated');
    expect(result.role).toEqual('admin');
  });

  it('should update timestamp correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([testUser])
      .returning()
      .execute();

    const user = users[0];
    const originalUpdatedAt = user.updated_at;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer'
    };

    const input: UpdateProfileInput = {
      first_name: 'Timestamp Test'
    };

    const result = await updateProfile(input, context);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });
});