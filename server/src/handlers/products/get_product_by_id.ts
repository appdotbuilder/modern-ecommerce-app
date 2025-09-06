import { db } from '../../db';
import { productsTable, productVariationsTable } from '../../db/schema';
import { type ProductWithVariations } from '../../schema';
import { eq } from 'drizzle-orm';

export async function getProductById(id: number): Promise<ProductWithVariations | null> {
  try {
    // Query for the product and its variations in separate queries for better control
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (products.length === 0) {
      return null;
    }

    const product = products[0];

    // Query for all variations of this product
    const variations = await db.select()
      .from(productVariationsTable)
      .where(eq(productVariationsTable.product_id, id))
      .execute();

    // Convert numeric fields for both product and variations
    return {
      ...product,
      base_price: parseFloat(product.base_price),
      variations: variations.map(variation => ({
        ...variation,
        price_adjustment: parseFloat(variation.price_adjustment),
      })),
    };
  } catch (error) {
    console.error('Failed to get product by ID:', error);
    throw error;
  }
}