import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { ordersTable, usersTable } from '../db/schema';
import { type UpdateOrderStatusInput, type AuthContext } from '../schema';
import { updateOrderStatus } from '../handlers/orders/update_order_status';
import { eq } from 'drizzle-orm';

// Test input
const testInput: UpdateOrderStatusInput = {
  order_id: 1,
  status: 'shipped'
};

// Admin context
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

// Customer context
const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

describe('updateOrderStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update order status as admin', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        order_number: 'ORD-123456',
        status: 'pending',
        total_amount: '99.99',
        shipping_address: '123 Test St, City, State 12345',
        billing_address: '123 Test St, City, State 12345',
        payment_method: 'credit_card',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    const order = orderResult[0];
    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'shipped'
    };

    const result = await updateOrderStatus(input, adminContext);

    // Verify basic fields
    expect(result.id).toEqual(order.id);
    expect(result.status).toEqual('shipped');
    expect(result.order_number).toEqual('ORD-123456');
    expect(result.total_amount).toEqual(99.99);
    expect(typeof result.total_amount).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > order.updated_at).toBe(true);
  });

  it('should save updated status to database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        order_number: 'ORD-123456',
        status: 'pending',
        total_amount: '149.99',
        shipping_address: '123 Test St, City, State 12345',
        billing_address: '123 Test St, City, State 12345',
        payment_method: 'credit_card',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    const order = orderResult[0];
    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'delivered'
    };

    await updateOrderStatus(input, adminContext);

    // Verify database update
    const updatedOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .execute();

    expect(updatedOrders).toHaveLength(1);
    expect(updatedOrders[0].status).toEqual('delivered');
    expect(updatedOrders[0].updated_at > order.updated_at).toBe(true);
    expect(parseFloat(updatedOrders[0].total_amount)).toEqual(149.99);
  });

  it('should reject non-admin users', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        order_number: 'ORD-123456',
        status: 'pending',
        total_amount: '99.99',
        shipping_address: '123 Test St, City, State 12345',
        billing_address: '123 Test St, City, State 12345',
        payment_method: 'credit_card',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    const input: UpdateOrderStatusInput = {
      order_id: orderResult[0].id,
      status: 'shipped'
    };

    await expect(updateOrderStatus(input, customerContext)).rejects.toThrow(/access denied.*admin/i);
  });

  it('should throw error for non-existent order', async () => {
    const input: UpdateOrderStatusInput = {
      order_id: 99999,
      status: 'shipped'
    };

    await expect(updateOrderStatus(input, adminContext)).rejects.toThrow(/order not found/i);
  });

  it('should handle all valid order statuses', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userResult[0].id,
        order_number: 'ORD-123456',
        status: 'pending',
        total_amount: '199.99',
        shipping_address: '123 Test St, City, State 12345',
        billing_address: '123 Test St, City, State 12345',
        payment_method: 'credit_card',
        payment_status: 'completed'
      })
      .returning()
      .execute();

    const orderId = orderResult[0].id;
    const statusesToTest: Array<'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'> = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    for (const status of statusesToTest) {
      const input: UpdateOrderStatusInput = {
        order_id: orderId,
        status: status
      };

      const result = await updateOrderStatus(input, adminContext);
      expect(result.status).toEqual(status);

      // Verify in database
      const dbOrder = await db.select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .execute();
      
      expect(dbOrder[0].status).toEqual(status);
    }
  });

  it('should preserve all other order fields during update', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed',
        first_name: 'Test',
        last_name: 'User',
        role: 'customer'
      })
      .returning()
      .execute();

    // Create test order with specific values
    const originalOrder = {
      user_id: userResult[0].id,
      order_number: 'ORD-789012',
      status: 'pending' as const,
      total_amount: '299.99',
      shipping_address: '456 Original St, Test City, TC 67890',
      billing_address: '789 Billing Ave, Bill City, BC 54321',
      payment_method: 'paypal',
      payment_status: 'completed'
    };

    const orderResult = await db.insert(ordersTable)
      .values(originalOrder)
      .returning()
      .execute();

    const input: UpdateOrderStatusInput = {
      order_id: orderResult[0].id,
      status: 'processing'
    };

    const result = await updateOrderStatus(input, adminContext);

    // Verify only status and updated_at changed
    expect(result.status).toEqual('processing');
    expect(result.user_id).toEqual(originalOrder.user_id);
    expect(result.order_number).toEqual(originalOrder.order_number);
    expect(result.total_amount).toEqual(299.99);
    expect(result.shipping_address).toEqual(originalOrder.shipping_address);
    expect(result.billing_address).toEqual(originalOrder.billing_address);
    expect(result.payment_method).toEqual(originalOrder.payment_method);
    expect(result.payment_status).toEqual(originalOrder.payment_status);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});