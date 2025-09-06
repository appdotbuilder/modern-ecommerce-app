import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  productsTable, 
  productVariationsTable, 
  ordersTable, 
  orderItemsTable 
} from '../db/schema';
import { type AuthContext } from '../schema';
import { getOrders } from '../handlers/orders/get_orders';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer' as const,
};

const testProduct = {
  name: 'Test Perfume',
  description: 'A test perfume',
  type: 'perfume' as const,
  gender: 'unisex' as const,
  base_price: '99.99',
  image_url: 'https://example.com/image.jpg',
  is_active: true,
};

const testOrder = {
  order_number: 'ORD-12345',
  status: 'pending' as const,
  total_amount: '159.98',
  shipping_address: '123 Test St, Test City, TC 12345',
  billing_address: '123 Test St, Test City, TC 12345',
  payment_method: 'credit_card',
  payment_status: 'pending',
};

describe('getOrders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no orders', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer',
    };

    const result = await getOrders(context);

    expect(result).toEqual([]);
  });

  it('should return user orders with items and product details', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create product
    const [product] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    // Create product variation
    const [variation] = await db.insert(productVariationsTable)
      .values({
        product_id: product.id,
        variation_type: 'volume',
        variation_value: '50ml',
        price_adjustment: '10.00',
        stock_quantity: 50,
        is_available: true,
      })
      .returning()
      .execute();

    // Create order
    const [order] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user.id,
      })
      .returning()
      .execute();

    // Create order item with variation
    await db.insert(orderItemsTable)
      .values({
        order_id: order.id,
        product_id: product.id,
        variation_id: variation.id,
        quantity: 2,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: '109.99',
        total_price: '219.98',
      })
      .execute();

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer',
    };

    const result = await getOrders(context);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(order.id);
    expect(result[0].order_number).toBe('ORD-12345');
    expect(result[0].status).toBe('pending');
    expect(typeof result[0].total_amount).toBe('number');
    expect(result[0].total_amount).toBe(159.98);

    // Check order items
    expect(result[0].items).toHaveLength(1);
    const orderItem = result[0].items[0];
    expect(orderItem.quantity).toBe(2);
    expect(typeof orderItem.unit_price).toBe('number');
    expect(orderItem.unit_price).toBe(109.99);
    expect(typeof orderItem.total_price).toBe('number');
    expect(orderItem.total_price).toBe(219.98);

    // Check product details
    expect(orderItem.product.name).toBe('Test Perfume');
    expect(orderItem.product.type).toBe('perfume');
    expect(typeof orderItem.product.base_price).toBe('number');
    expect(orderItem.product.base_price).toBe(99.99);

    // Check variation details
    expect(orderItem.variation).not.toBeNull();
    expect(orderItem.variation!.variation_type).toBe('volume');
    expect(orderItem.variation!.variation_value).toBe('50ml');
    expect(typeof orderItem.variation!.price_adjustment).toBe('number');
    expect(orderItem.variation!.price_adjustment).toBe(10.00);
  });

  it('should return order item without variation when variation_id is null', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create product
    const [product] = await db.insert(productsTable)
      .values({
        ...testProduct,
        name: 'Custom Shirt',
        type: 'shirt',
        gender: null,
      })
      .returning()
      .execute();

    // Create order
    const [order] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user.id,
      })
      .returning()
      .execute();

    // Create order item without variation
    await db.insert(orderItemsTable)
      .values({
        order_id: order.id,
        product_id: product.id,
        variation_id: null,
        quantity: 1,
        custom_design_text: 'Custom Design Text',
        custom_design_url: 'https://example.com/design.jpg',
        unit_price: '29.99',
        total_price: '29.99',
      })
      .execute();

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer',
    };

    const result = await getOrders(context);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
    
    const orderItem = result[0].items[0];
    expect(orderItem.variation_id).toBeNull();
    expect(orderItem.variation).toBeNull();
    expect(orderItem.custom_design_text).toBe('Custom Design Text');
    expect(orderItem.custom_design_url).toBe('https://example.com/design.jpg');
    expect(orderItem.product.name).toBe('Custom Shirt');
    expect(orderItem.product.type).toBe('shirt');
  });

  it('should return multiple orders ordered by creation date (newest first)', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create product
    const [product] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    // Create first order (older)
    const [oldOrder] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user.id,
        order_number: 'ORD-OLD-001',
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create second order (newer)
    const [newOrder] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user.id,
        order_number: 'ORD-NEW-002',
      })
      .returning()
      .execute();

    // Create order items for both orders
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: oldOrder.id,
          product_id: product.id,
          variation_id: null,
          quantity: 1,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '99.99',
        },
        {
          order_id: newOrder.id,
          product_id: product.id,
          variation_id: null,
          quantity: 2,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '199.98',
        }
      ])
      .execute();

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer',
    };

    const result = await getOrders(context);

    expect(result).toHaveLength(2);
    // Should be ordered by creation date (newest first)
    expect(result[0].order_number).toBe('ORD-NEW-002');
    expect(result[1].order_number).toBe('ORD-OLD-001');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should only return orders for the authenticated user', async () => {
    // Create two users
    const [user1] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user2@example.com',
      })
      .returning()
      .execute();

    // Create product
    const [product] = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();

    // Create orders for both users
    const [order1] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user1.id,
        order_number: 'ORD-USER1-001',
      })
      .returning()
      .execute();

    const [order2] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user2.id,
        order_number: 'ORD-USER2-001',
      })
      .returning()
      .execute();

    // Create order items for both orders
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: order1.id,
          product_id: product.id,
          variation_id: null,
          quantity: 1,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '99.99',
        },
        {
          order_id: order2.id,
          product_id: product.id,
          variation_id: null,
          quantity: 1,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '99.99',
        }
      ])
      .execute();

    // Query orders for user1
    const context1: AuthContext = {
      user_id: user1.id,
      role: 'customer',
    };

    const result1 = await getOrders(context1);

    expect(result1).toHaveLength(1);
    expect(result1[0].order_number).toBe('ORD-USER1-001');
    expect(result1[0].user_id).toBe(user1.id);

    // Query orders for user2
    const context2: AuthContext = {
      user_id: user2.id,
      role: 'customer',
    };

    const result2 = await getOrders(context2);

    expect(result2).toHaveLength(1);
    expect(result2[0].order_number).toBe('ORD-USER2-001');
    expect(result2[0].user_id).toBe(user2.id);
  });

  it('should handle orders with multiple items correctly', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create multiple products
    const [product1] = await db.insert(productsTable)
      .values({
        ...testProduct,
        name: 'Product 1',
      })
      .returning()
      .execute();

    const [product2] = await db.insert(productsTable)
      .values({
        ...testProduct,
        name: 'Product 2',
      })
      .returning()
      .execute();

    // Create order
    const [order] = await db.insert(ordersTable)
      .values({
        ...testOrder,
        user_id: user.id,
        total_amount: '299.97', // Updated total for 3 items
      })
      .returning()
      .execute();

    // Create multiple order items
    await db.insert(orderItemsTable)
      .values([
        {
          order_id: order.id,
          product_id: product1.id,
          variation_id: null,
          quantity: 1,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '99.99',
        },
        {
          order_id: order.id,
          product_id: product2.id,
          variation_id: null,
          quantity: 2,
          custom_design_text: null,
          custom_design_url: null,
          unit_price: '99.99',
          total_price: '199.98',
        }
      ])
      .execute();

    const context: AuthContext = {
      user_id: user.id,
      role: 'customer',
    };

    const result = await getOrders(context);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
    expect(typeof result[0].total_amount).toBe('number');
    expect(result[0].total_amount).toBe(299.97);

    // Verify both items are present
    const itemNames = result[0].items.map(item => item.product.name);
    expect(itemNames).toContain('Product 1');
    expect(itemNames).toContain('Product 2');

    // Check quantities
    const product1Item = result[0].items.find(item => item.product.name === 'Product 1');
    const product2Item = result[0].items.find(item => item.product.name === 'Product 2');

    expect(product1Item!.quantity).toBe(1);
    expect(product2Item!.quantity).toBe(2);
  });
});