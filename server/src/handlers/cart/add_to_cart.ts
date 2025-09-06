import { db } from '../../db';
import { cartTable, cartItemsTable, productsTable, productVariationsTable } from '../../db/schema';
import { type AddToCartInput, type CartItem, type AuthContext } from '../../schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function addToCart(input: AddToCartInput, context: AuthContext): Promise<CartItem> {
  try {
    // 1. Find or create cart for the authenticated user
    let cart = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, context.user_id))
      .execute();

    let cartId: number;
    if (cart.length === 0) {
      // Create new cart for user
      const newCart = await db.insert(cartTable)
        .values({ user_id: context.user_id })
        .returning()
        .execute();
      cartId = newCart[0].id;
    } else {
      cartId = cart[0].id;
    }

    // 2. Validate product exists and is active
    const product = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, input.product_id),
        eq(productsTable.is_active, true)
      ))
      .execute();

    if (product.length === 0) {
      throw new Error('Product not found or inactive');
    }

    let unitPrice = parseFloat(product[0].base_price);

    // 3. Validate variation if provided
    if (input.variation_id) {
      const variation = await db.select()
        .from(productVariationsTable)
        .where(and(
          eq(productVariationsTable.id, input.variation_id),
          eq(productVariationsTable.product_id, input.product_id),
          eq(productVariationsTable.is_available, true)
        ))
        .execute();

      if (variation.length === 0) {
        throw new Error('Product variation not found or unavailable');
      }

      // Add price adjustment for variation
      unitPrice += parseFloat(variation[0].price_adjustment);
    }

    // 4. Check if item already exists in cart (same product, variation, and custom design)
    const conditions = [
      eq(cartItemsTable.cart_id, cartId),
      eq(cartItemsTable.product_id, input.product_id)
    ];

    // Handle nullable variation_id
    if (input.variation_id) {
      conditions.push(eq(cartItemsTable.variation_id, input.variation_id));
    } else {
      conditions.push(isNull(cartItemsTable.variation_id));
    }

    // Handle nullable custom_design_text
    if (input.custom_design_text) {
      conditions.push(eq(cartItemsTable.custom_design_text, input.custom_design_text));
    } else {
      conditions.push(isNull(cartItemsTable.custom_design_text));
    }

    // Handle nullable custom_design_url
    if (input.custom_design_url) {
      conditions.push(eq(cartItemsTable.custom_design_url, input.custom_design_url));
    } else {
      conditions.push(isNull(cartItemsTable.custom_design_url));
    }

    const existingItem = await db.select()
      .from(cartItemsTable)
      .where(and(...conditions))
      .execute();

    if (existingItem.length > 0) {
      // 5a. Update existing cart item by adding quantities
      const updatedItem = await db.update(cartItemsTable)
        .set({
          quantity: existingItem[0].quantity + input.quantity,
          unit_price: unitPrice.toString()
        })
        .where(eq(cartItemsTable.id, existingItem[0].id))
        .returning()
        .execute();

      return {
        ...updatedItem[0],
        unit_price: parseFloat(updatedItem[0].unit_price)
      };
    } else {
      // 5b. Insert new cart item
      const newItem = await db.insert(cartItemsTable)
        .values({
          cart_id: cartId,
          product_id: input.product_id,
          variation_id: input.variation_id || null,
          quantity: input.quantity,
          custom_design_text: input.custom_design_text || null,
          custom_design_url: input.custom_design_url || null,
          unit_price: unitPrice.toString()
        })
        .returning()
        .execute();

      return {
        ...newItem[0],
        unit_price: parseFloat(newItem[0].unit_price)
      };
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}