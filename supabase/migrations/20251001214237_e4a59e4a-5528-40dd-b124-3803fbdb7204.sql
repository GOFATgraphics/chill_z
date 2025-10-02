-- Create reposts table
CREATE TABLE public.reposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Reposts are viewable by everyone" 
ON public.reposts 
FOR SELECT 
USING (true);

CREATE POLICY "Users can repost" 
ON public.reposts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unrepost" 
ON public.reposts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_reposts_post_id ON public.reposts(post_id);
CREATE INDEX idx_reposts_user_id ON public.reposts(user_id);