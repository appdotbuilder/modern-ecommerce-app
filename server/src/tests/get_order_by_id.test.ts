import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, productVariationsTable, ordersTable, orderItemsTable } from '../db/schema';
import { type AuthContext } from '../schema';
import { getOrderById } from '../handlers/orders/get_order_by_id';

// Test contexts
const customerContext: AuthContext = {
  user_id: 1,
  role: 'customer'
};

const adminContext: AuthContext = {
  user_id: 2,
  role: 'admin'
};

const otherCustomerContext: AuthContext = {
  user_id: 3,
  role: 'customer'
};

describe('getOrderById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return order with items for authorized customer', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hash123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Perfume',
        description: 'A test perfume',
        type: 'perfume',
        gender: 'unisex',
        base_price: '29.99'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create test variation
    const variationResult = await db.insert(productVariationsTable)
      .values({
        product_id: productId,
        variation_type: 'volume',
        variation_value: '50ml',
        price_adjustment: '5.00',
        stock_quantity: 10
      })
      .returning()
      .execute();

    const variationId = variationResult[0].id;

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        order_number: 'ORD-001',
        status: 'pending',
        total_amount: '34.99',
        shipping_address: '123 Main St',
        billing_address: '123 Main St',
        payment_method: 'credit_card'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create test order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        variation_id: variationId,
        quantity: 1,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '34.99',
        total_price: '34.99'
      })
      .execute();

    // Update context to use the created user ID
    const testContext: AuthContext = {
      user_id: userId,
      role: 'customer'
    };

    const result = await getOrderById(orderId, testContext);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(orderId);
    expect(result!.order_number).toBe('ORD-001');
    expect(result!.status).toBe('pending');
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.total_amount).toBe(34.99);
    expect(result!.user_id).toBe(userId);
    expect(result!.shipping_address).toBe('123 Main St');
    expect(result!.billing_address).toBe('123 Main St');
    expect(result!.payment_method).toBe('credit_card');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Check items
    expect(result!.items).toHaveLength(1);
    const item = result!.items[0];
    expect(item.product_id).toBe(productId);
    expect(item.variation_id).toBe(variationId);
    expect(item.quantity).toBe(1);
    expect(typeof item.unit_price).toBe('number');
    expect(item.unit_price).toBe(34.99);
    expect(typeof item.total_price).toBe('number');
    expect(item.total_price).toBe(34.99);

    // Check product details
    expect(item.product).not.toBeNull();
    expect(item.product.name).toBe('Test Perfume');
    expect(item.product.type).toBe('perfume');
    expect(typeof item.product.base_price).toBe('number');
    expect(item.product.base_price).toBe(29.99);

    // Check variation details
    expect(item.variation).not.toBeNull();
    expect(item.variation!.variation_type).toBe('volume');
    expect(item.variation!.variation_value).toBe('50ml');
    expect(typeof item.variation!.price_adjustment).toBe('number');
    expect(item.variation!.price_adjustment).toBe(5.00);
  });

  it('should return order for admin user regardless of owner', async () => {
    // Create test users
    const userResult = await db.insert(usersTable)
      .values([
        {
          email: 'customer@example.com',
          password_hash: 'hash123',
          first_name: 'Customer',
          last_name: 'User',
          role: 'customer'
        },
        {
          email: 'admin@example.com',
          password_hash: 'hash456',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      ])
      .returning()
      .execute();

    const customerId = userResult[0].id;
    const adminId = userResult[1].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Shirt',
        description: 'A test shirt',
        type: 'shirt',
        gender: 'male',
        base_price: '19.99'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create test order for customer
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: customerId,
        order_number: 'ORD-002',
        status: 'processing',
        total_amount: '19.99',
        shipping_address: '456 Oak St',
        billing_address: '456 Oak St',
        payment_method: 'paypal'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create test order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        variation_id: null,
        quantity: 1,
        custom_design_text: 'Custom Text',
        custom_design_url: null,
        unit_price: '19.99',
        total_price: '19.99'
      })
      .execute();

    // Admin should be able to access customer's order
    const adminTestContext: AuthContext = {
      user_id: adminId,
      role: 'admin'
    };

    const result = await getOrderById(orderId, adminTestContext);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(orderId);
    expect(result!.order_number).toBe('ORD-002');
    expect(result!.status).toBe('processing');
    expect(result!.user_id).toBe(customerId); // Order belongs to customer, not admin
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].custom_design_text).toBe('Custom Text');
  });

  it('should return null for non-existent order', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hash123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      })
      .returning()
      .execute();

    const testContext: AuthContext = {
      user_id: userResult[0].id,
      role: 'customer'
    };

    const result = await getOrderById(999999, testContext);

    expect(result).toBeNull();
  });

  it('should return null when customer tries to access another customer\'s order', async () => {
    // Create test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'owner@example.com',
          password_hash: 'hash123',
          first_name: 'Order',
          last_name: 'Owner',
          role: 'customer'
        },
        {
          email: 'other@example.com',
          password_hash: 'hash456',
          first_name: 'Other',
          last_name: 'Customer',
          role: 'customer'
        }
      ])
      .returning()
      .execute();

    const ownerId = userResults[0].id;
    const otherId = userResults[1].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Protected Order Product',
        description: 'A product in a protected order',
        type: 'shirt',
        gender: 'female',
        base_price: '25.00'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create order for first user
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: ownerId,
        order_number: 'ORD-003',
        status: 'shipped',
        total_amount: '25.00',
        shipping_address: '789 Pine St',
        billing_address: '789 Pine St',
        payment_method: 'credit_card'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create test order item
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        variation_id: null,
        quantity: 1,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '25.00',
        total_price: '25.00'
      })
      .execute();

    // Other customer should not be able to access the order
    const otherTestContext: AuthContext = {
      user_id: otherId,
      role: 'customer'
    };

    const result = await getOrderById(orderId, otherTestContext);

    expect(result).toBeNull();
  });

  it('should handle order with multiple items and different variations', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'multi@example.com',
        password_hash: 'hash123',
        first_name: 'Multi',
        last_name: 'Item',
        role: 'customer'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test products
    const productResults = await db.insert(productsTable)
      .values([
        {
          name: 'Perfume Product',
          description: 'A perfume for testing',
          type: 'perfume',
          gender: 'female',
          base_price: '40.00'
        },
        {
          name: 'Shirt Product',
          description: 'A shirt for testing',
          type: 'shirt',
          gender: 'male',
          base_price: '30.00'
        }
      ])
      .returning()
      .execute();

    const perfumeId = productResults[0].id;
    const shirtId = productResults[1].id;

    // Create variations
    const variationResults = await db.insert(productVariationsTable)
      .values([
        {
          product_id: perfumeId,
          variation_type: 'volume',
          variation_value: '100ml',
          price_adjustment: '10.00',
          stock_quantity: 5
        },
        {
          product_id: shirtId,
          variation_type: 'size',
          variation_value: 'L',
          price_adjustment: '0.00',
          stock_quantity: 20
        }
      ])
      .returning()
      .execute();

    const perfumeVariationId = variationResults[0].id;
    const shirtVariationId = variationResults[1].id;

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        order_number: 'ORD-004',
        status: 'delivered',
        total_amount: '80.00',
        shipping_address: '321 Elm St',
        billing_address: '321 Elm St',
        payment_method: 'debit_card'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create multiple order items
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: orderId,
          product_id: perfumeId,
          variation_id: perfumeVariationId,
          quantity: 1,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '50.00',
          total_price: '50.00'
        },
        {
          order_id: orderId,
          product_id: shirtId,
          variation_id: shirtVariationId,
          quantity: 1,
          custom_design_text: 'Custom Design',
          custom_design_url: 'https://example.com/design.jpg',
          unit_price: '30.00',
          total_price: '30.00'
        }
      ])
      .execute();

    const testContext: AuthContext = {
      user_id: userId,
      role: 'customer'
    };

    const result = await getOrderById(orderId, testContext);

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);

    // Check perfume item
    const perfumeItem = result!.items.find(item => item.product.type === 'perfume');
    expect(perfumeItem).toBeDefined();
    expect(perfumeItem!.product.name).toBe('Perfume Product');
    expect(perfumeItem!.variation!.variation_value).toBe('100ml');
    expect(perfumeItem!.variation!.price_adjustment).toBe(10.00);
    expect(perfumeItem!.custom_design_text).toBeNull();
    expect(perfumeItem!.unit_price).toBe(50.00);

    // Check shirt item
    const shirtItem = result!.items.find(item => item.product.type === 'shirt');
    expect(shirtItem).toBeDefined();
    expect(shirtItem!.product.name).toBe('Shirt Product');
    expect(shirtItem!.variation!.variation_value).toBe('L');
    expect(shirtItem!.variation!.price_adjustment).toBe(0.00);
    expect(shirtItem!.custom_design_text).toBe('Custom Design');
    expect(shirtItem!.custom_design_url).toBe('https://example.com/design.jpg');
    expect(shirtItem!.unit_price).toBe(30.00);
  });

  it('should handle order with items that have no variations', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'novar@example.com',
        password_hash: 'hash123',
        first_name: 'No',
        last_name: 'Variation',
        role: 'customer'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Simple Product',
        description: 'A product without variations',
        type: 'shirt',
        gender: 'unisex',
        base_price: '15.00'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        order_number: 'ORD-005',
        status: 'pending',
        total_amount: '15.00',
        shipping_address: '555 Maple St',
        billing_address: '555 Maple St',
        payment_method: 'cash'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;

    // Create order item without variation
    await db.insert(orderItemsTable)
      .values({
        order_id: orderId,
        product_id: productId,
        variation_id: null,
        quantity: 1,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '15.00',
        total_price: '15.00'
      })
      .execute();

    const testContext: AuthContext = {
      user_id: userId,
      role: 'customer'
    };

    const result = await getOrderById(orderId, testContext);

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].variation_id).toBeNull();
    expect(result!.items[0].variation).toBeNull();
    expect(result!.items[0].product.name).toBe('Simple Product');
    expect(result!.items[0].unit_price).toBe(15.00);
  });
});