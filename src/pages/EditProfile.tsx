import { useState, useEffect } from "react";
import { ArrowLeft, Camera, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


export const EditProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    display_name: "",
    handle: "",
    bio: "",
    location: "",
    avatar_url: "",
    cover_url: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          display_name: data.display_name || "",
          handle: data.handle || "",
          bio: data.bio || "",
          location: data.location || "",
          avatar_url: data.avatar_url || "",
          cover_url: data.cover_url || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    }
  };

  const uploadImage = async (file: File, bucket: "avatars" | "covers") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file, "avatars");
      setProfile({ ...profile, avatar_url: url });
      toast({
        title: "Success",
        description: "Profile picture uploaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file, "covers");
      setProfile({ ...profile, cover_url: url });
      toast({
        title: "Success",
        description: "Cover photo uploaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload cover photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name,
          handle: profile.handle,
          bio: profile.bio,
          location: profile.location,
          avatar_url: profile.avatar_url,
          cover_url: profile.cover_url,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/profile")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Edit Profile</h1>
        <Button
          onClick={handleSubmit}
          disabled={loading || uploading}
          size="sm"
          className="rounded-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Cover Photo */}
        <div className="relative">
          <div className="w-full h-48 bg-muted relative overflow-hidden">
            {profile.cover_url ? (
              <img
                src={profile.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <label className="absolute top-4 right-4 cursor-pointer">
            <div className="bg-black/50 backdrop-blur-sm text-white rounded-full p-2">
              <Camera className="h-5 w-5" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {/* Avatar */}
          <div className="absolute -bottom-12 left-4">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full border-4 border-background object-cover"
                  width={96}
                  height={96}
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-background bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 cursor-pointer">
                <div className="bg-primary text-primary-foreground rounded-full p-2 border-2 border-background">
                  <Camera className="h-4 w-4" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="px-4 pt-16 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Display Name
            </label>
            <Input
              value={profile.display_name}
              onChange={(e) =>
                setProfile({ ...profile, display_name: e.target.value })
              }
              placeholder="Your display name"
              maxLength={50}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Handle
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                value={profile.handle}
                onChange={(e) =>
                  setProfile({ ...profile, handle: e.target.value })
                }
                placeholder="username"
                maxLength={30}
                className="pl-7"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Bio
            </label>
            <Textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell us about yourself"
              maxLength={200}
              rows={4}
              className="mt-1 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {profile.bio.length}/200
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Location
            </label>
            <Input
              value={profile.location}
              onChange={(e) =>
                setProfile({ ...profile, location: e.target.value })
              }
              placeholder="City, Country"
              maxLength={50}
              className="mt-1"
            />
          </div>
        </div>
      </form>
    </div>
  );
};
