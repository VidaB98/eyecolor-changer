import { Label } from "@/components/ui/label";

interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  outputVideoRef: React.RefObject<HTMLVideoElement>;
}

export const VideoPreview = ({ videoRef, outputVideoRef }: VideoPreviewProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Original Video</Label>
          <video
            ref={videoRef}
            controls
            className="w-full rounded-lg"
            playsInline
          />
        </div>
        <div className="space-y-2">
          <Label>Processed Video</Label>
          <video
            ref={outputVideoRef}
            controls
            className="w-full rounded-lg"
            playsInline
            autoPlay
            muted
          />
        </div>
      </div>
    </div>
  );
};