-- Fix: prevent students / PT students from reading their own temp_password
-- Replace the broad self-read SELECT policies with row filters that exclude the temp_password column,
-- by removing SELECT on temp_password when the reader is the linked student account.

-- We split the self-read into TWO permissive policies: one covering all NON-temp_password reads,
-- enforced with a restrictive policy that blocks any SELECT touching temp_password unless the caller
-- is the tenant owner. Since Postgres RLS is row-level (not column-level), we instead use a
-- security_invoker=off view for the self-read path and drop the direct self-read SELECT policies.

-- 1) Drop the offending self-read policies
DROP POLICY IF EXISTS "student reads own profile" ON public.students;
DROP POLICY IF EXISTS "PT student can view own row" ON public.pt_students;
DROP POLICY IF EXISTS "pt_students self read via account_user_id" ON public.pt_students;

-- 2) Create SECURITY DEFINER views (security_invoker=off) that expose every column
--    EXCEPT temp_password, filtered to the caller's linked student row.
CREATE OR REPLACE VIEW public.students_self
WITH (security_invoker = off) AS
SELECT
  id, user_id, name, email, phone, status, notes, created_at, updated_at,
  birth_date, account_user_id, attendance_offset, cpf, rg, start_date,
  address, postal_code, neighborhood, city, state, country, deleted_at
FROM public.students
WHERE account_user_id = auth.uid()
  AND deleted_at IS NULL;

CREATE OR REPLACE VIEW public.pt_students_self
WITH (security_invoker = off) AS
SELECT
  id, user_id, name, email, phone, birth_date, goal, health_notes, status,
  start_date, notes, created_at, updated_at, account_user_id, training_plan,
  deleted_at
FROM public.pt_students
WHERE account_user_id = auth.uid()
  AND deleted_at IS NULL;

-- 3) Grant read access on the views to authenticated users (RLS on base table is bypassed
--    because the views are SECURITY DEFINER / security_invoker=off, so the WHERE clause
--    inside the view is what limits the caller to their own row).
GRANT SELECT ON public.students_self TO authenticated;
GRANT SELECT ON public.pt_students_self TO authenticated;
