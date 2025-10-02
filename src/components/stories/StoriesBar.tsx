import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoryUploadSheet } from "./StoryUploadSheet";
import { StoryViewer } from "./StoryViewer";

interface StoryGroup {
  user_id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  verified: boolean;
  stories: Array<{
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
  }>;
}

export const StoriesBar = () => {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedStories, setSelectedStories] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadCurrentUser();
    loadStories();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("stories_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
        },
        () => {
          loadStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadStories = async () => {
    const { data, error } = await supabase
      .from("stories")
      .select(`
        id,
        user_id,
        content_url,
        content_type,
        caption,
        created_at,
        profiles!stories_user_id_fkey (
          user_id,
          display_name,
          handle,
          avatar_url,
          verified
        )
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading stories:", error);
      return;
    }

    // Group stories by user
    const grouped = data.reduce((acc: Record<string, StoryGroup>, story: any) => {
      const userId = story.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          display_name: story.profiles.display_name,
          handle: story.profiles.handle,
          avatar_url: story.profiles.avatar_url,
          verified: story.profiles.verified,
          stories: [],
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    setStoryGroups(Object.values(grouped));
  };

  const handleStoryClick = (group: StoryGroup) => {
    setSelectedStories(group.stories);
    setSelectedIndex(0);
    setViewerOpen(true);
  };

  const currentUserStories = storyGroups.find(g => g.user_id === currentUser?.id);
  const otherUserStories = storyGroups.filter(g => g.user_id !== currentUser?.id);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
        {/* Current User's Story */}
        {currentUserStories ? (
          <button
            onClick={() => handleStoryClick(currentUserStories)}
            className="flex flex-col items-center gap-2 min-w-[72px]"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-0.5">
                <div className="bg-background rounded-full p-0.5">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={currentUserStories.avatar_url || ""} />
                    <AvatarFallback>
                      {currentUserStories.display_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUpload(true);
                }}
                className="absolute bottom-0 right-0 bg-primary rounded-full p-1 ring-2 ring-background"
              >
                <Plus className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
            <span className="text-xs text-center truncate w-full">Your Story</span>
          </button>
        ) : (
          <button
            onClick={() => setShowUpload(true)}
            className="flex flex-col items-center gap-2 min-w-[72px]"
          >
            <div className="relative">
              <div className="relative ring-2 ring-border rounded-full p-0.5">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback>
                    {currentUser?.user_metadata?.full_name?.[0] || currentUser?.email?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-1 ring-2 ring-background">
                <Plus className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <span className="text-xs text-center">Your Story</span>
          </button>
        )}

        {/* Other Users' Stories */}
        {otherUserStories.map((group) => (
          <button
            key={group.user_id}
            onClick={() => handleStoryClick(group)}
            className="flex flex-col items-center gap-2 min-w-[72px]"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-0.5">
                <div className="bg-background rounded-full p-0.5">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={group.avatar_url || ""} />
                    <AvatarFallback>{group.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
            <span className="text-xs text-center truncate w-full">{group.display_name}</span>
          </button>
        ))}
      </div>

      <StoryUploadSheet
        open={showUpload}
        onOpenChange={setShowUpload}
        onStoryCreated={loadStories}
      />

      {selectedStories.length > 0 && (
        <StoryViewer
          stories={selectedStories}
          initialIndex={selectedIndex}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          onStoryDeleted={loadStories}
        />
      )}
    </>
  );
};
