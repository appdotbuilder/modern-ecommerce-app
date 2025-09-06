import { z } from 'zod';

// Enums
export const productTypeSchema = z.enum(['perfume', 'shirt']);
export const genderSchema = z.enum(['male', 'female', 'unisex']);
export const orderStatusSchema = z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);
export const userRoleSchema = z.enum(['customer', 'admin']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const updateProfileInputSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

// Product schemas
export const productVariationSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  variation_type: z.string(),
  variation_value: z.string(),
  price_adjustment: z.number(),
  stock_quantity: z.number().int().nonnegative(),
  is_available: z.boolean(),
});

export type ProductVariation = z.infer<typeof productVariationSchema>;

export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: productTypeSchema,
  gender: genderSchema.nullable(),
  base_price: z.number().positive(),
  image_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Product = z.infer<typeof productSchema>;

export const productWithVariationsSchema = productSchema.extend({
  variations: z.array(productVariationSchema),
});

export type ProductWithVariations = z.infer<typeof productWithVariationsSchema>;

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: productTypeSchema,
  gender: genderSchema.nullable(),
  base_price: z.number().positive(),
  image_url: z.string().url().optional(),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: productTypeSchema.optional(),
  gender: genderSchema.nullable().optional(),
  base_price: z.number().positive().optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

export const createProductVariationInputSchema = z.object({
  product_id: z.number(),
  variation_type: z.string().min(1),
  variation_value: z.string().min(1),
  price_adjustment: z.number().default(0),
  stock_quantity: z.number().int().nonnegative(),
});

export type CreateProductVariationInput = z.infer<typeof createProductVariationInputSchema>;

export const updateProductVariationInputSchema = z.object({
  id: z.number(),
  variation_type: z.string().min(1).optional(),
  variation_value: z.string().min(1).optional(),
  price_adjustment: z.number().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  is_available: z.boolean().optional(),
});

export type UpdateProductVariationInput = z.infer<typeof updateProductVariationInputSchema>;

// Cart schemas
export const cartItemSchema = z.object({
  id: z.number(),
  cart_id: z.number(),
  product_id: z.number(),
  variation_id: z.number().nullable(),
  quantity: z.number().int().positive(),
  custom_design_text: z.string().nullable(),
  custom_design_url: z.string().url().nullable(),
  unit_price: z.number().positive(),
  created_at: z.coerce.date(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartItemWithProductSchema = cartItemSchema.extend({
  product: productSchema,
  variation: productVariationSchema.nullable(),
});

export type CartItemWithProduct = z.infer<typeof cartItemWithProductSchema>;

export const cartSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Cart = z.infer<typeof cartSchema>;

export const cartWithItemsSchema = cartSchema.extend({
  items: z.array(cartItemWithProductSchema),
});

export type CartWithItems = z.infer<typeof cartWithItemsSchema>;

export const addToCartInputSchema = z.object({
  product_id: z.number(),
  variation_id: z.number().optional(),
  quantity: z.number().int().positive().default(1),
  custom_design_text: z.string().optional(),
  custom_design_url: z.string().url().optional(),
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z.object({
  cart_item_id: z.number(),
  quantity: z.number().int().positive().optional(),
  custom_design_text: z.string().nullable().optional(),
  custom_design_url: z.string().url().nullable().optional(),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

// Order schemas
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  variation_id: z.number().nullable(),
  quantity: z.number().int().positive(),
  custom_design_text: z.string().nullable(),
  custom_design_url: z.string().url().nullable(),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderItemWithProductSchema = orderItemSchema.extend({
  product: productSchema,
  variation: productVariationSchema.nullable(),
});

export type OrderItemWithProduct = z.infer<typeof orderItemWithProductSchema>;

export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  order_number: z.string(),
  status: orderStatusSchema,
  total_amount: z.number().positive(),
  shipping_address: z.string(),
  billing_address: z.string(),
  payment_method: z.string(),
  payment_status: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Order = z.infer<typeof orderSchema>;

export const orderWithItemsSchema = orderSchema.extend({
  items: z.array(orderItemWithProductSchema),
});

export type OrderWithItems = z.infer<typeof orderWithItemsSchema>;

export const createOrderInputSchema = z.object({
  shipping_address: z.string().min(1),
  billing_address: z.string().min(1),
  payment_method: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  order_id: z.number(),
  status: orderStatusSchema,
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

// Address schemas
export const userAddressSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  street_address: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
  is_default: z.boolean(),
  created_at: z.coerce.date(),
});

export type UserAddress = z.infer<typeof userAddressSchema>;

export const createAddressInputSchema = z.object({
  type: z.enum(['shipping', 'billing']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  street_address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
  is_default: z.boolean().default(false),
});

export type CreateAddressInput = z.infer<typeof createAddressInputSchema>;

export const updateAddressInputSchema = z.object({
  id: z.number(),
  type: z.enum(['shipping', 'billing']).optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  street_address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  postal_code: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
});

export type UpdateAddressInput = z.infer<typeof updateAddressInputSchema>;

// Filter and pagination schemas
export const productFiltersSchema = z.object({
  type: productTypeSchema.optional(),
  gender: genderSchema.optional(),
  search: z.string().optional(),
  min_price: z.number().positive().optional(),
  max_price: z.number().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;

export const paginatedProductsSchema = z.object({
  products: z.array(productWithVariationsSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
});

export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>;

// Auth context schema
export const authContextSchema = z.object({
  user_id: z.number(),
  role: userRoleSchema,
});

export type AuthContext = z.infer<typeof authContextSchema>;