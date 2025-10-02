-- Create pinned_posts table
CREATE TABLE public.pinned_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.pinned_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Pinned posts are viewable by everyone"
ON public.pinned_posts
FOR SELECT
USING (true);

CREATE POLICY "Users can pin posts"
ON public.pinned_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unpin their own posts"
ON public.pinned_posts
FOR DELETE
USING (auth.uid() = user_id);