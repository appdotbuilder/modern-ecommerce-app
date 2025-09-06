import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, cartTable, cartItemsTable, productsTable, productVariationsTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { getCart } from '../handlers/cart/get_cart';
import { eq } from 'drizzle-orm';

// Test context with user authentication
const testContext: AuthContext = {
  user_id: 1,
  role: 'customer',
};

describe('getCart', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new cart for user without existing cart', async () => {
    // Create a test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    const result = await getCart(testContext);

    // Should create a new cart with no items
    expect(result.user_id).toEqual(1);
    expect(result.items).toEqual([]);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify cart was saved to database
    const carts = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, 1))
      .execute();

    expect(carts).toHaveLength(1);
    expect(carts[0].user_id).toEqual(1);
  });

  it('should return existing cart for user with cart', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    // Create existing cart
    const existingCart = await db.insert(cartTable).values({
      user_id: 1,
    }).returning().execute();

    const result = await getCart(testContext);

    // Should return the existing cart
    expect(result.id).toEqual(existingCart[0].id);
    expect(result.user_id).toEqual(1);
    expect(result.items).toEqual([]);
  });

  it('should return cart with items including product details', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    // Create test product
    const product = await db.insert(productsTable).values({
      name: 'Test Shirt',
      description: 'A test shirt',
      type: 'shirt',
      gender: 'unisex',
      base_price: '25.99',
    }).returning().execute();

    // Create cart
    const cart = await db.insert(cartTable).values({
      user_id: 1,
    }).returning().execute();

    // Add item to cart
    await db.insert(cartItemsTable).values({
      cart_id: cart[0].id,
      product_id: product[0].id,
      variation_id: null,
      quantity: 2,
      custom_design_text: 'Custom Text',
      custom_design_url: null,
      unit_price: '25.99',
    }).execute();

    const result = await getCart(testContext);

    // Verify cart structure
    expect(result.items).toHaveLength(1);
    
    const item = result.items[0];
    expect(item.product_id).toEqual(product[0].id);
    expect(item.quantity).toEqual(2);
    expect(item.custom_design_text).toEqual('Custom Text');
    expect(item.custom_design_url).toBeNull();
    expect(typeof item.unit_price).toBe('number');
    expect(item.unit_price).toEqual(25.99);

    // Verify product details are included
    expect(item.product).toBeDefined();
    expect(item.product.name).toEqual('Test Shirt');
    expect(item.product.type).toEqual('shirt');
    expect(typeof item.product.base_price).toBe('number');
    expect(item.product.base_price).toEqual(25.99);

    // Verify variation is null when no variation
    expect(item.variation).toBeNull();
  });

  it('should return cart with items including variation details', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    // Create test product
    const product = await db.insert(productsTable).values({
      name: 'Test Perfume',
      description: 'A test perfume',
      type: 'perfume',
      gender: 'female',
      base_price: '50.00',
    }).returning().execute();

    // Create product variation
    const variation = await db.insert(productVariationsTable).values({
      product_id: product[0].id,
      variation_type: 'volume',
      variation_value: '50ml',
      price_adjustment: '5.00',
      stock_quantity: 10,
      is_available: true,
    }).returning().execute();

    // Create cart
    const cart = await db.insert(cartTable).values({
      user_id: 1,
    }).returning().execute();

    // Add item with variation to cart
    await db.insert(cartItemsTable).values({
      cart_id: cart[0].id,
      product_id: product[0].id,
      variation_id: variation[0].id,
      quantity: 1,
      custom_design_text: null,
      custom_design_url: null,
      unit_price: '55.00', // base price + variation adjustment
    }).execute();

    const result = await getCart(testContext);

    // Verify cart with variation
    expect(result.items).toHaveLength(1);
    
    const item = result.items[0];
    expect(item.variation_id).toEqual(variation[0].id);
    expect(typeof item.unit_price).toBe('number');
    expect(item.unit_price).toEqual(55.00);

    // Verify variation details are included
    expect(item.variation).toBeDefined();
    expect(item.variation!.variation_type).toEqual('volume');
    expect(item.variation!.variation_value).toEqual('50ml');
    expect(typeof item.variation!.price_adjustment).toBe('number');
    expect(item.variation!.price_adjustment).toEqual(5.00);
    expect(item.variation!.stock_quantity).toEqual(10);
    expect(item.variation!.is_available).toBe(true);
  });

  it('should return cart with multiple items from different products', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    // Create test products
    const products = await db.insert(productsTable).values([
      {
        name: 'Test Shirt',
        description: 'A test shirt',
        type: 'shirt',
        gender: 'male',
        base_price: '20.00',
      },
      {
        name: 'Test Perfume',
        description: 'A test perfume',
        type: 'perfume',
        gender: 'female',
        base_price: '45.00',
      }
    ]).returning().execute();

    // Create cart
    const cart = await db.insert(cartTable).values({
      user_id: 1,
    }).returning().execute();

    // Add multiple items to cart
    await db.insert(cartItemsTable).values([
      {
        cart_id: cart[0].id,
        product_id: products[0].id,
        variation_id: null,
        quantity: 3,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '20.00',
      },
      {
        cart_id: cart[0].id,
        product_id: products[1].id,
        variation_id: null,
        quantity: 1,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '45.00',
      }
    ]).execute();

    const result = await getCart(testContext);

    // Verify multiple items
    expect(result.items).toHaveLength(2);
    
    // Sort items by product name for consistent testing
    const sortedItems = result.items.sort((a, b) => a.product.name.localeCompare(b.product.name));
    
    // First item (perfume)
    expect(sortedItems[0].product.name).toEqual('Test Perfume');
    expect(sortedItems[0].quantity).toEqual(1);
    expect(sortedItems[0].unit_price).toEqual(45.00);
    
    // Second item (shirt)
    expect(sortedItems[1].product.name).toEqual('Test Shirt');
    expect(sortedItems[1].quantity).toEqual(3);
    expect(sortedItems[1].unit_price).toEqual(20.00);
  });

  it('should handle custom design URLs correctly', async () => {
    // Create test user
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer',
    }).execute();

    // Create test product
    const product = await db.insert(productsTable).values({
      name: 'Custom Shirt',
      description: 'A customizable shirt',
      type: 'shirt',
      gender: 'unisex',
      base_price: '30.00',
    }).returning().execute();

    // Create cart
    const cart = await db.insert(cartTable).values({
      user_id: 1,
    }).returning().execute();

    // Add item with custom design URL
    await db.insert(cartItemsTable).values({
      cart_id: cart[0].id,
      product_id: product[0].id,
      variation_id: null,
      quantity: 1,
      custom_design_text: 'My Design',
      custom_design_url: 'https://example.com/design.png',
      unit_price: '35.00', // Higher price for custom design
    }).execute();

    const result = await getCart(testContext);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.custom_design_text).toEqual('My Design');
    expect(item.custom_design_url).toEqual('https://example.com/design.png');
    expect(item.unit_price).toEqual(35.00);
  });
});