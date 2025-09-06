import { db } from '../../db';
import { productsTable } from '../../db/schema';
import { type CreateProductInput, type Product, type AuthContext } from '../../schema';

export async function createProduct(input: CreateProductInput, context: AuthContext): Promise<Product> {
  // Verify user has admin role
  if (context.role !== 'admin') {
    throw new Error('Access denied. Admin role required.');
  }

  try {
    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        type: input.type,
        gender: input.gender,
        base_price: input.base_price.toString(), // Convert number to string for numeric column
        image_url: input.image_url || null,
        is_active: true
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      base_price: parseFloat(product.base_price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}