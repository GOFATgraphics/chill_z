import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ProfileLink } from "@/components/feed/ProfileLink";

interface Story {
  id: string;
  user_id: string;
  content_url: string;
  content_type: string;
  caption: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    handle: string;
    avatar_url: string | null;
    verified: boolean;
  };
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoryDeleted?: () => void;
}

export const StoryViewer = ({ stories, initialIndex, open, onOpenChange, onStoryDeleted }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentStory && open) {
      loadStoryData();
    }
  }, [currentStory?.id, open]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadStoryData = async () => {
    if (!currentStory) return;

    // Load likes
    const { count } = await supabase
      .from("story_likes")
      .select("*", { count: "exact", head: true })
      .eq("story_id", currentStory.id);
    setLikesCount(count || 0);

    // Check if current user liked
    if (currentUser) {
      const { data } = await supabase
        .from("story_likes")
        .select("id")
        .eq("story_id", currentStory.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();
      setLiked(!!data);
    }

    // Load comments
    const { data: commentsData } = await supabase
      .from("story_comments")
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles!story_comments_user_id_fkey (
          display_name,
          handle,
          avatar_url,
          verified
        )
      `)
      .eq("story_id", currentStory.id)
      .order("created_at", { ascending: true });
    
    setComments(commentsData || []);
  };

  const handleLike = async () => {
    if (!currentUser || !currentStory) return;

    try {
      if (liked) {
        await supabase
          .from("story_likes")
          .delete()
          .eq("story_id", currentStory.id)
          .eq("user_id", currentUser.id);
        setLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await supabase
          .from("story_likes")
          .insert({
            story_id: currentStory.id,
            user_id: currentUser.id,
          });
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  const handleComment = async () => {
    if (!currentUser || !currentStory || !comment.trim()) return;

    try {
      const { error } = await supabase
        .from("story_comments")
        .insert({
          story_id: currentStory.id,
          user_id: currentUser.id,
          content: comment.trim(),
        });

      if (error) throw error;

      setComment("");
      loadStoryData();
      toast({ title: "Comment added!" });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !currentStory || currentStory.user_id !== currentUser.id) return;

    if (!confirm("Delete this story? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", currentStory.id);

      if (error) throw error;

      toast({ title: "Story deleted" });
      onOpenChange(false);
      onStoryDeleted?.();
    } catch (error: any) {
      console.error("Error deleting story:", error);
      toast({
        title: "Error",
        description: "Failed to delete story",
        variant: "destructive",
      });
    }
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onOpenChange(false);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!currentStory) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[100vh] p-0">
        <div className="relative h-full bg-black">
          {/* Story Content */}
          <div className="absolute inset-0">
            {currentStory.content_type === "video" ? (
              <video
                src={currentStory.content_url}
                className="w-full h-full object-contain"
                autoPlay
                loop
              />
            ) : (
              <img
                src={currentStory.content_url}
                alt="Story"
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Progress Bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2">
            {stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-white transition-all ${
                    idx === currentIndex ? "w-full" : idx < currentIndex ? "w-full" : "w-0"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 mt-3">
            <ProfileLink userId={currentStory.user_id} className="flex items-center gap-2">
              <Avatar className="h-10 w-10 ring-2 ring-white">
                <AvatarImage src={currentStory.profiles.avatar_url || ""} />
                <AvatarFallback>{currentStory.profiles.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1">
                <span className="text-white font-semibold">{currentStory.profiles.display_name}</span>
                {currentStory.profiles.verified && <VerifiedBadge size="sm" />}
              </div>
            </ProfileLink>
            <div className="flex gap-2">
              {currentUser?.id === currentStory.user_id && (
                <Button size="icon" variant="ghost" onClick={handleDelete}>
                  <Trash2 className="h-5 w-5 text-white" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none">
            {currentIndex > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={goToPrevious}
                className="pointer-events-auto bg-black/50 text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            <div className="flex-1" />
            {currentIndex < stories.length - 1 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={goToNext}
                className="pointer-events-auto bg-black/50 text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-20 left-0 right-0 px-4">
              <p className="text-white text-sm">{currentStory.caption}</p>
            </div>
          )}

          {/* Actions */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            <div className="flex items-center gap-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`text-white ${liked ? "text-red-500" : ""}`}
              >
                <Heart className={`h-6 w-6 ${liked ? "fill-current" : ""}`} />
              </Button>
              <span className="text-white text-sm">{likesCount}</span>
              <MessageCircle className="h-6 w-6 text-white" />
              <span className="text-white text-sm">{comments.length}</span>
            </div>

            {/* Comment Input */}
            <div className="flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                onKeyPress={(e) => e.key === "Enter" && handleComment()}
              />
              <Button onClick={handleComment} disabled={!comment.trim()}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
