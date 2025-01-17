import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VideoProcessor } from "@/components/VideoProcessor";
import { VideoDownloader } from "@/components/VideoDownloader";

const predefinedColors = [
  { name: "Brown", value: "#8B4513" },
];

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(predefinedColors[0].value);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

    setIsProcessing(true);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (outputVideoRef.current) {
      outputVideoRef.current.srcObject = null;
    }

    const videoUrl = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
      videoRef.current.onloadeddata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      };
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Change eye color to brown</h1>

        <div className="space-y-6">
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
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => {
                if (videoRef.current && videoRef.current.paused) {
                  videoRef.current.play().catch(console.error);
                }
              }}
              disabled={isProcessing || !videoRef.current?.src}
              className="flex-1"
            >
              {isProcessing ? "Processing..." : "Change Eye Color"}
            </Button>
            
            <VideoDownloader
              videoRef={videoRef}
              outputVideoRef={outputVideoRef}
              mediaStreamRef={mediaStreamRef}
            />
          </div>
        </div>
      </Card>

      <VideoProcessor
        videoRef={videoRef}
        outputVideoRef={outputVideoRef}
        canvasRef={canvasRef}
        selectedColor={selectedColor}
        setIsProcessing={setIsProcessing}
        mediaStreamRef={mediaStreamRef}
      />
    </div>
  );
};

export default Index;