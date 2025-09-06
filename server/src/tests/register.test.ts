import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput } from '../schema';
import { register } from '../handlers/auth/register';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync } from 'crypto';

// Helper function to verify password hash
const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, hash] = storedHash.split(':');
  const hashVerify = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === hashVerify;
};

// Test input data
const testInput: RegisterInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
};

const secondTestInput: RegisterInput = {
  email: 'jane@example.com',
  password: 'securepass456',
  first_name: 'Jane',
  last_name: 'Smith',
};

describe('register', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await register(testInput);

    // Validate returned user data
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('customer');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123'); // Should be hashed
  });

  it('should hash the password correctly', async () => {
    const result = await register(testInput);

    // Verify password is properly hashed using crypto
    const isValidHash = verifyPassword(testInput.password, result.password_hash);
    expect(isValidHash).toBe(true);

    // Verify original password doesn't match hash directly
    expect(result.password_hash).not.toEqual(testInput.password);
  });

  it('should save user to database', async () => {
    const result = await register(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].last_name).toEqual('Doe');
    expect(users[0].role).toEqual('customer');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);

    // Verify password hash is saved correctly
    const isValidHash = verifyPassword(testInput.password, users[0].password_hash);
    expect(isValidHash).toBe(true);
  });

  it('should throw error for duplicate email', async () => {
    // Register first user
    await register(testInput);

    // Try to register with same email
    const duplicateInput: RegisterInput = {
      ...testInput,
      first_name: 'Different',
      last_name: 'Person',
    };

    await expect(register(duplicateInput)).rejects.toThrow(/email already registered/i);
  });

  it('should allow different users with different emails', async () => {
    // Register first user
    const firstUser = await register(testInput);

    // Register second user with different email
    const secondUser = await register(secondTestInput);

    // Verify both users exist and are different
    expect(firstUser.id).not.toEqual(secondUser.id);
    expect(firstUser.email).toEqual('test@example.com');
    expect(secondUser.email).toEqual('jane@example.com');

    // Verify both are saved in database
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(2);
  });

  it('should set default role as customer', async () => {
    const result = await register(testInput);

    expect(result.role).toEqual('customer');

    // Verify in database as well
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users[0].role).toEqual('customer');
  });

  it('should handle different password lengths correctly', async () => {
    const shortPasswordInput: RegisterInput = {
      email: 'short@example.com',
      password: 'password', // 8 characters (minimum)
      first_name: 'Short',
      last_name: 'Pass',
    };

    const longPasswordInput: RegisterInput = {
      email: 'long@example.com',
      password: 'this_is_a_very_long_and_secure_password_123456789',
      first_name: 'Long',
      last_name: 'Pass',
    };

    // Both should register successfully
    const shortResult = await register(shortPasswordInput);
    const longResult = await register(longPasswordInput);

    // Verify both passwords are hashed correctly
    const shortValid = verifyPassword(shortPasswordInput.password, shortResult.password_hash);
    const longValid = verifyPassword(longPasswordInput.password, longResult.password_hash);

    expect(shortValid).toBe(true);
    expect(longValid).toBe(true);
  });

  it('should handle special characters in names and email', async () => {
    const specialInput: RegisterInput = {
      email: 'test+special@example-domain.com',
      password: 'password123',
      first_name: 'José',
      last_name: "O'Connor",
    };

    const result = await register(specialInput);

    expect(result.email).toEqual('test+special@example-domain.com');
    expect(result.first_name).toEqual('José');
    expect(result.last_name).toEqual("O'Connor");

    // Verify saved to database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users[0].email).toEqual('test+special@example-domain.com');
    expect(users[0].first_name).toEqual('José');
    expect(users[0].last_name).toEqual("O'Connor");
  });
});