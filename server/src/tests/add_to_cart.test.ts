import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, productVariationsTable, cartTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput, type AuthContext } from '../schema';
import { addToCart } from '../handlers/cart/add_to_cart';
import { eq, and } from 'drizzle-orm';

// Test user context
const testContext: AuthContext = {
  user_id: 1,
  role: 'customer'
};

// Test input with all required fields
const testInput: AddToCartInput = {
  product_id: 1,
  variation_id: 1,
  quantity: 2,
  custom_design_text: 'Custom Design Text',
  custom_design_url: 'https://example.com/design.jpg'
};

describe('addToCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  async function createTestUser() {
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();
    return user[0];
  }

  async function createTestProduct() {
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
    return product[0];
  }

  async function createTestVariation(productId: number) {
    const variation = await db.insert(productVariationsTable)
      .values({
        product_id: productId,
        variation_type: 'size',
        variation_value: 'Large',
        price_adjustment: '5.00',
        stock_quantity: 10,
        is_available: true
      })
      .returning()
      .execute();
    return variation[0];
  }

  it('should add item to cart for new user (creates cart)', async () => {
    await createTestUser();
    const product = await createTestProduct();
    const variation = await createTestVariation(product.id);

    const input = {
      ...testInput,
      product_id: product.id,
      variation_id: variation.id
    };

    const result = await addToCart(input, testContext);

    // Verify cart item properties
    expect(result.product_id).toEqual(product.id);
    expect(result.variation_id).toEqual(variation.id);
    expect(result.quantity).toEqual(2);
    expect(result.custom_design_text).toEqual('Custom Design Text');
    expect(result.custom_design_url).toEqual('https://example.com/design.jpg');
    expect(result.unit_price).toEqual(34.99); // 29.99 + 5.00 price adjustment
    expect(result.id).toBeDefined();
    expect(result.cart_id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify cart was created for user
    const carts = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, testContext.user_id))
      .execute();

    expect(carts).toHaveLength(1);
    expect(carts[0].user_id).toEqual(testContext.user_id);
  });

  it('should add item to existing cart', async () => {
    await createTestUser();
    const product = await createTestProduct();
    const variation = await createTestVariation(product.id);

    // Create existing cart for user
    const existingCart = await db.insert(cartTable)
      .values({ user_id: testContext.user_id })
      .returning()
      .execute();

    const input = {
      ...testInput,
      product_id: product.id,
      variation_id: variation.id
    };

    const result = await addToCart(input, testContext);

    expect(result.cart_id).toEqual(existingCart[0].id);
    expect(result.product_id).toEqual(product.id);
    expect(result.unit_price).toEqual(34.99); // Base price + variation adjustment
  });

  it('should add item without variation', async () => {
    await createTestUser();
    const product = await createTestProduct();

    const input = {
      product_id: product.id,
      quantity: 1
    };

    const result = await addToCart(input, testContext);

    expect(result.product_id).toEqual(product.id);
    expect(result.variation_id).toBeNull();
    expect(result.quantity).toEqual(1);
    expect(result.custom_design_text).toBeNull();
    expect(result.custom_design_url).toBeNull();
    expect(result.unit_price).toEqual(29.99); // Base price only
  });

  it('should merge quantities for identical items', async () => {
    await createTestUser();
    const product = await createTestProduct();
    const variation = await createTestVariation(product.id);

    // Create cart and existing item
    const cart = await db.insert(cartTable)
      .values({ user_id: testContext.user_id })
      .returning()
      .execute();

    await db.insert(cartItemsTable)
      .values({
        cart_id: cart[0].id,
        product_id: product.id,
        variation_id: variation.id,
        quantity: 3,
        custom_design_text: 'Custom Design Text',
        custom_design_url: 'https://example.com/design.jpg',
        unit_price: '34.99'
      })
      .execute();

    const input = {
      ...testInput,
      product_id: product.id,
      variation_id: variation.id,
      quantity: 2
    };

    const result = await addToCart(input, testContext);

    expect(result.quantity).toEqual(5); // 3 + 2
    expect(result.unit_price).toEqual(34.99);

    // Verify only one cart item exists
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart[0].id))
      .execute();

    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].quantity).toEqual(5);
  });

  it('should create separate items for different custom designs', async () => {
    await createTestUser();
    const product = await createTestProduct();
    const variation = await createTestVariation(product.id);

    // Create cart and existing item with different custom design
    const cart = await db.insert(cartTable)
      .values({ user_id: testContext.user_id })
      .returning()
      .execute();

    await db.insert(cartItemsTable)
      .values({
        cart_id: cart[0].id,
        product_id: product.id,
        variation_id: variation.id,
        quantity: 1,
        custom_design_text: 'Different Design',
        custom_design_url: 'https://example.com/different.jpg',
        unit_price: '34.99'
      })
      .execute();

    const input = {
      ...testInput,
      product_id: product.id,
      variation_id: variation.id
    };

    const result = await addToCart(input, testContext);

    expect(result.quantity).toEqual(2); // New item, not merged
    expect(result.custom_design_text).toEqual('Custom Design Text');

    // Verify two separate cart items exist
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart[0].id))
      .execute();

    expect(cartItems).toHaveLength(2);
  });

  it('should throw error for non-existent product', async () => {
    await createTestUser();

    const input = {
      product_id: 999,
      quantity: 1
    };

    expect(addToCart(input, testContext)).rejects.toThrow(/product not found or inactive/i);
  });

  it('should throw error for inactive product', async () => {
    await createTestUser();
    
    const inactiveProduct = await db.insert(productsTable)
      .values({
        name: 'Inactive Product',
        description: 'An inactive product',
        type: 'shirt',
        gender: 'unisex',
        base_price: '19.99',
        is_active: false
      })
      .returning()
      .execute();

    const input = {
      product_id: inactiveProduct[0].id,
      quantity: 1
    };

    expect(addToCart(input, testContext)).rejects.toThrow(/product not found or inactive/i);
  });

  it('should throw error for non-existent variation', async () => {
    await createTestUser();
    const product = await createTestProduct();

    const input = {
      product_id: product.id,
      variation_id: 999,
      quantity: 1
    };

    expect(addToCart(input, testContext)).rejects.toThrow(/variation not found or unavailable/i);
  });

  it('should throw error for unavailable variation', async () => {
    await createTestUser();
    const product = await createTestProduct();
    
    const unavailableVariation = await db.insert(productVariationsTable)
      .values({
        product_id: product.id,
        variation_type: 'size',
        variation_value: 'Small',
        price_adjustment: '0.00',
        stock_quantity: 0,
        is_available: false
      })
      .returning()
      .execute();

    const input = {
      product_id: product.id,
      variation_id: unavailableVariation[0].id,
      quantity: 1
    };

    expect(addToCart(input, testContext)).rejects.toThrow(/variation not found or unavailable/i);
  });

  it('should throw error for variation from different product', async () => {
    await createTestUser();
    const product1 = await createTestProduct();
    
    const product2 = await db.insert(productsTable)
      .values({
        name: 'Another Product',
        description: 'Another test product',
        type: 'perfume',
        gender: 'female',
        base_price: '49.99',
        is_active: true
      })
      .returning()
      .execute();

    const variationForProduct2 = await createTestVariation(product2[0].id);

    const input = {
      product_id: product1.id,
      variation_id: variationForProduct2.id,
      quantity: 1
    };

    expect(addToCart(input, testContext)).rejects.toThrow(/variation not found or unavailable/i);
  });
});