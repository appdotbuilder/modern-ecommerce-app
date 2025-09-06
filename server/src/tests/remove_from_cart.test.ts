import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, cartTable, cartItemsTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { removeFromCart } from '../handlers/cart/remove_from_cart';
import { eq } from 'drizzle-orm';

describe('removeFromCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const authContext: AuthContext = {
    user_id: 1,
    role: 'customer'
  };

  const setupTestData = async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create another user for testing unauthorized access
    const otherUsers = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Other',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test product
    const products = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A product for testing',
        type: 'shirt',
        gender: 'unisex',
        base_price: '29.99'
      })
      .returning()
      .execute();

    // Create test cart for first user
    const carts = await db.insert(cartTable)
      .values({
        user_id: users[0].id
      })
      .returning()
      .execute();

    // Create test cart for second user
    const otherCarts = await db.insert(cartTable)
      .values({
        user_id: otherUsers[0].id
      })
      .returning()
      .execute();

    // Create test cart items
    const cartItems = await db.insert(cartItemsTable)
      .values([
        {
          cart_id: carts[0].id,
          product_id: products[0].id,
          quantity: 2,
          unit_price: '29.99'
        },
        {
          cart_id: otherCarts[0].id,
          product_id: products[0].id,
          quantity: 1,
          unit_price: '29.99'
        }
      ])
      .returning()
      .execute();

    return {
      user: users[0],
      otherUser: otherUsers[0],
      product: products[0],
      cart: carts[0],
      otherCart: otherCarts[0],
      cartItems
    };
  };

  it('should successfully remove cart item belonging to authenticated user', async () => {
    const { cartItems } = await setupTestData();
    const userCartItem = cartItems[0];

    const result = await removeFromCart(userCartItem.id, authContext);

    expect(result).toBe(true);

    // Verify cart item was deleted from database
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, userCartItem.id))
      .execute();

    expect(remainingItems).toHaveLength(0);
  });

  it('should return false when cart item does not exist', async () => {
    await setupTestData();
    const nonExistentCartItemId = 9999;

    const result = await removeFromCart(nonExistentCartItemId, authContext);

    expect(result).toBe(false);
  });

  it('should return false when cart item belongs to different user', async () => {
    const { cartItems } = await setupTestData();
    const otherUserCartItem = cartItems[1]; // This belongs to the other user

    const result = await removeFromCart(otherUserCartItem.id, authContext);

    expect(result).toBe(false);

    // Verify cart item was NOT deleted from database
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, otherUserCartItem.id))
      .execute();

    expect(remainingItems).toHaveLength(1);
  });

  it('should not affect other cart items when removing one item', async () => {
    const { cart, product } = await setupTestData();

    // Add another cart item for the same user
    const additionalItems = await db.insert(cartItemsTable)
      .values({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        unit_price: '19.99'
      })
      .returning()
      .execute();

    const itemToRemove = additionalItems[0];

    const result = await removeFromCart(itemToRemove.id, authContext);

    expect(result).toBe(true);

    // Verify only the specific item was removed
    const allCartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart.id))
      .execute();

    // Should still have the original cart item
    expect(allCartItems).toHaveLength(1);
    expect(allCartItems[0].id).not.toBe(itemToRemove.id);
  });

  it('should work with admin role', async () => {
    const { cartItems } = await setupTestData();
    const userCartItem = cartItems[0];

    const adminContext: AuthContext = {
      user_id: 1,
      role: 'admin'
    };

    const result = await removeFromCart(userCartItem.id, adminContext);

    expect(result).toBe(true);

    // Verify cart item was deleted
    const remainingItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, userCartItem.id))
      .execute();

    expect(remainingItems).toHaveLength(0);
  });
});