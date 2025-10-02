import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { VerifiedBadge } from "@/components/ui/verified-badge";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string;
    handle: string;
    verified?: boolean;
  };
  comment_likes: { user_id: string }[];
  _count?: { comment_likes: number };
}

interface CommentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  currentUserId: string;
}

export const CommentSheet = ({ open, onOpenChange, postId, currentUserId }: CommentSheetProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, postId]);

  const loadComments = async () => {
    console.log("Loading comments for post:", postId);
    try {
      // First get comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (commentsError) {
        console.error("Error loading comments:", commentsError);
        throw commentsError;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Get user profiles for each comment
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, handle, verified")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error loading profiles:", profilesError);
        throw profilesError;
      }

      // Get comment likes
      const commentIds = commentsData.map(c => c.id);
      const { data: likesData, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);

      if (likesError) {
        console.error("Error loading likes:", likesError);
      }

      // Combine the data
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const likesMap = new Map<string, { user_id: string }[]>();
      
      likesData?.forEach(like => {
        if (!likesMap.has(like.comment_id)) {
          likesMap.set(like.comment_id, []);
        }
        likesMap.get(like.comment_id)?.push({ user_id: like.user_id });
      });

      const enrichedComments = commentsData.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || {
          display_name: "Unknown User",
          avatar_url: "",
          handle: "unknown"
        },
        comment_likes: likesMap.get(comment.id) || []
      }));

      console.log("Loaded comments:", enrichedComments);
      setComments(enrichedComments as any);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      console.log("Adding comment:", { post_id: postId, user_id: currentUserId, content: newComment.trim() });
      
      const { error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) {
        console.error("Error inserting comment:", error);
        throw error;
      }

      setNewComment("");
      toast.success("Comment added!");
      await loadComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async (commentId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comment_likes")
          .insert({
            comment_id: commentId,
            user_id: currentUserId,
          });

        if (error) throw error;
      }

      loadComments();
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment) => {
              const isLiked = comment.comment_likes.some((like) => like.user_id === currentUserId);
              const likeCount = comment.comment_likes.length;

              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profiles.avatar_url} />
                    <AvatarFallback>{comment.profiles.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{comment.profiles.display_name}</span>
                      {comment.profiles.verified && <VerifiedBadge size="sm" />}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                    <button
                      onClick={() => handleToggleLike(comment.id, isLiked)}
                      className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Heart
                        className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
                      />
                      {likeCount > 0 && <span>{likeCount}</span>}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Comment Input */}
        <div className="border-t pt-4 flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px]"
          />
          <Button
            onClick={handleAddComment}
            disabled={loading || !newComment.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
