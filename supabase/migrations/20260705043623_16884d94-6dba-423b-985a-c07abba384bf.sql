
CREATE POLICY "Contracts: users can upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Contracts: users can read own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Contracts: users can update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Contracts: users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contracts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars: users can upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars: users can update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars: users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars: authenticated can read all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
