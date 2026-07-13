DROP POLICY IF EXISTS "Authenticated can read active announcements in window" ON public.announcements;

CREATE POLICY "Linked students read active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    active = true
    AND now() >= starts_at
    AND now() <= ends_at
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.account_user_id = auth.uid()
          AND s.user_id = announcements.user_id
          AND s.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.pt_students ps
        WHERE ps.account_user_id = auth.uid()
          AND ps.user_id = announcements.user_id
          AND ps.deleted_at IS NULL
      )
    )
  );
