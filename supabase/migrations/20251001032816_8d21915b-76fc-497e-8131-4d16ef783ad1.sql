-- Add rewards column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rewards DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Create function to award points and notify user
CREATE OR REPLACE FUNCTION public.award_post_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  points DECIMAL(10,2);
  reward_type TEXT;
BEGIN
  -- Determine points based on post type
  IF NEW.is_spark THEN
    points := 1.0;
    reward_type := 'Spark';
  ELSE
    points := 0.5;
    reward_type := 'Post';
  END IF;

  -- Update user's rewards
  UPDATE public.profiles
  SET rewards = rewards + points
  WHERE user_id = NEW.user_id;

  -- Create notification
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    post_id
  ) VALUES (
    NEW.user_id,
    'reward',
    'Reward Earned! 🎉',
    'You earned ' || points || ' points for creating a ' || reward_type || '!',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- Create trigger to award points when post is created
DROP TRIGGER IF EXISTS award_points_on_post ON public.posts;
CREATE TRIGGER award_points_on_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.award_post_points();