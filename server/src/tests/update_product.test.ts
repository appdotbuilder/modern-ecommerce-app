import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type UpdateProductInput, type AuthContext } from '../schema';
import { updateProduct } from '../handlers/products/update_product';
import { eq } from 'drizzle-orm';

// Test data
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

const testProduct = {
  name: 'Original Product',
  description: 'Original description',
  type: 'perfume' as const,
  gender: 'male' as const,
  base_price: '99.99',
  image_url: 'https://example.com/original.jpg',
  is_active: true,
};

const testUpdateInput: UpdateProductInput = {
  id: 1,
  name: 'Updated Product Name',
  description: 'Updated description',
  type: 'shirt' as const,
  gender: 'female' as const,
  base_price: 149.99,
  image_url: 'https://example.com/updated.jpg',
  is_active: false,
};

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a product successfully', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    const result = await updateProduct(testUpdateInput, adminContext);

    // Verify returned product
    expect(result.id).toBe(1);
    expect(result.name).toEqual('Updated Product Name');
    expect(result.description).toEqual('Updated description');
    expect(result.type).toEqual('shirt');
    expect(result.gender).toEqual('female');
    expect(result.base_price).toEqual(149.99);
    expect(typeof result.base_price).toBe('number');
    expect(result.image_url).toEqual('https://example.com/updated.jpg');
    expect(result.is_active).toBe(false);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated product to database', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    await updateProduct(testUpdateInput, adminContext);

    // Query database to verify update
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, 1))
      .execute();

    expect(products).toHaveLength(1);
    const product = products[0];
    expect(product.name).toEqual('Updated Product Name');
    expect(product.description).toEqual('Updated description');
    expect(product.type).toEqual('shirt');
    expect(product.gender).toEqual('female');
    expect(parseFloat(product.base_price)).toEqual(149.99);
    expect(product.image_url).toEqual('https://example.com/updated.jpg');
    expect(product.is_active).toBe(false);
  });

  it('should update only provided fields', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    // Update only name and price
    const partialUpdateInput: UpdateProductInput = {
      id: 1,
      name: 'Partially Updated Product',
      base_price: 199.99,
    };

    const result = await updateProduct(partialUpdateInput, adminContext);

    // Verify updated fields
    expect(result.name).toEqual('Partially Updated Product');
    expect(result.base_price).toEqual(199.99);
    
    // Verify unchanged fields remain the same
    expect(result.description).toEqual('Original description');
    expect(result.type).toEqual('perfume');
    expect(result.gender).toEqual('male');
    expect(result.image_url).toEqual('https://example.com/original.jpg');
    expect(result.is_active).toBe(true);
  });

  it('should update null/nullable fields correctly', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    // Update with null values
    const nullUpdateInput: UpdateProductInput = {
      id: 1,
      gender: null,
      image_url: null,
    };

    const result = await updateProduct(nullUpdateInput, adminContext);

    expect(result.gender).toBeNull();
    expect(result.image_url).toBeNull();
  });

  it('should deny access for non-admin users', async () => {
    // Create customer user
    await db.insert(usersTable).values({
      email: 'customer@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Customer',
      last_name: 'User',
      role: 'customer'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    await expect(updateProduct(testUpdateInput, customerContext))
      .rejects.toThrow(/access denied.*admin role required/i);
  });

  it('should throw error for non-existent product', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    const nonExistentProductInput: UpdateProductInput = {
      id: 999,
      name: 'Non-existent Product',
    };

    await expect(updateProduct(nonExistentProductInput, adminContext))
      .rejects.toThrow(/product not found/i);
  });

  it('should update updated_at timestamp', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    const originalProduct = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    const originalUpdatedAt = originalProduct[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await updateProduct({
      id: 1,
      name: 'Updated Name'
    }, adminContext);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should handle empty update input correctly', async () => {
    // Create admin user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create test product
    await db.insert(productsTable).values(testProduct).execute();

    // Update with only id (no other fields)
    const emptyUpdateInput: UpdateProductInput = {
      id: 1,
    };

    const result = await updateProduct(emptyUpdateInput, adminContext);

    // Verify all original fields remain unchanged except updated_at
    expect(result.name).toEqual('Original Product');
    expect(result.description).toEqual('Original description');
    expect(result.type).toEqual('perfume');
    expect(result.gender).toEqual('male');
    expect(result.base_price).toEqual(99.99);
    expect(result.image_url).toEqual('https://example.com/original.jpg');
    expect(result.is_active).toBe(true);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});