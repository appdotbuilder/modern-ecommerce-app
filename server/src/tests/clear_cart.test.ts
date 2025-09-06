import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, productVariationsTable, cartTable, cartItemsTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { clearCart } from '../handlers/cart/clear_cart';
import { eq } from 'drizzle-orm';

// Test context for authenticated user
const testContext: AuthContext = {
  user_id: 1,
  role: 'customer',
};

describe('clearCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should clear all items from user cart', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing',
        type: 'shirt',
        gender: 'unisex',
        base_price: '19.99',
        is_active: true,
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create product variation
    const variationResult = await db.insert(productVariationsTable)
      .values({
        product_id: productId,
        variation_type: 'size',
        variation_value: 'M',
        price_adjustment: '0.00',
        stock_quantity: 50,
        is_available: true,
      })
      .returning()
      .execute();

    const variationId = variationResult[0].id;

    // Create cart for user
    const cartResult = await db.insert(cartTable)
      .values({
        user_id: userId,
      })
      .returning()
      .execute();

    const cartId = cartResult[0].id;

    // Add multiple items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cartId,
          product_id: productId,
          variation_id: variationId,
          quantity: 2,
          unit_price: '19.99',
        },
        {
          cart_id: cartId,
          product_id: productId,
          variation_id: null,
          quantity: 1,
          unit_price: '19.99',
          custom_design_text: 'Custom Text',
        },
      ])
      .execute();

    // Verify items exist before clearing
    const itemsBeforeClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    expect(itemsBeforeClear).toHaveLength(2);

    // Update context with correct user_id
    const contextWithUserId = { ...testContext, user_id: userId };

    // Clear cart
    const result = await clearCart(contextWithUserId);

    // Verify result
    expect(result).toBe(true);

    // Verify all items are removed
    const itemsAfterClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    expect(itemsAfterClear).toHaveLength(0);

    // Verify cart still exists (only items are deleted)
    const cartAfterClear = await db.select()
      .from(cartTable)
      .where(eq(cartTable.id, cartId))
      .execute();

    expect(cartAfterClear).toHaveLength(1);
  });

  it('should return true when user has no cart', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const contextWithUserId = { ...testContext, user_id: userId };

    // Clear cart when no cart exists
    const result = await clearCart(contextWithUserId);

    // Should return true (considered already cleared)
    expect(result).toBe(true);

    // Verify no cart items exist for this user
    const carts = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, userId))
      .execute();

    expect(carts).toHaveLength(0);
  });

  it('should return true when cart exists but has no items', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create empty cart for user
    const cartResult = await db.insert(cartTable)
      .values({
        user_id: userId,
      })
      .returning()
      .execute();

    const cartId = cartResult[0].id;

    // Update context with correct user_id
    const contextWithUserId = { ...testContext, user_id: userId };

    // Clear empty cart
    const result = await clearCart(contextWithUserId);

    // Should return true
    expect(result).toBe(true);

    // Verify cart still exists
    const cartAfterClear = await db.select()
      .from(cartTable)
      .where(eq(cartTable.id, cartId))
      .execute();

    expect(cartAfterClear).toHaveLength(1);

    // Verify no cart items exist
    const itemsAfterClear = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    expect(itemsAfterClear).toHaveLength(0);
  });

  it('should only clear items from the authenticated users cart', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'One',
        role: 'customer',
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'Two',
        role: 'customer',
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing',
        type: 'shirt',
        gender: 'unisex',
        base_price: '19.99',
        is_active: true,
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create carts for both users
    const cart1Result = await db.insert(cartTable)
      .values({
        user_id: user1Id,
      })
      .returning()
      .execute();

    const cart2Result = await db.insert(cartTable)
      .values({
        user_id: user2Id,
      })
      .returning()
      .execute();

    const cart1Id = cart1Result[0].id;
    const cart2Id = cart2Result[0].id;

    // Add items to both carts
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cart1Id,
          product_id: productId,
          variation_id: null,
          quantity: 1,
          unit_price: '19.99',
        },
        {
          cart_id: cart2Id,
          product_id: productId,
          variation_id: null,
          quantity: 2,
          unit_price: '19.99',
        },
      ])
      .execute();

    // Clear cart for user1 only
    const contextUser1 = { ...testContext, user_id: user1Id };
    const result = await clearCart(contextUser1);

    expect(result).toBe(true);

    // Verify user1's cart is empty
    const user1Items = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart1Id))
      .execute();

    expect(user1Items).toHaveLength(0);

    // Verify user2's cart is unchanged
    const user2Items = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart2Id))
      .execute();

    expect(user2Items).toHaveLength(1);
    expect(user2Items[0].quantity).toBe(2);
  });
});