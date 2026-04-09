-- =============================================================================
-- CrewBooks — Migration 003: Business Logos Storage Bucket
-- =============================================================================

-- Create business-logos bucket (public — logos are displayed on invoices)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own business folder
DROP POLICY IF EXISTS "business_logos_insert" ON storage.objects;
CREATE POLICY "business_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Allow authenticated users to update (upsert) their logo
DROP POLICY IF EXISTS "business_logos_update" ON storage.objects;
CREATE POLICY "business_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Public read (logos shown on PDF invoices)
DROP POLICY IF EXISTS "business_logos_select" ON storage.objects;
CREATE POLICY "business_logos_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'business-logos');

-- Owner can delete their logo
DROP POLICY IF EXISTS "business_logos_delete" ON storage.objects;
CREATE POLICY "business_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );
