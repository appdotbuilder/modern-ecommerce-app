import { db } from '../../db';
import { ordersTable, orderItemsTable, productsTable, productVariationsTable } from '../../db/schema';
import { type OrderWithItems, type AuthContext } from '../../schema';
import { eq, and } from 'drizzle-orm';

export async function getOrderById(orderId: number, context: AuthContext): Promise<OrderWithItems | null> {
  try {
    // Build the query with appropriate authorization filter
    const orderQuery = context.role === 'admin'
      ? db.select()
          .from(ordersTable)
          .where(eq(ordersTable.id, orderId))
      : db.select()
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.id, orderId),
              eq(ordersTable.user_id, context.user_id)
            )
          );

    const orderResults = await orderQuery.execute();

    if (orderResults.length === 0) {
      return null;
    }

    const order = orderResults[0];

    // Fetch order items with product and variation details
    const itemsQuery = db.select()
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
      .leftJoin(productVariationsTable, eq(orderItemsTable.variation_id, productVariationsTable.id))
      .where(eq(orderItemsTable.order_id, orderId));

    const itemResults = await itemsQuery.execute();

    // Transform and convert numeric fields
    const items = itemResults.map(result => ({
      id: result.order_items.id,
      order_id: result.order_items.order_id,
      product_id: result.order_items.product_id,
      variation_id: result.order_items.variation_id,
      quantity: result.order_items.quantity,
      custom_design_text: result.order_items.custom_design_text,
      custom_design_url: result.order_items.custom_design_url,
      unit_price: parseFloat(result.order_items.unit_price),
      total_price: parseFloat(result.order_items.total_price),
      product: result.products ? {
        ...result.products,
        base_price: parseFloat(result.products.base_price),
      } : null,
      variation: result.product_variations ? {
        ...result.product_variations,
        price_adjustment: parseFloat(result.product_variations.price_adjustment),
      } : null,
    }));

    // Return order with items, converting numeric fields
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      items: items.filter(item => item.product !== null).map(item => ({
        ...item,
        product: item.product!,
      })),
    };
  } catch (error) {
    console.error('Get order by ID failed:', error);
    throw error;
  }
}