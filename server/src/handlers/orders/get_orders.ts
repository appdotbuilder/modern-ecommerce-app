import { db } from '../../db';
import { ordersTable, orderItemsTable, productsTable, productVariationsTable } from '../../db/schema';
import { type OrderWithItems, type AuthContext } from '../../schema';
import { eq, desc } from 'drizzle-orm';

export async function getOrders(context: AuthContext): Promise<OrderWithItems[]> {
  try {
    // Query orders for the authenticated user, ordered by creation date (newest first)
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, context.user_id))
      .orderBy(desc(ordersTable.created_at))
      .execute();

    // For each order, fetch its items with product and variation details
    const ordersWithItems: OrderWithItems[] = [];

    for (const order of orders) {
      // Query order items with joined product and variation data
      const orderItemsQueryResult = await db.select({
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
        product: {
          id: productsTable.id,
          name: productsTable.name,
          description: productsTable.description,
          type: productsTable.type,
          gender: productsTable.gender,
          base_price: productsTable.base_price,
          image_url: productsTable.image_url,
          is_active: productsTable.is_active,
          created_at: productsTable.created_at,
          updated_at: productsTable.updated_at,
        },
        // Product variation fields (nullable)
        variation: {
          id: productVariationsTable.id,
          product_id: productVariationsTable.product_id,
          variation_type: productVariationsTable.variation_type,
          variation_value: productVariationsTable.variation_value,
          price_adjustment: productVariationsTable.price_adjustment,
          stock_quantity: productVariationsTable.stock_quantity,
          is_available: productVariationsTable.is_available,
        }
      })
        .from(orderItemsTable)
        .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
        .leftJoin(productVariationsTable, eq(orderItemsTable.variation_id, productVariationsTable.id))
        .where(eq(orderItemsTable.order_id, order.id))
        .execute();

      const orderItems = orderItemsQueryResult.map(item => ({
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
        variation: item.variation && item.variation.id ? {
          id: item.variation.id,
          product_id: item.variation.product_id,
          variation_type: item.variation.variation_type,
          variation_value: item.variation.variation_value,
          price_adjustment: parseFloat(item.variation.price_adjustment), // Convert numeric to number
          stock_quantity: item.variation.stock_quantity,
          is_available: item.variation.is_available,
        } : null,
      }));

      ordersWithItems.push({
        ...order,
        total_amount: parseFloat(order.total_amount), // Convert numeric to number
        items: orderItems,
      });
    }

    return ordersWithItems;
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    throw error;
  }
}