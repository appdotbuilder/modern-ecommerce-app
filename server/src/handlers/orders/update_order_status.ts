import { db } from '../../db';
import { ordersTable } from '../../db/schema';
import { type UpdateOrderStatusInput, type Order, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function updateOrderStatus(input: UpdateOrderStatusInput, context: AuthContext): Promise<Order> {
  try {
    // 1. Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // 2. Validate order exists and update status
    const result = await db.update(ordersTable)
      .set({ 
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, input.order_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Order not found');
    }

    // 3. Return updated order data with numeric conversions
    const order = result[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Update order status failed:', error);
    throw error;
  }
}