-- Add is_spark column to posts table
ALTER TABLE public.posts ADD COLUMN is_spark BOOLEAN NOT NULL DEFAULT false;

-- Create sparks storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('sparks', 'sparks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sparks
CREATE POLICY "Spark videos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sparks');

CREATE POLICY "Users can upload their own sparks"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sparks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own sparks"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sparks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own sparks"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sparks' AND auth.uid()::text = (storage.foldername(name))[1]);