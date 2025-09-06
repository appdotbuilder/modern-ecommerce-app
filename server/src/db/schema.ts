import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const productTypeEnum = pgEnum('product_type', ['perfume', 'shirt']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'unisex']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('customer'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: productTypeEnum('type').notNull(),
  gender: genderEnum('gender'), // Nullable for shirts, required for perfumes
  base_price: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  image_url: text('image_url'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Product variations table (for sizes, volumes, scents)
export const productVariationsTable = pgTable('product_variations', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  variation_type: text('variation_type').notNull(), // 'size', 'volume', 'scent'
  variation_value: text('variation_value').notNull(), // 'S', '50ml', 'Rose'
  price_adjustment: numeric('price_adjustment', { precision: 10, scale: 2 }).notNull().default('0.00'),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  is_available: boolean('is_available').notNull().default(true),
});

// Shopping cart table
export const cartTable = pgTable('cart', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cart_id: integer('cart_id').notNull().references(() => cartTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  variation_id: integer('variation_id').references(() => productVariationsTable.id),
  quantity: integer('quantity').notNull().default(1),
  custom_design_text: text('custom_design_text'), // For custom shirts
  custom_design_url: text('custom_design_url'), // For custom shirts
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  order_number: text('order_number').notNull().unique(),
  status: orderStatusEnum('status').notNull().default('pending'),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  shipping_address: text('shipping_address').notNull(),
  billing_address: text('billing_address').notNull(),
  payment_method: text('payment_method').notNull(),
  payment_status: text('payment_status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => ordersTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  variation_id: integer('variation_id').references(() => productVariationsTable.id),
  quantity: integer('quantity').notNull(),
  custom_design_text: text('custom_design_text'), // For custom shirts
  custom_design_url: text('custom_design_url'), // For custom shirts
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
});

// User addresses table
export const userAddressesTable = pgTable('user_addresses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: text('type').notNull(), // 'shipping', 'billing'
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  street_address: text('street_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postal_code: text('postal_code').notNull(),
  country: text('country').notNull(),
  phone: text('phone'),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many, one }) => ({
  cart: one(cartTable),
  orders: many(ordersTable),
  addresses: many(userAddressesTable),
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
  variations: many(productVariationsTable),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
}));

export const productVariationsRelations = relations(productVariationsTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [productVariationsTable.product_id],
    references: [productsTable.id],
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
}));

export const cartRelations = relations(cartTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [cartTable.user_id],
    references: [usersTable.id],
  }),
  items: many(cartItemsTable),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  cart: one(cartTable, {
    fields: [cartItemsTable.cart_id],
    references: [cartTable.id],
  }),
  product: one(productsTable, {
    fields: [cartItemsTable.product_id],
    references: [productsTable.id],
  }),
  variation: one(productVariationsTable, {
    fields: [cartItemsTable.variation_id],
    references: [productVariationsTable.id],
  }),
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id],
  }),
  items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id],
  }),
  variation: one(productVariationsTable, {
    fields: [orderItemsTable.variation_id],
    references: [productVariationsTable.id],
  }),
}));

export const userAddressesRelations = relations(userAddressesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userAddressesTable.user_id],
    references: [usersTable.id],
  }),
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  products: productsTable,
  productVariations: productVariationsTable,
  cart: cartTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  userAddresses: userAddressesTable,
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

export type ProductVariation = typeof productVariationsTable.$inferSelect;
export type NewProductVariation = typeof productVariationsTable.$inferInsert;

export type Cart = typeof cartTable.$inferSelect;
export type NewCart = typeof cartTable.$inferInsert;

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;

export type UserAddress = typeof userAddressesTable.$inferSelect;
export type NewUserAddress = typeof userAddressesTable.$inferInsert;