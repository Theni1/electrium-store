-- Applied 2026-09-01. Captures the live database changes that were previously
-- made by hand: the signup trigger fix, the is_admin flag, and locking down the
-- bikes catalog.
--
-- Run order matters: customers.is_admin must exist before is_admin() compiles.

-- ---------------------------------------------------------------------------
-- 1. Signup trigger
-- ---------------------------------------------------------------------------
-- The trigger runs on GoTrue's connection (supabase_auth_admin), whose
-- search_path excludes public, so an unqualified table name fails to resolve
-- and the whole signup transaction aborts with a 500.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customers (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

REVOKE EXECUTE ON FUNCTION public.handle_new_customer() FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Admin flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- RLS is row-level and cannot restrict which columns a user writes, and the
-- existing "Users can update own customer data" policy lets a user write their
-- own row. Column-level grants are what keep is_admin out of reach. The listed
-- columns are exactly what app/action/profile.tsx upserts.
REVOKE INSERT, UPDATE ON public.customers FROM anon, authenticated;

GRANT INSERT (id, first_name, last_name, email, phone, address),
      UPDATE (id, first_name, last_name, email, phone, address)
  ON public.customers TO authenticated;

-- Promotion is deliberately manual, run by the database owner:
--   UPDATE customers SET is_admin = true WHERE email = '...';

-- ---------------------------------------------------------------------------
-- 3. Policy helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so evaluating it inside a policy does not re-enter RLS on
-- customers.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT c.is_admin FROM public.customers c WHERE c.id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- ---------------------------------------------------------------------------
-- 4. Lock down the catalog
-- ---------------------------------------------------------------------------
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bikes" ON public.bikes;
CREATE POLICY "Anyone can view bikes" ON public.bikes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert bikes" ON public.bikes;
CREATE POLICY "Admins can insert bikes" ON public.bikes
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update bikes" ON public.bikes;
CREATE POLICY "Admins can update bikes" ON public.bikes
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete bikes" ON public.bikes;
CREATE POLICY "Admins can delete bikes" ON public.bikes
  FOR DELETE USING (public.is_admin());

-- Anonymous requests get no write grants at all, so they are stopped before
-- policies are consulted. TRUNCATE is revoked from both roles because it is
-- not subject to RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bikes FROM anon;
REVOKE TRUNCATE ON public.bikes FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5. Stock decrement
-- ---------------------------------------------------------------------------
-- Checkout must decrement stock without granting shoppers write access to the
-- catalog, so the write happens inside a definer function. Called from
-- app/api/payment/route.ts.
CREATE OR REPLACE FUNCTION public.decrement_bike_stock(p_bike_id integer, p_quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  UPDATE public.bikes
     SET amount_stocked = amount_stocked - p_quantity
   WHERE bike_id = p_bike_id
  RETURNING amount_stocked INTO new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bike % not found', p_bike_id;
  END IF;

  RETURN new_stock;
END;
$$;

-- Supabase's default privileges grant EXECUTE to anon/authenticated explicitly,
-- so REVOKE ... FROM PUBLIC does not remove it. Revoke by role.
REVOKE EXECUTE ON FUNCTION public.decrement_bike_stock(integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_bike_stock(integer, integer) TO authenticated;
