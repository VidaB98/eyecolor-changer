import { useState } from "react";
import { Card } from "@/components/ui/card";
import { VideoUploader } from "@/components/video-processor/VideoUploader";
import { ColorPicker } from "@/components/video-processor/ColorPicker";
import { VideoProcessor } from "@/components/video-processor/VideoProcessor";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI Eye Color Changer</h1>

        <div className="space-y-6">
          <VideoUploader onVideoUpload={setVideoUrl} />
          
          <ColorPicker
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
          />

          <VideoProcessor
            videoUrl={videoUrl}
            selectedColor={selectedColor}
            onProcessingStateChange={setIsProcessing}
          />

          <Button
            onClick={() => setIsProcessing(true)}
            disabled={isProcessing || !videoUrl}
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