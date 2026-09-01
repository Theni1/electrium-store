# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Electrium Shop — an e-commerce storefront (Next.js App Router) for an electric bike company that supports both **buying and renting** bikes. It handles browsing/comparing products, cart, checkout with Stripe and PayPal, order history, a user dashboard (profile, orders, wishlist, billing, notifications), and an internal Kanban-style task board.

## Commands

```
npm i          # install deps (yarn.lock also present; npm is what's documented)
npm run dev    # start dev server (localhost:3000)
npm run build  # production build
npm run start  # run production build
```

There is no lint/test script defined in package.json. `@playwright/test` is a dependency but no test files or Playwright config exist yet — don't assume a test suite is runnable.

A `.env.local` is required (get it from the team) with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, and (for PayPal verification) `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, optionally `PAYPAL_API_BASE`.

## Architecture

**Stack**: Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres + Auth), Stripe & PayPal for payments, Resend/nodemailer for email, Zod for validation. Path alias `@/*` maps to repo root.

### Auth & Supabase clients
Three separate Supabase client constructors exist for different contexts — always use the matching one:
- [utils/supabase/client.ts](utils/supabase/client.ts) — browser/client components
- [utils/supabase/server.ts](utils/supabase/server.ts) — server components/route handlers (cookie-based session via `@supabase/ssr`)
- [utils/supabase/middleware.ts](utils/supabase/middleware.ts) — used by [middleware.ts](middleware.ts) to refresh sessions on every request

Auth mutations (`signup`, `login`, etc.) live in [app/action/auth.tsx](app/action/auth.tsx) as Next.js Server Actions (`"use server"`), validated with Zod schemas from [app/lib/definitions.ts](app/lib/definitions.ts). Profile mutations are in [app/action/profile.tsx](app/action/profile.tsx).

`middleware.ts` matches all routes except static assets, `login`, and `cart`, and delegates to `updateSession`.

### Data model (Supabase/Postgres)
Core tables (see [database_schema.sql](database_schema.sql)): `customers` (1:1 with `auth.users`, auto-created via trigger on signup), `bikes` (products — has both `rental_rate` and `sell_price`, since items can be rented or bought), `orders`, `order_items` (has `order_type`: `'rent'` or `'sell'`), `payments`. All tables use Row Level Security scoped to `auth.uid()`.

Additional/incremental schema files exist as separate migrations applied manually in the Supabase SQL editor rather than through a migration tool: [create_order_items_table.sql](create_order_items_table.sql), [tasks_schema.sql](tasks_schema.sql). There is no migration runner — schema changes are applied by hand (see [DATABASE_SETUP.md](DATABASE_SETUP.md)).

Note: `create_products_table.sql` (a `products` table) and the original `create_user_cart_items_table.sql` (keyed on `product_id`) were dropped from the live database — they were unwired scaffolding (0 rows, no app code ever queried `products`; the storefront uses `bikes` throughout). `user_cart_items` has been recreated keyed on `cart_session_id`/`bike_id`/`order_type` alongside a new `cart_sessions` table, as part of the sessionStorage→Supabase cart migration described below. These two .sql files are now stale/historical — do not reapply them.

Note: the tail end of `database_schema.sql` (the `user_cart_items` section) has corrupted/space-mangled text from a bad edit; treat `create_user_cart_items_table.sql` as the source of truth for that table instead.

### Cart (in-progress migration)
The cart is currently **client-only**: items live in `sessionStorage` (see `utils/useSessionStorage.tsx`, `app/products/[productId]/cartAdd.tsx`), read independently and redundantly by `app/cart/page.tsx` and `app/checkout/cart.tsx` — these two currently compute rental subtotals differently (a known bug). `/api/payment/route.ts` trusts the client-supplied `cart` array in the request body rather than any server-side source of truth; `user_cart_items` exists in the schema but is unused dead weight today.

This is being migrated to a Supabase-backed cart (`cart_sessions` + `user_cart_items` keyed on `cart_session_id`/`bike_id`/`order_type`, with the session id stored in a cookie) so cart state is server-authoritative — a prerequisite for an upcoming real-time multi-user "shared cart via QR code" feature (Supabase Realtime subscriptions on `user_cart_items`). See conversation history / commit history for current migration progress; don't assume the DB-backed cart is live until `/api/payment/route.ts` is confirmed to read from `user_cart_items` instead of the request body.

### Payments
[app/api/payment/route.ts](app/api/payment/route.ts) is the single order-creation endpoint. It requires an authenticated Supabase user, recomputes the expected total server-side from the cart (rejecting client-supplied totals that don't match), then verifies the payment before writing anything:
- **Stripe**: retrieves the PaymentIntent server-side and checks `status === "succeeded"`.
- **PayPal**: calls PayPal's OAuth + order-verification API directly (`getPayPalAccessToken` / `verifyPayPalOrder`), checking status, amount, and currency (`CAD`).

Only after verification does it insert into `orders` → `order_items` → `payments`, then decrement `bikes.amount_stocked` per item. Stripe intent creation is separate, in [app/api/stripe/create-payment-intent](app/api/stripe/create-payment-intent). PayPal capture verification also has its own route at [app/api/paypal/verify](app/api/paypal/verify).

### Route structure (`app/`)
- Storefront: `page.tsx` (home), `items/`, `products/[productId]/`, `rentals/`, `rentals/[id]/`
- Cart/checkout: `cart/`, `checkout/` (`cart.tsx`, `paymentOptions.tsx`, `shippingForm.tsx`)
- Auth flow: `login/`, `signup/`, `forgot-password/`, `reset-password/`, `email-verification/`, `auth/callback/`, `auth/confirm/`
- User dashboard: `dashboard/` (`profile/`, `orders/`, `billing/`, `wishlist/`, `settings/`, `notifications/`, `tasks/`) — each is its own page under the shared `dashboard/layout.tsx`
- API routes (`app/api/`): `payment/`, `stripe/create-payment-intent/`, `paypal/verify/`, `orders/[orderId]/`, `reviews/[productId]/`, `send-order-email/`, `analytics/`, `tasks/` + `tasks/claim/`

### Components
`components/` is organized by feature area: `shop/` (Navbar, Footer, ProductComparison, AboutUs, GoogleAd), `dashboard/` (AnalyticsCharts, QuickActions), `tasks/` (KanbanBoard, TaskCard — internal task tracker, backed by `tasks_schema.sql` and `app/api/tasks/`), `tutorial/` (Supabase starter boilerplate, largely vestigial from the template this project was bootstrapped from), and `ui/` (generic: LoadingSpinner, GlobalLoadingProvider, RouteProgress, SortButton).

### Notable conventions
- Stripe/PayPal SDKs are lazily imported inside route handlers (`await import("stripe")`) rather than at module top-level, guarding against missing env vars at build time.
- Server Actions (`"use server"` files in `app/action/`) are the primary mutation path for auth/profile; API routes under `app/api/` are used where a client needs to call an endpoint directly (payments, reviews, tasks) or where third-party webhooks/callbacks land.
