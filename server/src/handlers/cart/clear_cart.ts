import { db } from '../../db';
import { cartTable, cartItemsTable } from '../../db/schema';
import { type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function clearCart(context: AuthContext): Promise<boolean> {
  try {
    // First, find the user's cart
    const userCart = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, context.user_id))
      .execute();

    // If no cart exists, consider it already cleared
    if (userCart.length === 0) {
      return true;
    }

    const cart = userCart[0];

    // Delete all cart items for this cart
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.cart_id, cart.id))
      .execute();

    return true;
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
}