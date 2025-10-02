-- Drop the old constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_content_type_check;

-- Add new constraint that includes video
ALTER TABLE posts ADD CONSTRAINT posts_content_type_check 
CHECK (content_type IN ('text', 'image', 'video'));