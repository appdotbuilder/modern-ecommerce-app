import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, productVariationsTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CreateProductVariationInput, type AuthContext } from '../schema';
import { createProductVariation } from '../handlers/products/create_product_variation';

describe('createProductVariation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let adminContext: AuthContext;
  let customerContext: AuthContext;
  let productId: number;

  beforeEach(async () => {
    // Create test users
    const adminUser = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hash123',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      })
      .returning()
      .execute();

    const customerUser = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hash123',
        first_name: 'Customer',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    adminContext = {
      user_id: adminUser[0].id,
      role: 'admin'
    };

    customerContext = {
      user_id: customerUser[0].id,
      role: 'customer'
    };

    // Create test product
    const product = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A test product',
        type: 'shirt',
        gender: 'unisex',
        base_price: '29.99',
        is_active: true
      })
      .returning()
      .execute();

    productId = product[0].id;
  });

  it('should create a product variation as admin', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'size',
      variation_value: 'Large',
      price_adjustment: 5.00,
      stock_quantity: 50
    };

    const result = await createProductVariation(testInput, adminContext);

    // Basic field validation
    expect(result.product_id).toEqual(productId);
    expect(result.variation_type).toEqual('size');
    expect(result.variation_value).toEqual('Large');
    expect(result.price_adjustment).toEqual(5.00);
    expect(typeof result.price_adjustment).toBe('number');
    expect(result.stock_quantity).toEqual(50);
    expect(result.is_available).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('should save product variation to database', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'volume',
      variation_value: '100ml',
      price_adjustment: 10.50,
      stock_quantity: 25
    };

    const result = await createProductVariation(testInput, adminContext);

    // Query using proper drizzle syntax
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, result.id))
      .execute();

    expect(variations).toHaveLength(1);
    expect(variations[0].product_id).toEqual(productId);
    expect(variations[0].variation_type).toEqual('volume');
    expect(variations[0].variation_value).toEqual('100ml');
    expect(parseFloat(variations[0].price_adjustment)).toEqual(10.50);
    expect(variations[0].stock_quantity).toEqual(25);
    expect(variations[0].is_available).toBe(true);
  });

  it('should handle zero price adjustment', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'color',
      variation_value: 'Blue',
      price_adjustment: 0,
      stock_quantity: 30
    };

    const result = await createProductVariation(testInput, adminContext);

    expect(result.price_adjustment).toEqual(0);
    expect(typeof result.price_adjustment).toBe('number');

    // Verify in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, result.id))
      .execute();

    expect(parseFloat(variations[0].price_adjustment)).toEqual(0);
  });

  it('should handle negative price adjustment', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'size',
      variation_value: 'Small',
      price_adjustment: -2.50,
      stock_quantity: 40
    };

    const result = await createProductVariation(testInput, adminContext);

    expect(result.price_adjustment).toEqual(-2.50);
    expect(typeof result.price_adjustment).toBe('number');

    // Verify in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, result.id))
      .execute();

    expect(parseFloat(variations[0].price_adjustment)).toEqual(-2.50);
  });

  it('should reject access for non-admin users', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'size',
      variation_value: 'Medium',
      price_adjustment: 0,
      stock_quantity: 20
    };

    await expect(() => 
      createProductVariation(testInput, customerContext)
    ).toThrow(/access denied.*admin role required/i);
  });

  it('should reject creation for non-existent product', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: 999999, // Non-existent product ID
      variation_type: 'size',
      variation_value: 'Large',
      price_adjustment: 0,
      stock_quantity: 15
    };

    await expect(() => 
      createProductVariation(testInput, adminContext)
    ).toThrow(/product not found/i);
  });

  it('should handle large price adjustments correctly', async () => {
    const testInput: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'premium',
      variation_value: 'Gold Edition',
      price_adjustment: 99.99,
      stock_quantity: 5
    };

    const result = await createProductVariation(testInput, adminContext);

    expect(result.price_adjustment).toEqual(99.99);
    expect(typeof result.price_adjustment).toBe('number');

    // Verify precision is maintained in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, result.id))
      .execute();

    expect(parseFloat(variations[0].price_adjustment)).toEqual(99.99);
  });

  it('should create multiple variations for same product', async () => {
    const variation1Input: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'size',
      variation_value: 'Small',
      price_adjustment: -2.00,
      stock_quantity: 20
    };

    const variation2Input: CreateProductVariationInput = {
      product_id: productId,
      variation_type: 'size',
      variation_value: 'Large',
      price_adjustment: 3.00,
      stock_quantity: 15
    };

    const result1 = await createProductVariation(variation1Input, adminContext);
    const result2 = await createProductVariation(variation2Input, adminContext);

    // Both variations should be created successfully
    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);

    // Both should reference the same product
    expect(result1.product_id).toEqual(productId);
    expect(result2.product_id).toEqual(productId);

    // Verify both exist in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.product_id, productId))
      .execute();

    expect(variations).toHaveLength(2);
  });
});