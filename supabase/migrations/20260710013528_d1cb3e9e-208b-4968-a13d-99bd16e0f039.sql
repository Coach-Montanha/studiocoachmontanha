
CREATE POLICY "exercise-media authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exercise-media');

CREATE POLICY "exercise-media upload own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "exercise-media update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "exercise-media delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
