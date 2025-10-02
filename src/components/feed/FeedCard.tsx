import { Heart, MessageCircle, Share, Bookmark, MoreHorizontal, Send, Trash2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ProfileLink } from "./ProfileLink";
import { VerifiedBadge } from "@/components/ui/verified-badge";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FeedPost {
  id: string;
  authorId: string;
  author: {
    username: string;
    displayName: string;
    avatar: string;
    verified?: boolean;
    isFollowing?: boolean;
  };
  content: {
    type: "image" | "video" | "text";
    url?: string;
    caption: string;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  timestamp: string;
  brandTag?: {
    name: string;
    offer?: string;
  };
}

interface FeedCardProps {
  post: FeedPost;
  onPostDeleted?: (postId: string) => void;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    handle: string;
    display_name: string;
    avatar_url: string;
    verified?: boolean;
  };
  liked?: boolean;
  likes_count?: number;
}

export const FeedCard = ({ post, onPostDeleted }: FeedCardProps) => {
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(post.author.isFollowing || false);
  const [likesCount, setLikesCount] = useState(post.engagement.likes);
  const [commentsCount, setCommentsCount] = useState(post.engagement.comments);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    loadEngagementData();
    
    // Subscribe to likes changes
    const likesChannel = supabase
      .channel(`post-${post.id}-likes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'likes',
        filter: `post_id=eq.${post.id}`
      }, () => {
        loadLikes();
      })
      .subscribe();

    // Subscribe to comments changes
    const commentsChannel = supabase
      .channel(`post-${post.id}-comments`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${post.id}`
      }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [post.id]);

  const loadEngagementData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    
    await Promise.all([loadLikes(), loadComments(), loadPinStatus()]);
  };

  const loadLikes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Count total likes
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    setLikesCount(count || 0);
    
    // Check if current user liked
    if (user) {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsLiked(!!data);
    }
  };

  const loadComments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        user_id,
        content,
        created_at,
        profiles!comments_user_id_fkey (
          handle,
          display_name,
          avatar_url,
          verified
        )
      `)
      .eq('post_id', post.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Load likes for each comment
      const commentsWithLikes = await Promise.all(
        data.map(async (comment) => {
          const { count } = await supabase
            .from('comment_likes')
            .select('*', { count: 'exact', head: true })
            .eq('comment_id', comment.id);

          let liked = false;
          if (user) {
            const { data: likeData } = await supabase
              .from('comment_likes')
              .select('id')
              .eq('comment_id', comment.id)
              .eq('user_id', user.id)
              .maybeSingle();
            liked = !!likeData;
          }

          return {
            ...comment,
            likes_count: count || 0,
            liked,
          };
        })
      );

      setComments(commentsWithLikes as any);
      setCommentsCount(data.length);
    }
  };

  const loadPinStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('pinned_posts')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post.id)
      .maybeSingle();
    
    setIsPinned(!!data);
  };

  const handleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to like posts",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
      } else {
        // Like
        await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id });

        // Create notification if not liking own post
        if (user.id !== post.authorId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();

          await supabase
            .from('notifications')
            .insert({
              user_id: post.authorId,
              type: 'like',
              title: 'New Like',
              message: `${profile?.display_name || 'Someone'} liked your post`,
              actor_id: user.id,
              post_id: post.id
            });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive"
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to comment",
        variant: "destructive"
      });
      return;
    }

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          user_id: user.id,
          content: newComment.trim()
        });
      
      if (error) throw error;

      // Create notification if not commenting on own post
      if (user.id !== post.authorId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();

        await supabase
          .from('notifications')
          .insert({
            user_id: post.authorId,
            type: 'comment',
            title: 'New Comment',
            message: `${profile?.display_name || 'Someone'} commented on your post`,
            actor_id: user.id,
            post_id: post.id
          });
      }
      
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive"
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      
      toast({
        title: "Comment deleted",
        description: "Your comment has been removed"
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!currentUserId) {
      toast({
        title: "Not authenticated",
        description: "Please log in to like comments",
        variant: "destructive"
      });
      return;
    }

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    try {
      if (comment.liked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: currentUserId });
      }
      loadComments();
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleDeletePost = async () => {
    setDeleting(true);
    try {
      // Delete from storage if there's a content URL
      if (post.content.url) {
        const urlParts = post.content.url.split('/');
        const bucket = urlParts[urlParts.length - 3]; // 'posts' or 'sparks'
        const filePath = urlParts.slice(-2).join('/'); // 'user_id/filename'
        
        await supabase.storage
          .from(bucket)
          .remove([filePath]);
      }

      // Delete the post from database (this will cascade delete likes, comments, notifications)
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);
      
      if (error) throw error;
      
      toast({
        title: "Post deleted",
        description: "Your post has been removed"
      });

      // Notify parent component
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleTogglePin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to pin posts",
        variant: "destructive"
      });
      return;
    }

    setPinning(true);
    try {
      if (isPinned) {
        // Unpin
        await supabase
          .from('pinned_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
        
        setIsPinned(false);
        toast({
          title: "Post unpinned",
          description: "Post removed from your pinned collection"
        });
      } else {
        // Pin
        await supabase
          .from('pinned_posts')
          .insert({
            user_id: user.id,
            post_id: post.id
          });
        
        setIsPinned(true);
        toast({
          title: "Post pinned",
          description: "Post added to your pinned collection"
        });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin status",
        variant: "destructive"
      });
    } finally {
      setPinning(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <article className="feed-card animate-fade-in">
      {/* Author Header */}
      <div className="flex items-center justify-between p-4">
        <ProfileLink userId={post.authorId} className="flex items-center gap-3">
          <img
            src={post.author.avatar}
            alt={post.author.username}
            className="w-10 h-10 rounded-full object-cover"
            width={40}
            height={40}
            loading="eager"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">{post.author.displayName}</span>
              {post.author.verified && <VerifiedBadge />}
            </div>
            <span className="text-xs text-muted-foreground">@{post.author.username}</span>
          </div>
        </ProfileLink>
        
        <div className="flex items-center gap-2">
          {!isFollowing && currentUserId !== post.authorId && (
            <Button
              size="sm"
              onClick={() => setIsFollowing(true)}
              className="h-8 px-4 rounded-full text-xs font-medium"
            >
              Follow
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleTogglePin}
                disabled={pinning}
              >
                <Pin className="h-4 w-4 mr-2" />
                {isPinned ? 'Unpin' : 'Pin'} Post
              </DropdownMenuItem>
              {currentUserId === post.authorId && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      {post.content.url && (
        <div className="relative">
          {post.content.type === "image" ? (
            <img
              src={post.content.url}
              alt="Post content"
              className="w-full aspect-square object-cover"
              width={800}
              height={800}
              loading="lazy"
            />
          ) : post.content.type === "video" ? (
            <video
              src={post.content.url}
              className="w-full aspect-square object-cover"
              controls={false}
              playsInline
            />
          ) : null}
          
          {post.brandTag && (
            <div className="absolute top-3 left-3 brand-badge">
              <span>🎁 {post.brandTag.name}</span>
              {post.brandTag.offer && (
                <span className="ml-1 text-accent">• {post.brandTag.offer}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Engagement Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className="engagement-button"
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-destructive text-destructive' : ''}`} />
              <span className="text-sm font-medium">{formatNumber(likesCount)}</span>
            </button>
            
            <button 
              className="engagement-button"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-medium">{formatNumber(commentsCount)}</span>
            </button>
            
            <button className="engagement-button">
              <Share className="h-5 w-5" />
              <span className="text-sm font-medium">{formatNumber(post.engagement.shares)}</span>
            </button>
          </div>
          
          <button
            onClick={() => setIsSaved(!isSaved)}
            className="engagement-button"
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-foreground' : ''}`} />
          </button>
        </div>
        
        {/* Caption */}
        <p className="text-sm">
          <span className="font-semibold mr-2">@{post.author.username}</span>
          {post.content.caption}
        </p>
        
        <span className="text-xs text-muted-foreground mt-1 block">{post.timestamp}</span>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 border-t border-border pt-4">
            {/* Add Comment */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                disabled={submittingComment}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Comments List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <ProfileLink userId={comment.user_id}>
                      <img
                        src={comment.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`}
                        alt={comment.profiles.handle}
                        className="w-8 h-8 rounded-full object-cover"
                        width={32}
                        height={32}
                        loading="lazy"
                      />
                    </ProfileLink>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <ProfileLink userId={comment.user_id}>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-sm">
                              {comment.profiles.display_name}
                            </span>
                            {comment.profiles.verified && <VerifiedBadge size="sm" />}
                            <span className="text-xs text-muted-foreground ml-1">
                              @{comment.profiles.handle}
                            </span>
                          </div>
                        </ProfileLink>
                        {currentUserId === comment.user_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => toggleCommentLike(comment.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Heart 
                            className={`h-3 w-3 ${comment.liked ? 'fill-red-500 text-red-500' : ''}`}
                          />
                          <span>{comment.likes_count || 0}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
};
