import { db } from '../../db';
import { cartTable, cartItemsTable, productsTable, productVariationsTable } from '../../db/schema';
import { type CartWithItems, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function getCart(context: AuthContext): Promise<CartWithItems> {
  try {
    // Find or create cart for the authenticated user
    let cart = await db.select()
      .from(cartTable)
      .where(eq(cartTable.user_id, context.user_id))
      .limit(1)
      .execute();

    // If no cart exists, create one
    if (cart.length === 0) {
      const newCartResult = await db.insert(cartTable)
        .values({
          user_id: context.user_id
        })
        .returning()
        .execute();
      
      cart = newCartResult;
    }

    const userCart = cart[0];

    // Load cart items with product and variation details
    const cartItemsWithDetails = await db.select({
      // Cart item fields
      id: cartItemsTable.id,
      cart_id: cartItemsTable.cart_id,
      product_id: cartItemsTable.product_id,
      variation_id: cartItemsTable.variation_id,
      quantity: cartItemsTable.quantity,
      custom_design_text: cartItemsTable.custom_design_text,
      custom_design_url: cartItemsTable.custom_design_url,
      unit_price: cartItemsTable.unit_price,
      created_at: cartItemsTable.created_at,
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
      // Variation fields (nullable)
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
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
    .leftJoin(productVariationsTable, eq(cartItemsTable.variation_id, productVariationsTable.id))
    .where(eq(cartItemsTable.cart_id, userCart.id))
    .execute();

    // Transform the data to match the expected schema
    const items = cartItemsWithDetails.map(item => ({
      id: item.id,
      cart_id: item.cart_id,
      product_id: item.product_id,
      variation_id: item.variation_id,
      quantity: item.quantity,
      custom_design_text: item.custom_design_text,
      custom_design_url: item.custom_design_url,
      unit_price: parseFloat(item.unit_price), // Convert numeric to number
      created_at: item.created_at,
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

    return {
      id: userCart.id,
      user_id: userCart.user_id,
      created_at: userCart.created_at,
      updated_at: userCart.updated_at,
      items,
    };
  } catch (error) {
    console.error('Get cart failed:', error);
    throw error;
  }
}