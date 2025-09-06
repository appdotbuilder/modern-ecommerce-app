import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, productVariationsTable, ordersTable, orderItemsTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { getAllOrders } from '../handlers/orders/get_all_orders';
import { eq } from 'drizzle-orm';

// Test contexts
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

describe('getAllOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error for non-admin users', async () => {
    await expect(getAllOrders(customerContext)).rejects.toThrow(/Access denied. Admin role required/i);
  });

  it('should return empty array when no orders exist', async () => {
    const result = await getAllOrders(adminContext);
    expect(result).toEqual([]);
  });

  it('should return all orders with items for admin users', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'admin@test.com',
          password_hash: 'hashed_password',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        },
        {
          email: 'customer@test.com',
          password_hash: 'hashed_password',
          first_name: 'Customer',
          last_name: 'User',
          role: 'customer'
        }
      ])
      .returning()
      .execute();

    // Create test products
    const products = await db.insert(productsTable)
      .values([
        {
          name: 'Test Perfume',
          description: 'A test perfume',
          type: 'perfume',
          gender: 'unisex',
          base_price: '59.99'
        },
        {
          name: 'Test Shirt',
          description: 'A test shirt',
          type: 'shirt',
          gender: 'male',
          base_price: '29.99'
        }
      ])
      .returning()
      .execute();

    // Create product variation
    const variations = await db.insert(productVariationsTable)
      .values({
        product_id: products[0].id,
        variation_type: 'volume',
        variation_value: '100ml',
        price_adjustment: '10.00',
        stock_quantity: 50
      })
      .returning()
      .execute();

    // Create test orders with different timestamps
    const firstOrder = await db.insert(ordersTable)
      .values({
        user_id: users[1].id,
        order_number: 'ORD-001',
        status: 'pending',
        total_amount: '89.98',
        shipping_address: '123 Test St, Test City, TC 12345',
        billing_address: '123 Test St, Test City, TC 12345',
        payment_method: 'credit_card',
        payment_status: 'pending'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondOrder = await db.insert(ordersTable)
      .values({
        user_id: users[1].id,
        order_number: 'ORD-002',
        status: 'shipped',
        total_amount: '29.99',
        shipping_address: '456 Another St, Test City, TC 54321',
        billing_address: '456 Another St, Test City, TC 54321',
        payment_method: 'paypal',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    const orders = [...firstOrder, ...secondOrder];

    // Create order items
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: orders[0].id,
          product_id: products[0].id,
          variation_id: variations[0].id,
          quantity: 1,
          unit_price: '69.99',
          total_price: '69.99'
        },
        {
          order_id: orders[0].id,
          product_id: products[1].id,
          variation_id: null,
          quantity: 1,
          custom_design_text: 'Custom Design',
          unit_price: '19.99',
          total_price: '19.99'
        },
        {
          order_id: orders[1].id,
          product_id: products[1].id,
          variation_id: null,
          quantity: 1,
          unit_price: '29.99',
          total_price: '29.99'
        }
      ])
      .execute();

    const result = await getAllOrders(adminContext);

    // Should return 2 orders
    expect(result).toHaveLength(2);

    // Orders should be sorted by created_at desc (newest first)
    expect(result[0].order_number).toBe('ORD-002');
    expect(result[1].order_number).toBe('ORD-001');

    // First order validation (ORD-002 - newer order)
    const newerOrder = result[0];
    expect(newerOrder.user_id).toBe(users[1].id);
    expect(newerOrder.status).toBe('shipped');
    expect(typeof newerOrder.total_amount).toBe('number');
    expect(newerOrder.total_amount).toBe(29.99);
    expect(newerOrder.items).toHaveLength(1);

    // First order item validation
    const newerOrderItem = newerOrder.items[0];
    expect(newerOrderItem.quantity).toBe(1);
    expect(typeof newerOrderItem.unit_price).toBe('number');
    expect(newerOrderItem.unit_price).toBe(29.99);
    expect(typeof newerOrderItem.total_price).toBe('number');
    expect(newerOrderItem.total_price).toBe(29.99);
    expect(newerOrderItem.variation_id).toBeNull();
    expect(newerOrderItem.variation).toBeNull();

    // Product data validation
    expect(newerOrderItem.product.name).toBe('Test Shirt');
    expect(typeof newerOrderItem.product.base_price).toBe('number');
    expect(newerOrderItem.product.base_price).toBe(29.99);

    // Second order validation (ORD-001 - older order with variation and custom design)
    const olderOrder = result[1];
    expect(olderOrder.order_number).toBe('ORD-001');
    expect(olderOrder.items).toHaveLength(2);

    // Find the item with variation
    const itemWithVariation = olderOrder.items.find(item => item.variation_id !== null);
    expect(itemWithVariation).toBeDefined();
    expect(itemWithVariation!.variation).toBeDefined();
    expect(itemWithVariation!.variation!.variation_type).toBe('volume');
    expect(itemWithVariation!.variation!.variation_value).toBe('100ml');
    expect(typeof itemWithVariation!.variation!.price_adjustment).toBe('number');
    expect(itemWithVariation!.variation!.price_adjustment).toBe(10.00);

    // Find the item with custom design
    const itemWithCustom = olderOrder.items.find(item => item.custom_design_text === 'Custom Design');
    expect(itemWithCustom).toBeDefined();
    expect(itemWithCustom!.custom_design_text).toBe('Custom Design');
    expect(itemWithCustom!.variation).toBeNull();
  });

  it('should handle orders with no items', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hashed_password',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      })
      .returning()
      .execute();

    // Create order with no items
    await db.insert(ordersTable)
      .values({
        user_id: users[0].id,
        order_number: 'ORD-EMPTY',
        status: 'pending',
        total_amount: '0.00',
        shipping_address: '123 Test St',
        billing_address: '123 Test St',
        payment_method: 'credit_card',
        payment_status: 'pending'
      })
      .execute();

    const result = await getAllOrders(adminContext);

    expect(result).toHaveLength(1);
    expect(result[0].order_number).toBe('ORD-EMPTY');
    expect(result[0].items).toHaveLength(0);
    expect(typeof result[0].total_amount).toBe('number');
    expect(result[0].total_amount).toBe(0.00);
  });

  it('should properly convert all numeric fields to numbers', async () => {
    // Create test data
    const users = await db.insert(usersTable)
      .values({
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        first_name: 'Customer',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    const products = await db.insert(productsTable)
      .values({
        name: 'Numeric Test Product',
        description: 'For testing numeric conversions',
        type: 'perfume',
        gender: 'unisex',
        base_price: '123.45'
      })
      .returning()
      .execute();

    const variations = await db.insert(productVariationsTable)
      .values({
        product_id: products[0].id,
        variation_type: 'size',
        variation_value: 'Large',
        price_adjustment: '15.50',
        stock_quantity: 25
      })
      .returning()
      .execute();

    const orders = await db.insert(ordersTable)
      .values({
        user_id: users[0].id,
        order_number: 'ORD-NUMERIC',
        status: 'delivered',
        total_amount: '138.95',
        shipping_address: '123 Test St',
        billing_address: '123 Test St',
        payment_method: 'credit_card',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    await db.insert(orderItemsTable)
      .values({
        order_id: orders[0].id,
        product_id: products[0].id,
        variation_id: variations[0].id,
        quantity: 1,
        unit_price: '138.95',
        total_price: '138.95'
      })
      .execute();

    const result = await getAllOrders(adminContext);

    expect(result).toHaveLength(1);
    const order = result[0];
    const item = order.items[0];

    // Verify all numeric conversions
    expect(typeof order.total_amount).toBe('number');
    expect(order.total_amount).toBe(138.95);

    expect(typeof item.unit_price).toBe('number');
    expect(item.unit_price).toBe(138.95);

    expect(typeof item.total_price).toBe('number');
    expect(item.total_price).toBe(138.95);

    expect(typeof item.product.base_price).toBe('number');
    expect(item.product.base_price).toBe(123.45);

    expect(typeof item.variation!.price_adjustment).toBe('number');
    expect(item.variation!.price_adjustment).toBe(15.50);
  });
});