import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Facebook, Twitter, MessageCircle as WhatsApp, Link2, Instagram } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sparkId: string;
  caption: string;
  authorHandle: string;
}

export const ShareSheet = ({ open, onOpenChange, sparkId, caption, authorHandle }: ShareSheetProps) => {
  const shareUrl = `${window.location.origin}/sparks/${sparkId}`;
  const shareText = `Check out this spark by @${authorHandle}: ${caption}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const shareToTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const shareToWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      "_blank"
    );
  };

  const shareToInstagram = () => {
    // Instagram doesn't support direct web sharing, so we copy the link
    copyToClipboard();
    toast.info("Link copied! Open Instagram app to share");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto pb-8">
        <SheetHeader>
          <SheetTitle>Share Spark</SheetTitle>
        </SheetHeader>

        {/* Share Link */}
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Social Media Options */}
          <div className="grid grid-cols-4 gap-4 pt-4">
            <button
              onClick={shareToFacebook}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center">
                <Facebook className="h-6 w-6 text-white" fill="white" />
              </div>
              <span className="text-xs font-medium">Facebook</span>
            </button>

            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#1DA1F2] flex items-center justify-center">
                <Twitter className="h-6 w-6 text-white" fill="white" />
              </div>
              <span className="text-xs font-medium">Twitter</span>
            </button>

            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center">
                <WhatsApp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>

            <button
              onClick={shareToInstagram}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
                <Instagram className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-medium">Instagram</span>
            </button>
          </div>

          {/* Copy Link Button */}
          <Button
            onClick={copyToClipboard}
            variant="outline"
            className="w-full"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
