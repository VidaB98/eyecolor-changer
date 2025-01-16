import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState("#00ff00");
  const [isProcessing, setIsProcessing] = useState(false);
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
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI Eye Color Changer</h1>
        
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
                onClick={() => document.getElementById('video-upload')?.click()}
                className="w-full"
              >
                <Upload className="mr-2" />
                Choose Video
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="color-picker">Choose Eye Color</Label>
            <Input
              id="color-picker"
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="h-12 w-full"
            />
          </div>

          <div className="space-y-4">
            <video
              ref={videoRef}
              controls
              className="w-full rounded-lg"
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
          </div>

          <Button
            onClick={() => {
              toast({
                title: "Coming Soon",
                description: "Eye color changing functionality will be implemented in the next update.",
              });
            }}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Change Eye Color"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Index;