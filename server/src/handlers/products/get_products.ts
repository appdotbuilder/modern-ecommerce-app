import { db } from '../../db';
import { productsTable, productVariationsTable } from '../../db/schema';
import { type ProductFilters, type PaginatedProducts, type ProductWithVariations } from '../../schema';
import { eq, and, gte, lte, ilike, desc, SQL } from 'drizzle-orm';

export async function getProducts(filters: ProductFilters): Promise<PaginatedProducts> {
  try {
    // Calculate offset for pagination
    const offset = (filters.page - 1) * filters.limit;

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters.type) {
      conditions.push(eq(productsTable.type, filters.type));
    }

    if (filters.gender) {
      conditions.push(eq(productsTable.gender, filters.gender));
    }

    if (filters.search) {
      conditions.push(ilike(productsTable.name, `%${filters.search}%`));
    }

    if (filters.min_price !== undefined) {
      conditions.push(gte(productsTable.base_price, filters.min_price.toString()));
    }

    if (filters.max_price !== undefined) {
      conditions.push(lte(productsTable.base_price, filters.max_price.toString()));
    }

    // Always filter for active products
    conditions.push(eq(productsTable.is_active, true));

    // Build the where condition
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Build query for products with pagination
    const productsQuery = db.select()
      .from(productsTable)
      .where(whereCondition)
      .orderBy(desc(productsTable.created_at))
      .limit(filters.limit)
      .offset(offset);

    // Execute the paginated query
    const products = await productsQuery.execute();

    // Get total count for pagination using the same conditions
    const countQuery = db.select()
      .from(productsTable)
      .where(whereCondition);
    
    const countResult = await countQuery.execute();
    const total = countResult.length;

    // Fetch variations for each product
    const productsWithVariations: ProductWithVariations[] = [];
    
    for (const product of products) {
      // Get variations for this product
      const variations = await db.select()
        .from(productVariationsTable)
        .where(eq(productVariationsTable.product_id, product.id))
        .execute();

      // Convert numeric fields
      const convertedProduct = {
        ...product,
        base_price: parseFloat(product.base_price)
      };

      const convertedVariations = variations.map(variation => ({
        ...variation,
        price_adjustment: parseFloat(variation.price_adjustment)
      }));

      productsWithVariations.push({
        ...convertedProduct,
        variations: convertedVariations
      });
    }

    // Calculate total pages
    const total_pages = Math.ceil(total / filters.limit);

    return {
      products: productsWithVariations,
      total,
      page: filters.page,
      limit: filters.limit,
      total_pages
    };
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}