import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput, type AuthContext } from '../schema';
import { createProduct } from '../handlers/products/create_product';
import { eq } from 'drizzle-orm';

// Test auth contexts
const adminContext: AuthContext = {
  user_id: 1,
  role: 'admin'
};

const customerContext: AuthContext = {
  user_id: 2,
  role: 'customer'
};

// Test inputs
const perfumeInput: CreateProductInput = {
  name: 'Test Perfume',
  description: 'A luxurious perfume for testing',
  type: 'perfume',
  gender: 'female',
  base_price: 89.99,
  image_url: 'https://example.com/perfume.jpg'
};

const shirtInput: CreateProductInput = {
  name: 'Test Shirt',
  description: 'A comfortable cotton shirt',
  type: 'shirt',
  gender: null,
  base_price: 29.50
};

const minimalInput: CreateProductInput = {
  name: 'Minimal Product',
  description: 'Basic product',
  type: 'perfume',
  gender: 'unisex',
  base_price: 15.00
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a perfume product with all fields', async () => {
    const result = await createProduct(perfumeInput, adminContext);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Test Perfume');
    expect(result.description).toEqual(perfumeInput.description);
    expect(result.type).toEqual('perfume');
    expect(result.gender).toEqual('female');
    expect(result.base_price).toEqual(89.99);
    expect(typeof result.base_price).toEqual('number');
    expect(result.image_url).toEqual('https://example.com/perfume.jpg');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a shirt product with null gender', async () => {
    const result = await createProduct(shirtInput, adminContext);

    // Verify shirt-specific fields
    expect(result.name).toEqual('Test Shirt');
    expect(result.type).toEqual('shirt');
    expect(result.gender).toBeNull();
    expect(result.base_price).toEqual(29.50);
    expect(result.image_url).toBeNull();
    expect(result.is_active).toEqual(true);
  });

  it('should create product with minimal required fields', async () => {
    const result = await createProduct(minimalInput, adminContext);

    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toEqual('Basic product');
    expect(result.type).toEqual('perfume');
    expect(result.gender).toEqual('unisex');
    expect(result.base_price).toEqual(15.00);
    expect(result.image_url).toBeNull();
    expect(result.is_active).toEqual(true);
  });

  it('should save product to database with correct data types', async () => {
    const result = await createProduct(perfumeInput, adminContext);

    // Query database to verify data was saved correctly
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    const savedProduct = products[0];
    
    expect(savedProduct.name).toEqual('Test Perfume');
    expect(savedProduct.type).toEqual('perfume');
    expect(savedProduct.gender).toEqual('female');
    expect(parseFloat(savedProduct.base_price)).toEqual(89.99); // Numeric stored as string
    expect(savedProduct.image_url).toEqual('https://example.com/perfume.jpg');
    expect(savedProduct.is_active).toEqual(true);
    expect(savedProduct.created_at).toBeInstanceOf(Date);
    expect(savedProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal prices correctly', async () => {
    const decimalInput: CreateProductInput = {
      name: 'Decimal Price Product',
      description: 'Testing decimal handling',
      type: 'shirt',
      gender: 'male',
      base_price: 123.45
    };

    const result = await createProduct(decimalInput, adminContext);

    expect(result.base_price).toEqual(123.45);
    expect(typeof result.base_price).toEqual('number');

    // Verify in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(parseFloat(products[0].base_price)).toEqual(123.45);
  });

  it('should reject access for customer role', async () => {
    await expect(createProduct(perfumeInput, customerContext))
      .rejects.toThrow(/access denied.*admin role required/i);
  });

  it('should handle various product types and genders', async () => {
    const testCases = [
      { type: 'perfume' as const, gender: 'male' as const },
      { type: 'perfume' as const, gender: 'female' as const },
      { type: 'perfume' as const, gender: 'unisex' as const },
      { type: 'shirt' as const, gender: null }
    ];

    for (const testCase of testCases) {
      const input: CreateProductInput = {
        name: `Test ${testCase.type} ${testCase.gender || 'nogender'}`,
        description: 'Test product',
        type: testCase.type,
        gender: testCase.gender,
        base_price: 50.00
      };

      const result = await createProduct(input, adminContext);
      
      expect(result.type).toEqual(testCase.type);
      expect(result.gender).toEqual(testCase.gender);
    }
  });

  it('should create multiple products without conflicts', async () => {
    const inputs: CreateProductInput[] = [
      {
        name: 'Product 1',
        description: 'First product',
        type: 'perfume',
        gender: 'female',
        base_price: 75.00
      },
      {
        name: 'Product 2',
        description: 'Second product',
        type: 'shirt',
        gender: null,
        base_price: 25.00
      }
    ];

    const results = [];
    for (const input of inputs) {
      const result = await createProduct(input, adminContext);
      results.push(result);
    }

    // Verify both products were created with unique IDs
    expect(results).toHaveLength(2);
    expect(results[0].id).not.toEqual(results[1].id);
    expect(results[0].name).toEqual('Product 1');
    expect(results[1].name).toEqual('Product 2');

    // Verify both are in database
    const allProducts = await db.select().from(productsTable).execute();
    expect(allProducts).toHaveLength(2);
  });
});