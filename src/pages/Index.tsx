import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FaceMesh } from "@mediapipe/face_mesh";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const predefinedColors = [
  { name: "Black", value: "#000000" },
  { name: "Brown", value: "#8B4513" },
  { name: "Blue", value: "#0EA5E9" },
  { name: "Green", value: "#22c55e" },
];

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(predefinedColors[0].value);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initFaceMesh = async () => {
      if (typeof window === 'undefined') return;
      
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        },
      });

      await faceMesh.initialize();

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

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const isEyeOpen = (landmarks: any, eyePoints: number[]) => {
    const topY = landmarks[eyePoints[0]].y;
    const bottomY = landmarks[eyePoints[1]].y;
    const eyeHeight = Math.abs(topY - bottomY);
    return eyeHeight > 0.02; // Empirically determined threshold
  };

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.multiFaceLandmarks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        const leftEyeVertical = [159, 145];
        const rightEyeVertical = [386, 374];
        
        const leftEyeOpen = isEyeOpen(landmarks, leftEyeVertical);
        const rightEyeOpen = isEyeOpen(landmarks, rightEyeVertical);

        const leftIrisPoints = [474, 475, 476, 477].map(
          (index) => landmarks[index]
        );

        const rightIrisPoints = [469, 470, 471, 472].map(
          (index) => landmarks[index]
        );

        // Set the selected color
        ctx.fillStyle = selectedColor;
        ctx.strokeStyle = selectedColor;

        // Apply specific settings for each color
        switch (selectedColor) {
          case "#000000": // Black
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 0.75;
            break;
          case "#8B4513": // Brown
            ctx.globalCompositeOperation = "multiply";
            ctx.globalAlpha = 0.8;
            break;
          case "#0EA5E9": // Blue
            ctx.globalCompositeOperation = "overlay";
            ctx.globalAlpha = 0.85;
            break;
          case "#22c55e": // Green
            ctx.globalCompositeOperation = "overlay";
            ctx.globalAlpha = 0.8;
            break;
          default:
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 0.75;
        }

        const drawIris = (points: any[], isOpen: boolean) => {
          if (!isOpen) return;
          
          const center = {
            x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length
          };

          const radius = Math.max(
            ...points.map((p) =>
              Math.sqrt(
                Math.pow((p.x - center.x) * canvas.width, 2) +
                Math.pow((p.y - center.y) * canvas.height, 2)
              )
            )
          ) * 0.85;

          ctx.beginPath();
          ctx.arc(
            center.x * canvas.width,
            center.y * canvas.height,
            radius,
            0,
            2 * Math.PI
          );
          ctx.fill();
        };

        if (leftEyeOpen) {
          drawIris(leftIrisPoints, leftEyeOpen);
        }

        if (rightEyeOpen) {
          drawIris(rightIrisPoints, rightEyeOpen);
        }
      }
    }

    ctx.restore();

    if (outputVideoRef.current) {
      if (!outputVideoRef.current.srcObject) {
        const stream = canvas.captureStream();
        mediaStreamRef.current = stream;
        outputVideoRef.current.srcObject = stream;
        outputVideoRef.current.play().catch(console.error);
      }
    }
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
      animationFrameRef.current = requestAnimationFrame(processVideo);
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

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (outputVideoRef.current) {
      outputVideoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const videoUrl = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
      videoRef.current.onloadeddata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
          processVideo(); // Start processing when video is loaded
        }
      };
    }
  };

  const handleColorChange = (value: string) => {
    setSelectedColor(value);
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
                onClick={() => document.getElementById("video-upload")?.click()}
                className="w-full"
              >
                <Upload className="mr-2" />
                Choose Video
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color-picker">Choose Eye Color</Label>
            <div className="flex gap-4">
              <Select onValueChange={handleColorChange} value={selectedColor}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedColor }}
                      />
                      {predefinedColors.find(c => c.value === selectedColor)?.name || 'Custom'}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {predefinedColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="color-picker"
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 w-20"
              />
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
                  onPlay={() => processVideo()}
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

          <Button
            onClick={() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().then(() => {
                  processVideo();
                }).catch(console.error);
              } else {
                processVideo();
              }
            }}
            disabled={isProcessing || !selectedColor || !videoRef.current?.src}
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
