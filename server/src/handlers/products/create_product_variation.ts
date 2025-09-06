import { db } from '../../db';
import { productVariationsTable, productsTable } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { type CreateProductVariationInput, type ProductVariation, type AuthContext } from '../../schema';

export async function createProductVariation(input: CreateProductVariationInput, context: AuthContext): Promise<ProductVariation> {
  try {
    // Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // Validate product exists
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (products.length === 0) {
      throw new Error('Product not found');
    }

    // Insert new product variation into database
    const result = await db.insert(productVariationsTable)
      .values({
        product_id: input.product_id,
        variation_type: input.variation_type,
        variation_value: input.variation_value,
        price_adjustment: input.price_adjustment.toString(), // Convert number to string for numeric column
        stock_quantity: input.stock_quantity,
        is_available: true // Default value as per schema
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const variation = result[0];
    return {
      ...variation,
      price_adjustment: parseFloat(variation.price_adjustment) // Convert string back to number
    };
  } catch (error) {
    console.error('Product variation creation failed:', error);
    throw error;
  }
}