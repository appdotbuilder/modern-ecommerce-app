import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, productVariationsTable } from '../db/schema';
import { getProductById } from '../handlers/products/get_product_by_id';

// Test data
const testProduct = {
  name: 'Rose Perfume',
  description: 'A beautiful rose-scented perfume',
  type: 'perfume' as const,
  gender: 'female' as const,
  base_price: '89.99',
  image_url: 'https://example.com/rose-perfume.jpg',
  is_active: true,
};

const testShirtProduct = {
  name: 'Custom T-Shirt',
  description: 'A customizable cotton t-shirt',
  type: 'shirt' as const,
  gender: null,
  base_price: '24.99',
  image_url: null,
  is_active: true,
};

describe('getProductById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return product with variations', async () => {
    // Create test product
    const products = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();
    
    const productId = products[0].id;

    // Create test variations
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: productId,
          variation_type: 'volume',
          variation_value: '50ml',
          price_adjustment: '0.00',
          stock_quantity: 10,
          is_available: true,
        },
        {
          product_id: productId,
          variation_type: 'volume',
          variation_value: '100ml',
          price_adjustment: '15.00',
          stock_quantity: 5,
          is_available: true,
        },
      ])
      .execute();

    const result = await getProductById(productId);

    // Verify product data
    expect(result).toBeDefined();
    expect(result!.id).toBe(productId);
    expect(result!.name).toBe('Rose Perfume');
    expect(result!.description).toBe('A beautiful rose-scented perfume');
    expect(result!.type).toBe('perfume');
    expect(result!.gender).toBe('female');
    expect(result!.base_price).toBe(89.99);
    expect(typeof result!.base_price).toBe('number');
    expect(result!.image_url).toBe('https://example.com/rose-perfume.jpg');
    expect(result!.is_active).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify variations data
    expect(result!.variations).toHaveLength(2);
    
    const volume50ml = result!.variations.find(v => v.variation_value === '50ml');
    expect(volume50ml).toBeDefined();
    expect(volume50ml!.variation_type).toBe('volume');
    expect(volume50ml!.price_adjustment).toBe(0);
    expect(typeof volume50ml!.price_adjustment).toBe('number');
    expect(volume50ml!.stock_quantity).toBe(10);
    expect(volume50ml!.is_available).toBe(true);

    const volume100ml = result!.variations.find(v => v.variation_value === '100ml');
    expect(volume100ml).toBeDefined();
    expect(volume100ml!.variation_type).toBe('volume');
    expect(volume100ml!.price_adjustment).toBe(15);
    expect(typeof volume100ml!.price_adjustment).toBe('number');
    expect(volume100ml!.stock_quantity).toBe(5);
    expect(volume100ml!.is_available).toBe(true);
  });

  it('should return product without variations', async () => {
    // Create test product without variations
    const products = await db.insert(productsTable)
      .values(testShirtProduct)
      .returning()
      .execute();
    
    const productId = products[0].id;

    const result = await getProductById(productId);

    expect(result).toBeDefined();
    expect(result!.id).toBe(productId);
    expect(result!.name).toBe('Custom T-Shirt');
    expect(result!.type).toBe('shirt');
    expect(result!.gender).toBeNull();
    expect(result!.base_price).toBe(24.99);
    expect(typeof result!.base_price).toBe('number');
    expect(result!.image_url).toBeNull();
    expect(result!.variations).toHaveLength(0);
  });

  it('should return null for non-existent product', async () => {
    const result = await getProductById(99999);

    expect(result).toBeNull();
  });

  it('should handle inactive product', async () => {
    // Create inactive product
    const inactiveProduct = {
      ...testProduct,
      is_active: false,
    };

    const products = await db.insert(productsTable)
      .values(inactiveProduct)
      .returning()
      .execute();
    
    const productId = products[0].id;

    const result = await getProductById(productId);

    expect(result).toBeDefined();
    expect(result!.is_active).toBe(false);
  });

  it('should handle product with mixed availability variations', async () => {
    // Create test product
    const products = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();
    
    const productId = products[0].id;

    // Create variations with different availability
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: productId,
          variation_type: 'volume',
          variation_value: '30ml',
          price_adjustment: '-10.00',
          stock_quantity: 0,
          is_available: false,
        },
        {
          product_id: productId,
          variation_type: 'volume',
          variation_value: '50ml',
          price_adjustment: '0.00',
          stock_quantity: 15,
          is_available: true,
        },
      ])
      .execute();

    const result = await getProductById(productId);

    expect(result!.variations).toHaveLength(2);
    
    const unavailableVariation = result!.variations.find(v => v.variation_value === '30ml');
    expect(unavailableVariation!.is_available).toBe(false);
    expect(unavailableVariation!.stock_quantity).toBe(0);
    expect(unavailableVariation!.price_adjustment).toBe(-10);
    expect(typeof unavailableVariation!.price_adjustment).toBe('number');

    const availableVariation = result!.variations.find(v => v.variation_value === '50ml');
    expect(availableVariation!.is_available).toBe(true);
    expect(availableVariation!.stock_quantity).toBe(15);
    expect(availableVariation!.price_adjustment).toBe(0);
  });

  it('should handle different variation types for shirt products', async () => {
    // Create shirt product
    const products = await db.insert(productsTable)
      .values(testShirtProduct)
      .returning()
      .execute();
    
    const productId = products[0].id;

    // Create size variations
    await db.insert(productVariationsTable)
      .values([
        {
          product_id: productId,
          variation_type: 'size',
          variation_value: 'S',
          price_adjustment: '0.00',
          stock_quantity: 20,
          is_available: true,
        },
        {
          product_id: productId,
          variation_type: 'size',
          variation_value: 'M',
          price_adjustment: '0.00',
          stock_quantity: 25,
          is_available: true,
        },
        {
          product_id: productId,
          variation_type: 'size',
          variation_value: 'L',
          price_adjustment: '2.00',
          stock_quantity: 15,
          is_available: true,
        },
      ])
      .execute();

    const result = await getProductById(productId);

    expect(result!.variations).toHaveLength(3);
    expect(result!.variations.every(v => v.variation_type === 'size')).toBe(true);
    
    const sizeL = result!.variations.find(v => v.variation_value === 'L');
    expect(sizeL!.price_adjustment).toBe(2);
    expect(typeof sizeL!.price_adjustment).toBe('number');
  });
});