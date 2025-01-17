import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download } from "lucide-react";

interface VideoControlsProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  isProcessing: boolean;
  hasVideo: boolean;
}

const VideoControls = ({ onFileUpload, onDownload, isProcessing, hasVideo }: VideoControlsProps) => {
  return (
    <div className="flex gap-4">
      <Input
        id="video-upload"
        type="file"
        accept="video/*"
        onChange={onFileUpload}
        className="hidden"
      />
      <Button
        onClick={() => document.getElementById("video-upload")?.click()}
        className="flex-1"
      >
        <Upload className="mr-2" />
        Choose Video
      </Button>
      
      <Button
        onClick={onDownload}
        disabled={!hasVideo}
        variant="outline"
        className="flex gap-2"
      >
        <Download className="size-4" />
        Download
      </Button>
    </div>
  );
};

export default VideoControls;