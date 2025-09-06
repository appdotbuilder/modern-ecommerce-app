import { db } from '../../db';
import { 
  cartTable, 
  cartItemsTable, 
  ordersTable, 
  orderItemsTable,
  productsTable,
  productVariationsTable 
} from '../../db/schema';
import { type CreateOrderInput, type Order, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function createOrder(input: CreateOrderInput, context: AuthContext): Promise<Order> {
  try {
    // 1. Get user's cart and cart items with product details
    const userCart = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, context.user_id))
      .execute();

    if (userCart.length === 0) {
      throw new Error('User cart not found');
    }

    const cartId = userCart[0].id;

    // Get cart items with product and variation details
    const cartItems = await db.select({
      cart_item: cartItemsTable,
      product: productsTable,
      variation: productVariationsTable,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
    .leftJoin(productVariationsTable, eq(cartItemsTable.variation_id, productVariationsTable.id))
    .where(eq(cartItemsTable.cart_id, cartId))
    .execute();

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // 2. Calculate total amount
    let totalAmount = 0;
    for (const item of cartItems) {
      const unitPrice = parseFloat(item.cart_item.unit_price);
      totalAmount += unitPrice * item.cart_item.quantity;
    }

    // 3. Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${context.user_id}`;

    // 4. Create order record
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: context.user_id,
        order_number: orderNumber,
        status: 'pending',
        total_amount: totalAmount.toString(),
        shipping_address: input.shipping_address,
        billing_address: input.billing_address,
        payment_method: input.payment_method,
        payment_status: 'pending',
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // 5. Create order items from cart items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.cart_item.product_id,
      variation_id: item.cart_item.variation_id,
      quantity: item.cart_item.quantity,
      custom_design_text: item.cart_item.custom_design_text,
      custom_design_url: item.cart_item.custom_design_url,
      unit_price: item.cart_item.unit_price,
      total_price: (parseFloat(item.cart_item.unit_price) * item.cart_item.quantity).toString(),
    }));

    await db.insert(orderItemsTable)
      .values(orderItemsData)
      .execute();

    // 6. Clear the cart
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cartId))
      .execute();

    // 7. Process payment through payment gateway (mock implementation)
    // In a real application, this would integrate with Stripe, PayPal, etc.
    const paymentResult = await processPayment(input.payment_method, totalAmount);

    // 8. Update order status based on payment result
    let finalStatus: 'pending' | 'processing' | 'cancelled';
    let paymentStatus: string;

    if (paymentResult.success) {
      finalStatus = 'processing';
      paymentStatus = 'completed';
    } else {
      finalStatus = 'cancelled';
      paymentStatus = 'failed';
    }

    const updatedOrderResult = await db.update(ordersTable)
      .set({
        status: finalStatus,
        payment_status: paymentStatus,
        updated_at: new Date(),
      })
      .where(eq(ordersTable.id, order.id))
      .returning()
      .execute();

    const finalOrder = updatedOrderResult[0];

    // 9. Return order data with proper numeric conversion
    return {
      ...finalOrder,
      total_amount: parseFloat(finalOrder.total_amount),
    };

  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

// Mock payment processing function
async function processPayment(paymentMethod: string, amount: number): Promise<{ success: boolean; transactionId?: string }> {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock payment logic - in real app, this would call external payment APIs
  if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
    return { success: true, transactionId: `txn_${Date.now()}` };
  } else if (paymentMethod === 'paypal') {
    return { success: true, transactionId: `pp_${Date.now()}` };
  } else {
    return { success: false };
  }
}