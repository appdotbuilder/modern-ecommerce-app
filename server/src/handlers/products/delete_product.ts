import { db } from '../../db';
import { productsTable } from '../../db/schema';
import { type AuthContext } from '../../schema';
import { eq } from 'drizzle-orm';

export async function deleteProduct(id: number, context: AuthContext): Promise<boolean> {
  try {
    // 1. Verify user has admin role
    if (context.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }

    // 2. Check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error('Product not found');
    }

    // 3. Soft delete product (set is_active to false)
    const result = await db.update(productsTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .execute();

    // 4. Return success status
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}