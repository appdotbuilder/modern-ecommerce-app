import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, cartTable, cartItemsTable } from '../db/schema';
import { type UpdateCartItemInput, type AuthContext } from '../schema';
import { updateCartItem } from '../handlers/cart/update_cart_item';
import { eq } from 'drizzle-orm';

describe('updateCartItem', () => {
  let testUser: any;
  let testProduct: any;
  let testCart: any;
  let testCartItem: any;
  let authContext: AuthContext;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db
      .insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test product
    const productResult = await db
      .insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing',
        type: 'shirt',
        gender: 'unisex',
        base_price: '29.99',
      })
      .returning()
      .execute();
    testProduct = productResult[0];

    // Create test cart
    const cartResult = await db
      .insert(cartTable)
      .values({
        user_id: testUser.id,
      })
      .returning()
      .execute();
    testCart = cartResult[0];

    // Create test cart item
    const cartItemResult = await db
      .insert(cartItemsTable)
      .values({
        cart_id: testCart.id,
        product_id: testProduct.id,
        variation_id: null,
        quantity: 2,
        custom_design_text: 'Original Design',
        custom_design_url: 'https://example.com/original.jpg',
        unit_price: '29.99',
      })
      .returning()
      .execute();
    testCartItem = cartItemResult[0];

    authContext = {
      user_id: testUser.id,
      role: 'customer',
    };
  });

  afterEach(resetDB);

  it('should update cart item quantity', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 5,
    };

    const result = await updateCartItem(input, authContext);

    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(5);
    expect(result.custom_design_text).toEqual('Original Design');
    expect(result.custom_design_url).toEqual('https://example.com/original.jpg');
    expect(typeof result.unit_price).toEqual('number');
    expect(result.unit_price).toEqual(29.99);
  });

  it('should update custom design text', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      custom_design_text: 'Updated Design Text',
    };

    const result = await updateCartItem(input, authContext);

    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(2); // Should remain unchanged
    expect(result.custom_design_text).toEqual('Updated Design Text');
    expect(result.custom_design_url).toEqual('https://example.com/original.jpg'); // Should remain unchanged
  });

  it('should update custom design url', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      custom_design_url: 'https://example.com/updated.jpg',
    };

    const result = await updateCartItem(input, authContext);

    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(2); // Should remain unchanged
    expect(result.custom_design_text).toEqual('Original Design'); // Should remain unchanged
    expect(result.custom_design_url).toEqual('https://example.com/updated.jpg');
  });

  it('should update multiple fields simultaneously', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 3,
      custom_design_text: 'Multi Update Text',
      custom_design_url: 'https://example.com/multi.jpg',
    };

    const result = await updateCartItem(input, authContext);

    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(3);
    expect(result.custom_design_text).toEqual('Multi Update Text');
    expect(result.custom_design_url).toEqual('https://example.com/multi.jpg');
  });

  it('should clear custom design fields when set to null', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      custom_design_text: null,
      custom_design_url: null,
    };

    const result = await updateCartItem(input, authContext);

    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(2); // Should remain unchanged
    expect(result.custom_design_text).toBeNull();
    expect(result.custom_design_url).toBeNull();
  });

  it('should save updates to database', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 4,
      custom_design_text: 'Database Test',
    };

    await updateCartItem(input, authContext);

    // Verify the update was saved to database
    const savedItem = await db
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, testCartItem.id))
      .execute();

    expect(savedItem).toHaveLength(1);
    expect(savedItem[0].quantity).toEqual(4);
    expect(savedItem[0].custom_design_text).toEqual('Database Test');
    expect(savedItem[0].custom_design_url).toEqual('https://example.com/original.jpg'); // Unchanged
  });

  it('should remove cart item when quantity is 0', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 0,
    };

    const result = await updateCartItem(input, authContext);

    // Should return a "deleted" representation
    expect(result.id).toEqual(testCartItem.id);
    expect(result.quantity).toEqual(0);
    expect(result.cart_id).toEqual(0);
    expect(result.product_id).toEqual(0);

    // Verify item was deleted from database
    const deletedItem = await db
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, testCartItem.id))
      .execute();

    expect(deletedItem).toHaveLength(0);
  });

  it('should throw error for non-existent cart item', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: 99999,
      quantity: 3,
    };

    await expect(updateCartItem(input, authContext)).rejects.toThrow(/not found or unauthorized/i);
  });

  it('should throw error when user tries to update another users cart item', async () => {
    // Create another user
    const anotherUserResult = await db
      .insert(usersTable)
      .values({
        email: 'another@example.com',
        password_hash: 'hashed_password',
        first_name: 'Another',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();

    const unauthorizedContext: AuthContext = {
      user_id: anotherUserResult[0].id,
      role: 'customer',
    };

    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 3,
    };

    await expect(updateCartItem(input, unauthorizedContext)).rejects.toThrow(/not found or unauthorized/i);
  });

  it('should handle deletion authorization correctly', async () => {
    // Create another user and their cart item
    const anotherUserResult = await db
      .insert(usersTable)
      .values({
        email: 'another@example.com',
        password_hash: 'hashed_password',
        first_name: 'Another',
        last_name: 'User',
        role: 'customer',
      })
      .returning()
      .execute();

    const anotherCartResult = await db
      .insert(cartTable)
      .values({
        user_id: anotherUserResult[0].id,
      })
      .returning()
      .execute();

    const anotherCartItemResult = await db
      .insert(cartItemsTable)
      .values({
        cart_id: anotherCartResult[0].id,
        product_id: testProduct.id,
        quantity: 1,
        unit_price: '19.99',
      })
      .returning()
      .execute();

    const unauthorizedContext: AuthContext = {
      user_id: testUser.id,
      role: 'customer',
    };

    const input: UpdateCartItemInput = {
      cart_item_id: anotherCartItemResult[0].id,
      quantity: 0, // Try to delete another user's cart item
    };

    await expect(updateCartItem(input, unauthorizedContext)).rejects.toThrow(/not found or unauthorized/i);
  });

  it('should handle partial updates correctly', async () => {
    const input: UpdateCartItemInput = {
      cart_item_id: testCartItem.id,
      quantity: 7,
      // Only update quantity, leave design fields unchanged
    };

    const result = await updateCartItem(input, authContext);

    expect(result.quantity).toEqual(7);
    expect(result.custom_design_text).toEqual('Original Design');
    expect(result.custom_design_url).toEqual('https://example.com/original.jpg');
  });
});