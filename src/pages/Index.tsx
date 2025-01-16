import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as FaceMeshModule from "@mediapipe/face_mesh";
import { drawConnectors } from "@mediapipe/drawing_utils";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState("#00ff00");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const faceMeshRef = useRef<FaceMeshModule.FaceMesh | null>(null);

  useEffect(() => {
    const initFaceMesh = async () => {
      const faceMesh = new FaceMeshModule.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;
    };

    initFaceMesh();
  }, []);

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.multiFaceLandmarks) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        // Define iris landmarks for more precise coloring
        const leftIrisPoints = [
          474, 475, 476, 477
        ].map(index => landmarks[index]);
        
        const rightIrisPoints = [
          469, 470, 471, 472
        ].map(index => landmarks[index]);

        ctx.fillStyle = selectedColor;
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.6;

        // Calculate iris centers and radii
        const getIrisCenter = (points: any[]) => {
          const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
          const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
          return { x, y };
        };

        const getIrisRadius = (points: any[], center: { x: number; y: number }) => {
          return Math.max(
            ...points.map(p => 
              Math.sqrt(
                Math.pow((p.x - center.x) * canvas.width, 2) +
                Math.pow((p.y - center.y) * canvas.height, 2)
              )
            )
          );
        };

        // Draw left iris
        const leftCenter = getIrisCenter(leftIrisPoints);
        const leftRadius = getIrisRadius(leftIrisPoints, leftCenter);
        ctx.beginPath();
        ctx.arc(
          leftCenter.x * canvas.width,
          leftCenter.y * canvas.height,
          leftRadius,
          0,
          2 * Math.PI
        );
        ctx.fill();

        // Draw right iris
        const rightCenter = getIrisCenter(rightIrisPoints);
        const rightRadius = getIrisRadius(rightIrisPoints, rightCenter);
        ctx.beginPath();
        ctx.arc(
          rightCenter.x * canvas.width,
          rightCenter.y * canvas.height,
          rightRadius,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }

    ctx.restore();
  };

  const processVideo = async () => {
    if (!videoRef.current || !faceMeshRef.current) return;

    setIsProcessing(true);
    try {
      await faceMeshRef.current.send({ image: videoRef.current });
      if (videoRef.current.paused || videoRef.current.ended) {
        setIsProcessing(false);
        return;
      }
      requestAnimationFrame(processVideo);
    } catch (error) {
      console.error("Error processing video:", error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to process video",
        variant: "destructive",
      });
    }
  };

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
              onPlay={() => processVideo()}
            />
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg"
            />
          </div>

          <Button
            onClick={() => processVideo()}
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