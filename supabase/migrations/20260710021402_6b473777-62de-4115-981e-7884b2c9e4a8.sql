
-- Announcements: replace broad authenticated read with owner + linked students
DROP POLICY IF EXISTS "Authenticated read announcement images" ON storage.objects;

CREATE POLICY "Announcements: owner or linked student can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'announcements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.account_user_id = auth.uid()
        AND s.user_id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.pt_students p
      WHERE p.account_user_id = auth.uid()
        AND p.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Exercise media: replace broad authenticated read with owner + linked PT students
DROP POLICY IF EXISTS "exercise-media authenticated read" ON storage.objects;

CREATE POLICY "exercise-media: owner or linked PT student can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exercise-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.pt_students p
      WHERE p.account_user_id = auth.uid()
        AND p.user_id::text = (storage.foldername(name))[1]
    )
  )
);
