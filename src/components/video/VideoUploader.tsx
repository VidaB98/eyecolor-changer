import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const VideoUploader = ({ onFileUpload }: VideoUploaderProps) => {
  const { toast } = useToast();

  return (
    <div>
      <Label htmlFor="video-upload">Upload Video</Label>
      <div className="mt-2">
        <Input
          id="video-upload"
          type="file"
          accept="video/*"
          onChange={onFileUpload}
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