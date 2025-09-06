import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, productVariationsTable } from '../db/schema';
import { type ProductFilters } from '../schema';
import { getProducts } from '../handlers/products/get_products';

describe('getProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  const createTestProducts = async () => {
    // Create perfume products
    const perfumeProducts = await db.insert(productsTable)
      .values([
        {
          name: 'Rose Perfume',
          description: 'A beautiful rose scented perfume',
          type: 'perfume',
          gender: 'female',
          base_price: '50.00',
          is_active: true
        },
        {
          name: 'Oud Perfume',
          description: 'Rich oud fragrance for men',
          type: 'perfume',
          gender: 'male',
          base_price: '75.00',
          is_active: true
        },
        {
          name: 'Unisex Cologne',
          description: 'Fresh cologne for everyone',
          type: 'perfume',
          gender: 'unisex',
          base_price: '45.00',
          is_active: false // Inactive product
        }
      ])
      .returning()
      .execute();

    // Create shirt products
    const shirtProducts = await db.insert(productsTable)
      .values([
        {
          name: 'Cotton T-Shirt',
          description: 'Comfortable cotton t-shirt',
          type: 'shirt',
          gender: null,
          base_price: '25.00',
          is_active: true
        },
        {
          name: 'Polo Shirt',
          description: 'Classic polo shirt',
          type: 'shirt',
          gender: null,
          base_price: '35.00',
          is_active: true
        }
      ])
      .returning()
      .execute();

    // Create variations for perfume products
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: perfumeProducts[0].id,
          variation_type: 'volume',
          variation_value: '50ml',
          price_adjustment: '0.00',
          stock_quantity: 10
        },
        {
          product_id: perfumeProducts[0].id,
          variation_type: 'volume',
          variation_value: '100ml',
          price_adjustment: '25.00',
          stock_quantity: 5
        },
        {
          product_id: perfumeProducts[1].id,
          variation_type: 'volume',
          variation_value: '75ml',
          price_adjustment: '0.00',
          stock_quantity: 8
        }
      ])
      .execute();

    // Create variations for shirt products
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: shirtProducts[0].id,
          variation_type: 'size',
          variation_value: 'S',
          price_adjustment: '0.00',
          stock_quantity: 20
        },
        {
          product_id: shirtProducts[0].id,
          variation_type: 'size',
          variation_value: 'M',
          price_adjustment: '0.00',
          stock_quantity: 15
        },
        {
          product_id: shirtProducts[1].id,
          variation_type: 'size',
          variation_value: 'L',
          price_adjustment: '5.00',
          stock_quantity: 12
        }
      ])
      .execute();

    return { perfumeProducts, shirtProducts };
  };

  it('should return all active products with default pagination', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(4); // Only active products
    expect(result.total).toBe(4);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total_pages).toBe(1);

    // Verify each product has variations
    result.products.forEach(product => {
      expect(product.variations).toBeDefined();
      expect(Array.isArray(product.variations)).toBe(true);
      expect(product.variations.length).toBeGreaterThan(0);
      
      // Verify numeric conversion
      expect(typeof product.base_price).toBe('number');
      
      // Verify variation numeric conversion
      product.variations.forEach(variation => {
        expect(typeof variation.price_adjustment).toBe('number');
      });
    });
  });

  it('should filter products by type', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      type: 'perfume',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(2); // Only active perfumes
    expect(result.total).toBe(2);
    result.products.forEach(product => {
      expect(product.type).toBe('perfume');
      expect(product.is_active).toBe(true);
    });
  });

  it('should filter products by gender', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      gender: 'female',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.products[0].gender).toBe('female');
    expect(result.products[0].name).toBe('Rose Perfume');
  });

  it('should filter products by price range', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      min_price: 30,
      max_price: 60,
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(2); // Rose Perfume (50) and Polo Shirt (35)
    expect(result.total).toBe(2);
    result.products.forEach(product => {
      expect(product.base_price).toBeGreaterThanOrEqual(30);
      expect(product.base_price).toBeLessThanOrEqual(60);
    });
  });

  it('should search products by name', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      search: 'shirt',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(2);
    result.products.forEach(product => {
      expect(product.name.toLowerCase()).toContain('shirt');
    });
  });

  it('should handle case-insensitive search', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      search: 'ROSE',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Rose Perfume');
  });

  it('should combine multiple filters', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      type: 'perfume',
      gender: 'male',
      min_price: 70,
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Oud Perfume');
    expect(result.products[0].type).toBe('perfume');
    expect(result.products[0].gender).toBe('male');
    expect(result.products[0].base_price).toBe(75);
  });

  it('should handle pagination correctly', async () => {
    await createTestProducts();

    // First page
    const page1Filters: ProductFilters = {
      page: 1,
      limit: 2
    };

    const page1Result = await getProducts(page1Filters);

    expect(page1Result.products).toHaveLength(2);
    expect(page1Result.total).toBe(4);
    expect(page1Result.page).toBe(1);
    expect(page1Result.limit).toBe(2);
    expect(page1Result.total_pages).toBe(2);

    // Second page
    const page2Filters: ProductFilters = {
      page: 2,
      limit: 2
    };

    const page2Result = await getProducts(page2Filters);

    expect(page2Result.products).toHaveLength(2);
    expect(page2Result.total).toBe(4);
    expect(page2Result.page).toBe(2);
    expect(page2Result.limit).toBe(2);
    expect(page2Result.total_pages).toBe(2);

    // Ensure different products on different pages
    const page1Ids = page1Result.products.map(p => p.id);
    const page2Ids = page2Result.products.map(p => p.id);
    expect(page1Ids).not.toEqual(page2Ids);
  });

  it('should return empty results when no products match filters', async () => {
    await createTestProducts();

    const filters: ProductFilters = {
      search: 'nonexistent',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total_pages).toBe(0);
  });

  it('should exclude inactive products', async () => {
    await createTestProducts();

    // Try to find the inactive unisex cologne
    const filters: ProductFilters = {
      search: 'cologne',
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should order products by creation date descending', async () => {
    // Create products with slight delay to ensure different timestamps
    const firstProduct = await db.insert(productsTable)
      .values({
        name: 'First Product',
        description: 'Created first',
        type: 'shirt',
        gender: null,
        base_price: '10.00',
        is_active: true
      })
      .returning()
      .execute();

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondProduct = await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Created second',
        type: 'shirt',
        gender: null,
        base_price: '15.00',
        is_active: true
      })
      .returning()
      .execute();

    // Add variations for completeness
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: firstProduct[0].id,
          variation_type: 'size',
          variation_value: 'M',
          price_adjustment: '0.00',
          stock_quantity: 10
        },
        {
          product_id: secondProduct[0].id,
          variation_type: 'size',
          variation_value: 'L',
          price_adjustment: '0.00',
          stock_quantity: 5
        }
      ])
      .execute();

    const filters: ProductFilters = {
      page: 1,
      limit: 20
    };

    const result = await getProducts(filters);

    expect(result.products).toHaveLength(2);
    // Most recently created should be first
    expect(result.products[0].name).toBe('Second Product');
    expect(result.products[1].name).toBe('First Product');
  });
});