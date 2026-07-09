
CREATE POLICY "Owners upload announcement images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update announcement images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete announcement images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'announcements' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated read announcement images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'announcements');
