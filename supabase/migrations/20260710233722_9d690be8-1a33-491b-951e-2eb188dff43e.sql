
-- 1. Soft-delete columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.pt_students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.pt_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON public.students(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_students_deleted_at ON public.pt_students(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_payments_deleted_at ON public.pt_payments(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Split "manage all" super_admin policies so DELETE is NOT granted cross-tenant.
-- STUDENTS
DROP POLICY IF EXISTS "Super admin can manage all" ON public.students;
CREATE POLICY "Super admin can read all students" ON public.students
  FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert students" ON public.students
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can update students" ON public.students
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
-- (no super_admin DELETE policy: cross-tenant delete now blocked; owner-DELETE keeps working via existing "users manage own students" policy)

-- PAYMENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Super admin can manage all') THEN
    DROP POLICY "Super admin can manage all" ON public.payments;
  END IF;
END $$;
CREATE POLICY "Super admin can read all payments" ON public.payments
  FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert payments" ON public.payments
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can update payments" ON public.payments
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- PT_STUDENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pt_students' AND policyname='Super admin can manage all') THEN
    DROP POLICY "Super admin can manage all" ON public.pt_students;
  END IF;
END $$;
CREATE POLICY "Super admin can read all pt_students" ON public.pt_students
  FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert pt_students" ON public.pt_students
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can update pt_students" ON public.pt_students
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- PT_PAYMENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pt_payments' AND policyname='Super admin can manage all') THEN
    DROP POLICY "Super admin can manage all" ON public.pt_payments;
  END IF;
END $$;
CREATE POLICY "Super admin can read all pt_payments" ON public.pt_payments
  FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert pt_payments" ON public.pt_payments
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can update pt_payments" ON public.pt_payments
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. Restore helpers (super_admin only) for undelete
CREATE OR REPLACE FUNCTION public.restore_student(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.students SET deleted_at = NULL WHERE id = _id;
  UPDATE public.payments SET deleted_at = NULL WHERE student_id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.restore_payment(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.payments SET deleted_at = NULL WHERE id = _id;
END $$;
