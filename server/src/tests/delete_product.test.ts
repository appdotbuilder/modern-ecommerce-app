import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, usersTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { deleteProduct } from '../handlers/products/delete_product';
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
  name: 'Test Product',
  description: 'A product for testing deletion',
  type: 'perfume' as const,
  gender: 'unisex' as const,
  base_price: '29.99',
  image_url: 'https://example.com/product.jpg',
  is_active: true
};

describe('deleteProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully delete a product when admin', async () => {
    // Create test product
    const [createdProduct] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    // Delete product
    const result = await deleteProduct(createdProduct.id, adminContext);

    // Verify deletion success
    expect(result).toBe(true);

    // Verify product is soft deleted (is_active = false)
    const deletedProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, createdProduct.id))
      .execute();

    expect(deletedProduct).toHaveLength(1);
    expect(deletedProduct[0].is_active).toBe(false);
    expect(deletedProduct[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when non-admin tries to delete product', async () => {
    // Create test product
    const [createdProduct] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    // Attempt to delete as customer
    await expect(deleteProduct(createdProduct.id, customerContext))
      .rejects
      .toThrow(/access denied.*admin role required/i);

    // Verify product was not deleted
    const unchangedProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, createdProduct.id))
      .execute();

    expect(unchangedProduct).toHaveLength(1);
    expect(unchangedProduct[0].is_active).toBe(true);
  });

  it('should throw error when product does not exist', async () => {
    const nonExistentId = 99999;

    await expect(deleteProduct(nonExistentId, adminContext))
      .rejects
      .toThrow(/product not found/i);
  });

  it('should handle already deleted product correctly', async () => {
    // Create test product
    const [createdProduct] = await db.insert(productsTable)
      .values({
        ...testProduct,
        is_active: false // Already inactive
      })
      .returning()
      .execute();

    // Delete already inactive product
    const result = await deleteProduct(createdProduct.id, adminContext);

    // Should still return true
    expect(result).toBe(true);

    // Verify product remains inactive
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, createdProduct.id))
      .execute();

    expect(product).toHaveLength(1);
    expect(product[0].is_active).toBe(false);
  });

  it('should update the updated_at timestamp', async () => {
    // Create test product
    const [createdProduct] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    const originalUpdatedAt = createdProduct.updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Delete product
    await deleteProduct(createdProduct.id, adminContext);

    // Verify updated_at was changed
    const updatedProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, createdProduct.id))
      .execute();

    expect(updatedProduct[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should handle multiple product deletions correctly', async () => {
    // Create multiple test products
    const products = await db.insert(productsTable)
      .values([
        { ...testProduct, name: 'Product 1' },
        { ...testProduct, name: 'Product 2' },
        { ...testProduct, name: 'Product 3' }
      ])
      .returning()
      .execute();

    // Delete first two products
    const result1 = await deleteProduct(products[0].id, adminContext);
    const result2 = await deleteProduct(products[1].id, adminContext);

    expect(result1).toBe(true);
    expect(result2).toBe(true);

    // Verify deletion status
    const allProducts = await db.select()
      .from(productsTable)
      .execute();

    const deletedProducts = allProducts.filter(p => !p.is_active);
    const activeProducts = allProducts.filter(p => p.is_active);

    expect(deletedProducts).toHaveLength(2);
    expect(activeProducts).toHaveLength(1);
    expect(activeProducts[0].name).toBe('Product 3');
  });
});