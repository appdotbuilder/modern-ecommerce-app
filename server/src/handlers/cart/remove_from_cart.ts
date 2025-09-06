import { db } from '../../db';
import { cartItemsTable, cartTable } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { type AuthContext } from '../../schema';

export async function removeFromCart(cartItemId: number, context: AuthContext): Promise<boolean> {
  try {
    // First, verify the cart item exists and belongs to the authenticated user
    const cartItemWithCart = await db.select({
      cart_item_id: cartItemsTable.id,
      cart_user_id: cartTable.user_id
    })
      .from(cartItemsTable)
      .innerJoin(cartTable, eq(cartItemsTable.cart_id, cartTable.id))
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    // Check if cart item exists
    if (cartItemWithCart.length === 0) {
      return false; // Cart item not found
    }

    // Check if cart item belongs to the authenticated user
    if (cartItemWithCart[0].cart_user_id !== context.user_id) {
      return false; // Cart item doesn't belong to the user
    }

    // Delete the cart item
    const deleteResult = await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    // Return true if deletion was successful
    return (deleteResult.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
}