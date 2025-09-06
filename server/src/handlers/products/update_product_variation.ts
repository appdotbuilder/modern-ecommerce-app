import { db } from '../../db';
import { productVariationsTable } from '../../db/schema';
import { type UpdateProductVariationInput, type ProductVariation, type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function updateProductVariation(input: UpdateProductVariationInput, context: AuthContext): Promise<ProductVariation> {
  try {
    // 1. Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // 2. Check if the variation exists
    const existingVariation = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.id, input.id))
      .execute();

    if (existingVariation.length === 0) {
      throw new Error('Product variation not found');
    }

    // 3. Build update object with only provided fields
    const updateData: any = {};
    
    if (input.variation_type !== undefined) {
      updateData.variation_type = input.variation_type;
    }
    
    if (input.variation_value !== undefined) {
      updateData.variation_value = input.variation_value;
    }
    
    if (input.price_adjustment !== undefined) {
      updateData.price_adjustment = input.price_adjustment.toString(); // Convert to string for numeric column
    }
    
    if (input.stock_quantity !== undefined) {
      updateData.stock_quantity = input.stock_quantity;
    }
    
    if (input.is_available !== undefined) {
      updateData.is_available = input.is_available;
    }

    // 4. Update variation in database only if there are fields to update
    let result;
    if (Object.keys(updateData).length > 0) {
      result = await db.update(productVariationsTable)
        .set(updateData)
        .where(eq(productVariationsTable.id, input.id))
        .returning()
        .execute();
    } else {
      // If no updates, just return the existing variation
      result = existingVariation;
    }

    // 5. Convert numeric fields back to numbers before returning
    const updatedVariation = result[0];
    return {
      ...updatedVariation,
      price_adjustment: parseFloat(updatedVariation.price_adjustment), // Convert string back to number
    };
  } catch (error) {
    console.error('Product variation update failed:', error);
    throw error;
  }
}