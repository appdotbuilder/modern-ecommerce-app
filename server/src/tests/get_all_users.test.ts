import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { getAllUsers } from '../handlers/admin/get_all_users';


// Test auth contexts
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

describe('getAllUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all users for admin', async () => {
    // Create test users
    const password_hash = 'hashed_password_123';
    
    await db.insert(usersTable)
      .values([
        {
          email: 'admin@test.com',
          password_hash,
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        },
        {
          email: 'customer1@test.com',
          password_hash,
          first_name: 'John',
          last_name: 'Doe',
          role: 'customer'
        },
        {
          email: 'customer2@test.com',
          password_hash,
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        }
      ])
      .execute();

    const result = await getAllUsers(adminContext);

    // Should return all users
    expect(result).toHaveLength(3);
    
    // Verify user data structure
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.first_name).toBeDefined();
      expect(user.last_name).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
      
      // Verify password_hash is included (it's part of User type)
      expect(user.password_hash).toBeDefined();
    });

    // Verify specific users are returned
    const adminUser = result.find(u => u.email === 'admin@test.com');
    expect(adminUser).toBeDefined();
    expect(adminUser?.role).toBe('admin');
    expect(adminUser?.first_name).toBe('Admin');

    const customer1 = result.find(u => u.email === 'customer1@test.com');
    expect(customer1).toBeDefined();
    expect(customer1?.role).toBe('customer');
    expect(customer1?.first_name).toBe('John');

    const customer2 = result.find(u => u.email === 'customer2@test.com');
    expect(customer2).toBeDefined();
    expect(customer2?.role).toBe('customer');
    expect(customer2?.first_name).toBe('Jane');
  });

  it('should return empty array when no users exist', async () => {
    const result = await getAllUsers(adminContext);
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should throw error for non-admin user', async () => {
    // Create some test users first
    const password_hash = 'hashed_password_123';
    
    await db.insert(usersTable)
      .values([
        {
          email: 'customer@test.com',
          password_hash,
          first_name: 'Customer',
          last_name: 'User',
          role: 'customer'
        }
      ])
      .execute();

    // Customer should not be able to access all users
    await expect(getAllUsers(customerContext)).rejects.toThrow(/access denied.*admin role required/i);
  });

  it('should handle users with different roles correctly', async () => {
    const password_hash = 'hashed_password_123';
    
    await db.insert(usersTable)
      .values([
        {
          email: 'admin1@test.com',
          password_hash,
          first_name: 'Admin',
          last_name: 'One',
          role: 'admin'
        },
        {
          email: 'admin2@test.com',
          password_hash,
          first_name: 'Admin',
          last_name: 'Two',
          role: 'admin'
        },
        {
          email: 'customer@test.com',
          password_hash,
          first_name: 'Customer',
          last_name: 'User',
          role: 'customer'
        }
      ])
      .execute();

    const result = await getAllUsers(adminContext);

    expect(result).toHaveLength(3);
    
    const adminUsers = result.filter(u => u.role === 'admin');
    const customerUsers = result.filter(u => u.role === 'customer');
    
    expect(adminUsers).toHaveLength(2);
    expect(customerUsers).toHaveLength(1);

    // Verify all roles are preserved correctly
    adminUsers.forEach(user => {
      expect(user.role).toBe('admin');
    });
    
    customerUsers.forEach(user => {
      expect(user.role).toBe('customer');
    });
  });

  it('should preserve user data integrity', async () => {
    const password_hash = 'hashed_password_123';
    const now = new Date();
    
    await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash,
          first_name: 'Test',
          last_name: 'User',
          role: 'customer'
        }
      ])
      .execute();

    const result = await getAllUsers(adminContext);
    
    expect(result).toHaveLength(1);
    const user = result[0];
    
    // Verify data types and values
    expect(typeof user.id).toBe('number');
    expect(typeof user.email).toBe('string');
    expect(typeof user.first_name).toBe('string');
    expect(typeof user.last_name).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(typeof user.password_hash).toBe('string');
    
    expect(user.email).toBe('test@example.com');
    expect(user.first_name).toBe('Test');
    expect(user.last_name).toBe('User');
    expect(user.role).toBe('customer');
    
    // Verify timestamps are properly converted
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
    expect(user.created_at.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // Within 1 second
    expect(user.updated_at.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
  });
});