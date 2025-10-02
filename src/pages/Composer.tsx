import { useState } from "react";
import { ArrowLeft, Camera, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Composer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") === "spark" ? "spark" : "post";
  
  const [postType, setPostType] = useState<"post" | "spark">(initialType);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (postType === "spark" && !isVideo) {
      toast({
        title: "Invalid file",
        description: "Sparks must be video files",
        variant: "destructive",
      });
      return;
    }

    if (postType === "post" && !isImage) {
      toast({
        title: "Invalid file",
        description: "Posts must be image files",
        variant: "destructive",
      });
      return;
    }

    // Check file size (50MB limit for videos, 10MB for images)
    const maxSize = postType === "spark" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `${postType === "spark" ? "Videos" : "Images"} must be under ${postType === "spark" ? "50MB" : "10MB"}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (!caption.trim() && !selectedFile) {
      toast({
        title: "Empty content",
        description: `Please add some content or ${postType === "spark" ? "a video" : "an image"}`,
        variant: "destructive",
      });
      return;
    }

    if (postType === "spark" && !selectedFile) {
      toast({
        title: "Video required",
        description: "Sparks must include a video",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "Please log in to post",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      let fileUrl = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const bucket = postType === "spark" ? "sparks" : "posts";

        console.log(`Uploading to bucket: ${bucket}, fileName: ${fileName}`);
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
        console.log("File uploaded successfully, URL:", fileUrl);
      }

      // Create post/spark
      console.log("Creating post with:", { user_id: user.id, content_type: postType === "spark" ? "video" : (fileUrl ? "image" : "text"), is_spark: postType === "spark" });
      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content_type: postType === "spark" ? "video" : (fileUrl ? "image" : "text"),
          content_url: fileUrl,
          caption: caption.trim(),
          is_spark: postType === "spark",
        })
        .select()
        .single();

      if (postError) {
        console.error("Database insert error:", postError);
        throw postError;
      }

      // Create self-notification for published post
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'post',
          title: 'Post Published',
          message: `Your ${postType === "spark" ? "spark" : "post"} has been published successfully!`,
          actor_id: user.id,
          post_id: newPost.id
        });

      toast({
        title: "Success",
        description: `Your ${postType} has been published!`,
      });

      navigate(postType === "spark" ? "/sparks" : "/home");
    } catch (error: any) {
      console.error("Error publishing:", error);
      const errorMessage = error?.message || `Failed to publish ${postType}`;
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} disabled={uploading}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-bold text-lg">Create {postType === "spark" ? "Spark" : "Post"}</h1>
        <Button 
          onClick={handlePublish}
          disabled={uploading || (!caption.trim() && !selectedFile)}
          className="text-sm font-semibold"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Type Selector */}
        <Tabs value={postType} onValueChange={(v) => setPostType(v as "post" | "spark")}>
          <TabsList className="w-full">
            <TabsTrigger value="post" className="flex-1">Post</TabsTrigger>
            <TabsTrigger value="spark" className="flex-1">Spark (Video)</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Media Upload */}
        <div>
          <h3 className="font-medium mb-3">
            {postType === "spark" ? "Add Video (Required)" : "Add Image (Optional)"}
          </h3>
          
          {previewUrl ? (
            <div className="relative">
              {postType === "spark" ? (
                <video 
                  src={previewUrl} 
                  controls
                  className="w-full aspect-[9/16] object-cover rounded-2xl max-w-sm mx-auto"
                />
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full aspect-square object-cover rounded-2xl"
                />
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl("");
                }}
                className="absolute top-2 right-2"
                disabled={uploading}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <div className="aspect-square bg-muted rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary transition-colors">
                  {postType === "spark" ? (
                    <>
                      <Video className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Record Video</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Take Photo</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept={postType === "spark" ? "video/*" : "image/*"}
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              
              <label className="cursor-pointer">
                <div className="aspect-square bg-muted rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary transition-colors">
                  {postType === "spark" ? (
                    <>
                      <Video className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Gallery</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Gallery</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept={postType === "spark" ? "video/*" : "image/*"}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>

        {/* Caption */}
        <div>
          <h3 className="font-medium mb-3">Caption</h3>
          <Textarea
            placeholder={postType === "spark" 
              ? "Describe your spark... Use #hashtags"
              : "Share what's on your mind... Use #hashtags and @mentions"
            }
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[120px] rounded-2xl border-border resize-none"
            maxLength={2200}
            disabled={uploading}
          />
          <div className="text-right text-xs text-muted-foreground mt-1">
            {caption.length}/2200
          </div>
        </div>

        {/* Publish Button */}
        <Button 
          onClick={handlePublish}
          className="w-full h-12 rounded-full text-base font-semibold"
          disabled={uploading || (!caption.trim() && !selectedFile)}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            postType === "spark" ? "Drop it! ⚡" : "Drop it! 🔥"
          )}
        </Button>
      </div>
    </div>
  );
};