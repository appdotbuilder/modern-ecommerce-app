import { db } from '../../db';
import { productsTable } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateProductInput, type Product, type AuthContext } from '../../schema';

export async function updateProduct(input: UpdateProductInput, context: AuthContext): Promise<Product> {
  try {
    // Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // Check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof productsTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.type !== undefined) {
      updateData.type = input.type;
    }
    if (input.gender !== undefined) {
      updateData.gender = input.gender;
    }
    if (input.base_price !== undefined) {
      updateData.base_price = input.base_price.toString(); // Convert to string for numeric column
    }
    if (input.image_url !== undefined) {
      updateData.image_url = input.image_url;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Update product in database
    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedProduct = result[0];
    return {
      ...updatedProduct,
      base_price: parseFloat(updatedProduct.base_price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}