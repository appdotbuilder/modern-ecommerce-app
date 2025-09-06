import { db } from '../../db';
import { ordersTable, orderItemsTable, productsTable, productVariationsTable } from '../../db/schema';
import { type OrderWithItems, type AuthContext } from '../../schema';
import { desc, eq } from 'drizzle-orm';

export async function getAllOrders(context: AuthContext): Promise<OrderWithItems[]> {
  try {
    // Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // Query all orders ordered by creation date (newest first)
    const ordersQuery = await db.select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.created_at))
      .execute();

    // For each order, fetch its items with product and variation details
    const ordersWithItems: OrderWithItems[] = [];

    for (const order of ordersQuery) {
      // Query order items with joined product and variation data
      const itemsQuery = await db.select({
        // Order item fields
        id: orderItemsTable.id,
        order_id: orderItemsTable.order_id,
        product_id: orderItemsTable.product_id,
        variation_id: orderItemsTable.variation_id,
        quantity: orderItemsTable.quantity,
        custom_design_text: orderItemsTable.custom_design_text,
        custom_design_url: orderItemsTable.custom_design_url,
        unit_price: orderItemsTable.unit_price,
        total_price: orderItemsTable.total_price,
        // Product fields
        product: productsTable,
        // Variation fields (nullable)
        variation: productVariationsTable,
      })
        .from(orderItemsTable)
        .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
        .leftJoin(productVariationsTable, eq(orderItemsTable.variation_id, productVariationsTable.id))
        .where(eq(orderItemsTable.order_id, order.id))
        .execute();

      // Transform the joined data to match the expected schema
      const items = itemsQuery.map(item => ({
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        custom_design_text: item.custom_design_text,
        custom_design_url: item.custom_design_url,
        unit_price: parseFloat(item.unit_price), // Convert numeric to number
        total_price: parseFloat(item.total_price), // Convert numeric to number
        product: {
          ...item.product,
          base_price: parseFloat(item.product.base_price), // Convert numeric to number
        },
        variation: item.variation ? {
          ...item.variation,
          price_adjustment: parseFloat(item.variation.price_adjustment), // Convert numeric to number
        } : null,
      }));

      // Add order with items to the result
      ordersWithItems.push({
        ...order,
        total_amount: parseFloat(order.total_amount), // Convert numeric to number
        items,
      });
    }

    return ordersWithItems;
  } catch (error) {
    console.error('Failed to fetch all orders:', error);
    throw error;
  }
}