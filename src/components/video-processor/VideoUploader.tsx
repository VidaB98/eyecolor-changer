import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoUploaderProps {
  onVideoUpload: (videoUrl: string) => void;
}

export const VideoUploader = ({ onVideoUpload }: VideoUploaderProps) => {
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file",
        variant: "destructive"
      });
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    onVideoUpload(videoUrl);
  };

  return (
    <div>
      <Label htmlFor="video-upload">Upload Video</Label>
      <div className="mt-2">
        <Input
          id="video-upload"
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => document.getElementById("video-upload")?.click()}
          className="w-full"
        >
          <Upload className="mr-2" />
          Choose Video
        </Button>
      </div>
    </div>
  );
};