import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerInputSchema,
  loginInputSchema,
  updateProfileInputSchema,
  productFiltersSchema,
  createProductInputSchema,
  updateProductInputSchema,
  createProductVariationInputSchema,
  updateProductVariationInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  createAddressInputSchema,
  updateAddressInputSchema,
  type AuthContext,
} from './schema';

// Import handlers
import { register } from './handlers/auth/register';
import { login } from './handlers/auth/login';
import { getProfile } from './handlers/auth/get_profile';
import { updateProfile } from './handlers/auth/update_profile';

import { getProducts } from './handlers/products/get_products';
import { getProductById } from './handlers/products/get_product_by_id';
import { createProduct } from './handlers/products/create_product';
import { updateProduct } from './handlers/products/update_product';
import { deleteProduct } from './handlers/products/delete_product';
import { createProductVariation } from './handlers/products/create_product_variation';
import { updateProductVariation } from './handlers/products/update_product_variation';

import { getCart } from './handlers/cart/get_cart';
import { addToCart } from './handlers/cart/add_to_cart';
import { updateCartItem } from './handlers/cart/update_cart_item';
import { removeFromCart } from './handlers/cart/remove_from_cart';
import { clearCart } from './handlers/cart/clear_cart';

import { createOrder } from './handlers/orders/create_order';
import { getOrders } from './handlers/orders/get_orders';
import { getOrderById } from './handlers/orders/get_order_by_id';
import { updateOrderStatus } from './handlers/orders/update_order_status';
import { getAllOrders } from './handlers/orders/get_all_orders';

import { getUserAddresses } from './handlers/addresses/get_user_addresses';
import { createAddress } from './handlers/addresses/create_address';
import { updateAddress } from './handlers/addresses/update_address';
import { deleteAddress } from './handlers/addresses/delete_address';

import { getAllUsers } from './handlers/admin/get_all_users';

const t = initTRPC.context<{ auth?: AuthContext }>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.auth.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
  }
  return next({ ctx });
});

const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(registerInputSchema)
      .mutation(({ input }) => register(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    getProfile: protectedProcedure
      .query(({ ctx }) => getProfile(ctx.auth)),
    
    updateProfile: protectedProcedure
      .input(updateProfileInputSchema)
      .mutation(({ input, ctx }) => updateProfile(input, ctx.auth)),
  }),

  // Product routes
  products: router({
    getProducts: publicProcedure
      .input(productFiltersSchema)
      .query(({ input }) => getProducts(input)),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getProductById(input)),
    
    create: adminProcedure
      .input(createProductInputSchema)
      .mutation(({ input, ctx }) => createProduct(input, ctx.auth)),
    
    update: adminProcedure
      .input(updateProductInputSchema)
      .mutation(({ input, ctx }) => updateProduct(input, ctx.auth)),
    
    delete: adminProcedure
      .input(z.number())
      .mutation(({ input, ctx }) => deleteProduct(input, ctx.auth)),
    
    createVariation: adminProcedure
      .input(createProductVariationInputSchema)
      .mutation(({ input, ctx }) => createProductVariation(input, ctx.auth)),
    
    updateVariation: adminProcedure
      .input(updateProductVariationInputSchema)
      .mutation(({ input, ctx }) => updateProductVariation(input, ctx.auth)),
  }),

  // Cart routes
  cart: router({
    get: protectedProcedure
      .query(({ ctx }) => getCart(ctx.auth)),
    
    add: protectedProcedure
      .input(addToCartInputSchema)
      .mutation(({ input, ctx }) => addToCart(input, ctx.auth)),
    
    updateItem: protectedProcedure
      .input(updateCartItemInputSchema)
      .mutation(({ input, ctx }) => updateCartItem(input, ctx.auth)),
    
    removeItem: protectedProcedure
      .input(z.number())
      .mutation(({ input, ctx }) => removeFromCart(input, ctx.auth)),
    
    clear: protectedProcedure
      .mutation(({ ctx }) => clearCart(ctx.auth)),
  }),

  // Order routes
  orders: router({
    create: protectedProcedure
      .input(createOrderInputSchema)
      .mutation(({ input, ctx }) => createOrder(input, ctx.auth)),
    
    getUserOrders: protectedProcedure
      .query(({ ctx }) => getOrders(ctx.auth)),
    
    getById: protectedProcedure
      .input(z.number())
      .query(({ input, ctx }) => getOrderById(input, ctx.auth)),
    
    updateStatus: adminProcedure
      .input(updateOrderStatusInputSchema)
      .mutation(({ input, ctx }) => updateOrderStatus(input, ctx.auth)),
    
    getAll: adminProcedure
      .query(({ ctx }) => getAllOrders(ctx.auth)),
  }),

  // Address routes
  addresses: router({
    getUserAddresses: protectedProcedure
      .query(({ ctx }) => getUserAddresses(ctx.auth)),
    
    create: protectedProcedure
      .input(createAddressInputSchema)
      .mutation(({ input, ctx }) => createAddress(input, ctx.auth)),
    
    update: protectedProcedure
      .input(updateAddressInputSchema)
      .mutation(({ input, ctx }) => updateAddress(input, ctx.auth)),
    
    delete: protectedProcedure
      .input(z.number())
      .mutation(({ input, ctx }) => deleteAddress(input, ctx.auth)),
  }),

  // Admin routes
  admin: router({
    getAllUsers: adminProcedure
      .query(({ ctx }) => getAllUsers(ctx.auth)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext({ req }) {
      // This is a placeholder context creation! Real implementation should:
      // 1. Extract JWT token from Authorization header
      // 2. Verify and decode the token
      // 3. Return auth context with user_id and role
      // 4. Handle token refresh if needed
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Placeholder auth logic - replace with actual JWT verification
        return {
          auth: {
            user_id: 1,
            role: 'customer' as const,
          } as AuthContext,
        };
      }
      
      return {};
    },
  });

  server.listen(port);
  console.log(`🚀 E-commerce TRPC server listening at port: ${port}`);
  console.log(`🛍️  Available routes:`);
  console.log(`   • Authentication: auth.register, auth.login, auth.getProfile, auth.updateProfile`);
  console.log(`   • Products: products.getProducts, products.getById, products.create, products.update, products.delete`);
  console.log(`   • Cart: cart.get, cart.add, cart.updateItem, cart.removeItem, cart.clear`);
  console.log(`   • Orders: orders.create, orders.getUserOrders, orders.getById, orders.updateStatus, orders.getAll`);
  console.log(`   • Addresses: addresses.getUserAddresses, addresses.create, addresses.update, addresses.delete`);
  console.log(`   • Admin: admin.getAllUsers`);
}

start();