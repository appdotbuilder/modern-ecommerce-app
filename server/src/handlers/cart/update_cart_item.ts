import { db } from '../../db';
import { cartItemsTable, cartTable } from '../../db/schema';
import { type UpdateCartItemInput, type CartItem, type AuthContext } from '../../schema';
import { eq, and } from 'drizzle-orm';

export async function updateCartItem(input: UpdateCartItemInput, context: AuthContext): Promise<CartItem> {
  try {
    // If quantity is 0, remove the item from cart
    if (input.quantity === 0) {
      // Verify the cart item exists and belongs to the authenticated user
      const cartItemResult = await db
        .select({
          cart_item_id: cartItemsTable.id,
        })
        .from(cartItemsTable)
        .innerJoin(cartTable, eq(cartItemsTable.cart_id, cartTable.id))
        .where(
          and(
            eq(cartItemsTable.id, input.cart_item_id),
            eq(cartTable.user_id, context.user_id)
          )
        )
        .execute();

      if (cartItemResult.length === 0) {
        throw new Error('Cart item not found or unauthorized');
      }

      // Delete the cart item
      await db
        .delete(cartItemsTable)
        .where(eq(cartItemsTable.id, input.cart_item_id))
        .execute();

      // Return a "deleted" cart item representation
      return {
        id: input.cart_item_id,
        cart_id: 0,
        product_id: 0,
        variation_id: null,
        quantity: 0,
        custom_design_text: null,
        custom_design_url: null,
        unit_price: 0,
        created_at: new Date(),
      };
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof cartItemsTable.$inferInsert> = {};
    
    if (input.quantity !== undefined) {
      updateData.quantity = input.quantity;
    }
    
    if (input.custom_design_text !== undefined) {
      updateData.custom_design_text = input.custom_design_text;
    }
    
    if (input.custom_design_url !== undefined) {
      updateData.custom_design_url = input.custom_design_url;
    }

    // Update cart item with authorization check
    const result = await db
      .update(cartItemsTable)
      .set(updateData)
      .from(cartTable)
      .where(
        and(
          eq(cartItemsTable.id, input.cart_item_id),
          eq(cartItemsTable.cart_id, cartTable.id),
          eq(cartTable.user_id, context.user_id)
        )
      )
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Cart item not found or unauthorized');
    }

    const cartItem = result[0];
    return {
      ...cartItem,
      unit_price: parseFloat(cartItem.unit_price), // Convert numeric to number
    };
  } catch (error) {
    console.error('Cart item update failed:', error);
    throw error;
  }
}