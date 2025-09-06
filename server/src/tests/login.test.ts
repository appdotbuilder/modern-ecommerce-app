import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/auth/login';

// Test inputs
const validLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123',
};

const invalidEmailInput: LoginInput = {
  email: 'nonexistent@example.com',
  password: 'password123',
};

const invalidPasswordInput: LoginInput = {
  email: 'test@example.com',
  password: 'wrongpassword',
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with valid credentials', async () => {
    // Create test user with password stored directly (in production, use hashed password)
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'password123', // In production, this would be hashed
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer',
    }).execute();

    const result = await login(validLoginInput);

    // Verify user data is returned correctly
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('customer');
    expect(result.password_hash).toEqual('password123');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should authenticate admin user', async () => {
    // Create test admin user
    await db.insert(usersTable).values({
      email: 'admin@example.com',
      password_hash: 'adminpassword', // In production, this would be hashed
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
    }).execute();

    const adminLoginInput: LoginInput = {
      email: 'admin@example.com',
      password: 'adminpassword',
    };

    const result = await login(adminLoginInput);

    expect(result.email).toEqual('admin@example.com');
    expect(result.role).toEqual('admin');
    expect(result.first_name).toEqual('Admin');
    expect(result.last_name).toEqual('User');
  });

  it('should reject login with non-existent email', async () => {
    // No user created, so email doesn't exist
    await expect(login(invalidEmailInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with wrong password', async () => {
    // Create test user with different password
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'password123', // In production, this would be hashed
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer',
    }).execute();

    await expect(login(invalidPasswordInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle case-sensitive email matching', async () => {
    // Create user with lowercase email
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'password123', // In production, this would be hashed
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer',
    }).execute();

    // Try to login with uppercase email
    const uppercaseEmailInput: LoginInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'password123',
    };

    // Should fail because email matching is case-sensitive
    await expect(login(uppercaseEmailInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should verify database state remains unchanged after failed login', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'password123', // In production, this would be hashed
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer',
    }).execute();

    // Attempt failed login
    try {
      await login(invalidPasswordInput);
    } catch (error) {
      // Expected to fail
    }

    // Verify user still exists and data unchanged
    const users = await db.select()
      .from(usersTable)
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
  });

  it('should handle multiple users with same password', async () => {
    // Create two users with same password
    await db.insert(usersTable).values([
      {
        email: 'user1@example.com',
        password_hash: 'samepassword', // In production, this would be hashed
        first_name: 'User',
        last_name: 'One',
        role: 'customer',
      },
      {
        email: 'user2@example.com',
        password_hash: 'samepassword', // In production, this would be hashed
        first_name: 'User',
        last_name: 'Two',
        role: 'customer',
      }
    ]).execute();

    // Login as first user
    const user1Result = await login({
      email: 'user1@example.com',
      password: 'samepassword',
    });

    expect(user1Result.first_name).toEqual('User');
    expect(user1Result.last_name).toEqual('One');
    expect(user1Result.email).toEqual('user1@example.com');

    // Login as second user
    const user2Result = await login({
      email: 'user2@example.com',
      password: 'samepassword',
    });

    expect(user2Result.first_name).toEqual('User');
    expect(user2Result.last_name).toEqual('Two');
    expect(user2Result.email).toEqual('user2@example.com');
  });
});