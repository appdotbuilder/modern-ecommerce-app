import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  productsTable, 
  productVariationsTable,
  cartTable,
  cartItemsTable,
  ordersTable,
  orderItemsTable
} from '../db/schema';
import { type CreateOrderInput, type AuthContext } from '../schema';
import { createOrder } from '../handlers/orders/create_order';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  role: 'customer' as const,
};

const testProduct1 = {
  name: 'Test Shirt',
  description: 'A test shirt',
  type: 'shirt' as const,
  gender: 'unisex' as const,
  base_price: '29.99',
  is_active: true,
};

const testProduct2 = {
  name: 'Test Perfume',
  description: 'A test perfume',
  type: 'perfume' as const,
  gender: 'female' as const,
  base_price: '49.99',
  is_active: true,
};

const testOrderInput: CreateOrderInput = {
  shipping_address: '123 Main St, City, State 12345',
  billing_address: '123 Main St, City, State 12345',
  payment_method: 'credit_card',
};

describe('createOrder', () => {
  let userId: number;
  let product1Id: number;
  let product2Id: number;
  let variation1Id: number;
  let cartId: number;
  let authContext: AuthContext;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    authContext = {
      user_id: userId,
      role: 'customer',
    };

    // Create test products
    const product1Result = await db.insert(productsTable)
      .values(testProduct1)
      .returning()
      .execute();
    product1Id = product1Result[0].id;

    const product2Result = await db.insert(productsTable)
      .values(testProduct2)
      .returning()
      .execute();
    product2Id = product2Result[0].id;

    // Create product variation for product1
    const variationResult = await db.insert(productVariationsTable)
      .values({
        product_id: product1Id,
        variation_type: 'size',
        variation_value: 'Large',
        price_adjustment: '5.00',
        stock_quantity: 10,
        is_available: true,
      })
      .returning()
      .execute();
    variation1Id = variationResult[0].id;

    // Create user cart
    const cartResult = await db.insert(cartTable)
      .values({
        user_id: userId,
      })
      .returning()
      .execute();
    cartId = cartResult[0].id;
  });

  afterEach(resetDB);

  it('should create an order from cart items', async () => {
    // Add items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cartId,
          product_id: product1Id,
          variation_id: variation1Id,
          quantity: 2,
          unit_price: '34.99', // base_price + price_adjustment
        },
        {
          cart_id: cartId,
          product_id: product2Id,
          variation_id: null,
          quantity: 1,
          unit_price: '49.99',
        },
      ])
      .execute();

    const result = await createOrder(testOrderInput, authContext);

    // Verify order creation
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.order_number).toMatch(/^ORD-\d+-\d+$/);
    expect(result.status).toEqual('processing'); // Should be processing after successful payment
    expect(result.total_amount).toEqual(119.97); // (34.99 * 2) + 49.99
    expect(result.shipping_address).toEqual(testOrderInput.shipping_address);
    expect(result.billing_address).toEqual(testOrderInput.billing_address);
    expect(result.payment_method).toEqual(testOrderInput.payment_method);
    expect(result.payment_status).toEqual('completed');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create order items from cart items', async () => {
    // Add items to cart
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cartId,
          product_id: product1Id,
          variation_id: variation1Id,
          quantity: 2,
          unit_price: '34.99',
          custom_design_text: 'Custom Text',
        },
        {
          cart_id: cartId,
          product_id: product2Id,
          variation_id: null,
          quantity: 1,
          unit_price: '49.99',
        },
      ])
      .execute();

    const result = await createOrder(testOrderInput, authContext);

    // Verify order items were created
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, result.id))
      .execute();

    expect(orderItems).toHaveLength(2);

    // Verify first order item
    const orderItem1 = orderItems.find(item => item.product_id === product1Id);
    expect(orderItem1).toBeDefined();
    expect(orderItem1!.variation_id).toEqual(variation1Id);
    expect(orderItem1!.quantity).toEqual(2);
    expect(parseFloat(orderItem1!.unit_price)).toEqual(34.99);
    expect(parseFloat(orderItem1!.total_price)).toEqual(69.98);
    expect(orderItem1!.custom_design_text).toEqual('Custom Text');

    // Verify second order item
    const orderItem2 = orderItems.find(item => item.product_id === product2Id);
    expect(orderItem2).toBeDefined();
    expect(orderItem2!.variation_id).toBeNull();
    expect(orderItem2!.quantity).toEqual(1);
    expect(parseFloat(orderItem2!.unit_price)).toEqual(49.99);
    expect(parseFloat(orderItem2!.total_price)).toEqual(49.99);
    expect(orderItem2!.custom_design_text).toBeNull();
  });

  it('should clear cart after creating order', async () => {
    // Add items to cart
    await db.insert(cartItemsTable)
      .values({
        cart_id: cartId,
        product_id: product1Id,
        variation_id: null,
        quantity: 1,
        unit_price: '29.99',
      })
      .execute();

    await createOrder(testOrderInput, authContext);

    // Verify cart is empty
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    expect(cartItems).toHaveLength(0);
  });

  it('should handle orders with custom design fields', async () => {
    // Add item with custom design to cart
    await db.insert(cartItemsTable)
      .values({
        cart_id: cartId,
        product_id: product1Id,
        variation_id: variation1Id,
        quantity: 1,
        unit_price: '34.99',
        custom_design_text: 'My Custom Design',
        custom_design_url: 'https://example.com/design.jpg',
      })
      .execute();

    const result = await createOrder(testOrderInput, authContext);

    // Verify order item has custom design fields
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, result.id))
      .execute();

    expect(orderItems).toHaveLength(1);
    expect(orderItems[0].custom_design_text).toEqual('My Custom Design');
    expect(orderItems[0].custom_design_url).toEqual('https://example.com/design.jpg');
  });

  it('should handle different payment methods', async () => {
    // Add item to cart
    await db.insert(cartItemsTable)
      .values({
        cart_id: cartId,
        product_id: product1Id,
        variation_id: null,
        quantity: 1,
        unit_price: '29.99',
      })
      .execute();

    // Test PayPal payment
    const paypalOrderInput: CreateOrderInput = {
      ...testOrderInput,
      payment_method: 'paypal',
    };

    const result = await createOrder(paypalOrderInput, authContext);

    expect(result.payment_method).toEqual('paypal');
    expect(result.payment_status).toEqual('completed');
    expect(result.status).toEqual('processing');
  });

  it('should handle failed payments', async () => {
    // Add item to cart
    await db.insert(cartItemsTable)
      .values({
        cart_id: cartId,
        product_id: product1Id,
        variation_id: null,
        quantity: 1,
        unit_price: '29.99',
      })
      .execute();

    // Test unsupported payment method
    const failedPaymentInput: CreateOrderInput = {
      ...testOrderInput,
      payment_method: 'unsupported_method',
    };

    const result = await createOrder(failedPaymentInput, authContext);

    expect(result.payment_method).toEqual('unsupported_method');
    expect(result.payment_status).toEqual('failed');
    expect(result.status).toEqual('cancelled');
  });

  it('should throw error when cart is not found', async () => {
    // Use non-existent user
    const invalidAuthContext: AuthContext = {
      user_id: 99999,
      role: 'customer',
    };

    await expect(createOrder(testOrderInput, invalidAuthContext)).rejects.toThrow(/cart not found/i);
  });

  it('should throw error when cart is empty', async () => {
    // Cart exists but has no items
    await expect(createOrder(testOrderInput, authContext)).rejects.toThrow(/cart is empty/i);
  });

  it('should calculate total amount correctly with multiple items', async () => {
    // Add multiple items with different quantities and prices
    await db.insert(cartItemsTable)
      .values([
        {
          cart_id: cartId,
          product_id: product1Id,
          variation_id: variation1Id,
          quantity: 3,
          unit_price: '34.99',
        },
        {
          cart_id: cartId,
          product_id: product2Id,
          variation_id: null,
          quantity: 2,
          unit_price: '49.99',
        },
      ])
      .execute();

    const result = await createOrder(testOrderInput, authContext);

    // Expected: (34.99 * 3) + (49.99 * 2) = 104.97 + 99.98 = 204.95
    expect(result.total_amount).toEqual(204.95);
  });

  it('should save order to database correctly', async () => {
    // Add item to cart
    await db.insert(cartItemsTable)
      .values({
        cart_id: cartId,
        product_id: product1Id,
        variation_id: null,
        quantity: 1,
        unit_price: '29.99',
      })
      .execute();

    const result = await createOrder(testOrderInput, authContext);

    // Verify order was saved to database
    const savedOrder = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, result.id))
      .execute();

    expect(savedOrder).toHaveLength(1);
    expect(savedOrder[0].user_id).toEqual(userId);
    expect(savedOrder[0].order_number).toMatch(/^ORD-\d+-\d+$/);
    expect(parseFloat(savedOrder[0].total_amount)).toEqual(29.99);
    expect(savedOrder[0].status).toEqual('processing');
  });
});