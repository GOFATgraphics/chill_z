import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Image as ImageIcon, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface StoryUploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoryCreated?: () => void;
}

export const StoryUploadSheet = ({ open, onOpenChange, onStoryCreated }: StoryUploadSheetProps) => {
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select an image (JPEG, PNG, WEBP) or video (MP4)",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File size must be less than 50MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handlePublish = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an image or video for your story",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("sparks")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sparks")
        .getPublicUrl(fileName);

      // Create story record
      const { error: insertError } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          content_url: publicUrl,
          content_type: selectedFile.type.startsWith("video") ? "video" : "image",
          caption: caption || null,
        });

      if (insertError) throw insertError;

      toast({
        title: "Story published! 🎉",
        description: "Your story is now live for 24 hours",
      });

      setCaption("");
      setSelectedFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
      onStoryCreated?.();
    } catch (error: any) {
      console.error("Error publishing story:", error);
      toast({
        title: "Failed to publish story",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle>Create Story</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          {/* Preview Area */}
          <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden max-h-[60vh] mx-auto w-full max-w-sm">
            {previewUrl ? (
              <>
                {selectedFile?.type.startsWith("video") ? (
                  <video src={previewUrl} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
                
                {/* Send Arrow Button */}
                <button
                  onClick={handlePublish}
                  disabled={uploading}
                  className="absolute bottom-4 right-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-full p-4 shadow-lg transition-all hover:scale-110 disabled:hover:scale-100"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Camera className="h-12 w-12" />
                <p>Select a photo or video</p>
              </div>
            )}
          </div>

          {/* File Selection */}
          {!previewUrl && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <label className="cursor-pointer">
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo/Video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <label className="cursor-pointer">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choose from Gallery
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          )}

          {/* Caption */}
          {previewUrl && (
            <Textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="resize-none"
              rows={2}
            />
          )}

          {/* Actions */}
          {previewUrl && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
              className="w-full"
            >
              Change Media
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
