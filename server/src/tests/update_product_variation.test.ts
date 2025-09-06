import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, productVariationsTable, usersTable } from '../db/schema';
import { type UpdateProductVariationInput, type AuthContext } from '../schema';
import { updateProductVariation } from '../handlers/products/update_product_variation';
import { eq } from 'drizzle-orm';

// Test setup data
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

describe('updateProductVariation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testProductId: number;
  let testVariationId: number;

  beforeEach(async () => {
    // Create a test user
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    }).execute();

    // Create a test product
    const productResult = await db.insert(productsTable).values({
      name: 'Test Product',
      description: 'Test description',
      type: 'shirt',
      gender: 'unisex',
      base_price: '29.99',
      is_active: true
    }).returning().execute();

    testProductId = productResult[0].id;

    // Create a test variation
    const variationResult = await db.insert(productVariationsTable).values({
      product_id: testProductId,
      variation_type: 'size',
      variation_value: 'M',
      price_adjustment: '5.00',
      stock_quantity: 10,
      is_available: true
    }).returning().execute();

    testVariationId = variationResult[0].id;
  });

  it('should update a product variation successfully', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      variation_type: 'size',
      variation_value: 'L',
      price_adjustment: 10.50,
      stock_quantity: 15,
      is_available: true
    };

    const result = await updateProductVariation(input, adminContext);

    // Verify returned data
    expect(result.id).toEqual(testVariationId);
    expect(result.product_id).toEqual(testProductId);
    expect(result.variation_type).toEqual('size');
    expect(result.variation_value).toEqual('L');
    expect(result.price_adjustment).toEqual(10.50);
    expect(result.stock_quantity).toEqual(15);
    expect(result.is_available).toEqual(true);
    expect(typeof result.price_adjustment).toEqual('number');
  });

  it('should update only provided fields', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      stock_quantity: 25
    };

    const result = await updateProductVariation(input, adminContext);

    // Verify only stock_quantity was updated
    expect(result.id).toEqual(testVariationId);
    expect(result.variation_type).toEqual('size'); // Original value
    expect(result.variation_value).toEqual('M'); // Original value
    expect(result.price_adjustment).toEqual(5.00); // Original value
    expect(result.stock_quantity).toEqual(25); // Updated value
    expect(result.is_available).toEqual(true); // Original value
  });

  it('should save updated variation to database', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      variation_value: 'XL',
      price_adjustment: 7.25,
      stock_quantity: 5
    };

    await updateProductVariation(input, adminContext);

    // Verify database was updated
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, testVariationId))
      .execute();

    expect(variations).toHaveLength(1);
    expect(variations[0].variation_value).toEqual('XL');
    expect(parseFloat(variations[0].price_adjustment)).toEqual(7.25);
    expect(variations[0].stock_quantity).toEqual(5);
  });

  it('should handle zero price adjustment correctly', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      price_adjustment: 0
    };

    const result = await updateProductVariation(input, adminContext);

    expect(result.price_adjustment).toEqual(0);
    expect(typeof result.price_adjustment).toEqual('number');

    // Verify in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, testVariationId))
      .execute();

    expect(parseFloat(variations[0].price_adjustment)).toEqual(0);
  });

  it('should handle negative price adjustment correctly', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      price_adjustment: -2.50
    };

    const result = await updateProductVariation(input, adminContext);

    expect(result.price_adjustment).toEqual(-2.50);
    expect(typeof result.price_adjustment).toEqual('number');
  });

  it('should update is_available to false', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      is_available: false
    };

    const result = await updateProductVariation(input, adminContext);

    expect(result.is_available).toEqual(false);

    // Verify in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, testVariationId))
      .execute();

    expect(variations[0].is_available).toEqual(false);
  });

  it('should throw error when user is not admin', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      stock_quantity: 20
    };

    await expect(updateProductVariation(input, customerContext))
      .rejects.toThrow(/access denied.*admin role required/i);
  });

  it('should throw error when variation does not exist', async () => {
    const input: UpdateProductVariationInput = {
      id: 99999, // Non-existent ID
      stock_quantity: 20
    };

    await expect(updateProductVariation(input, adminContext))
      .rejects.toThrow(/product variation not found/i);
  });

  it('should handle updating all fields at once', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId,
      variation_type: 'volume',
      variation_value: '100ml',
      price_adjustment: 15.75,
      stock_quantity: 8,
      is_available: false
    };

    const result = await updateProductVariation(input, adminContext);

    expect(result.variation_type).toEqual('volume');
    expect(result.variation_value).toEqual('100ml');
    expect(result.price_adjustment).toEqual(15.75);
    expect(result.stock_quantity).toEqual(8);
    expect(result.is_available).toEqual(false);

    // Verify in database
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, testVariationId))
      .execute();

    expect(variations[0].variation_type).toEqual('volume');
    expect(variations[0].variation_value).toEqual('100ml');
    expect(parseFloat(variations[0].price_adjustment)).toEqual(15.75);
    expect(variations[0].stock_quantity).toEqual(8);
    expect(variations[0].is_available).toEqual(false);
  });

  it('should handle empty update input gracefully', async () => {
    const input: UpdateProductVariationInput = {
      id: testVariationId
    };

    const result = await updateProductVariation(input, adminContext);

    // Should return existing variation unchanged
    expect(result.id).toEqual(testVariationId);
    expect(result.variation_type).toEqual('size');
    expect(result.variation_value).toEqual('M');
    expect(result.price_adjustment).toEqual(5.00);
    expect(result.stock_quantity).toEqual(10);
    expect(result.is_available).toEqual(true);
  });
});