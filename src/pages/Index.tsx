import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as F from "@mediapipe/face_mesh";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const predefinedColors = [
  { name: "Purple", value: "#9b87f5" },
  { name: "Blue", value: "#0EA5E9" },
  { name: "Green", value: "#22c55e" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink", value: "#D946EF" },
  { name: "Brown", value: "#8B4513" },
  { name: "Gray", value: "#8E9196" },
  { name: "Amber", value: "#FEC6A1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Sky Blue", value: "#33C3F0" },
  { name: "Yellow", value: "#FACC15" },
  { name: "Black", value: "#000000" },
];

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(predefinedColors[0].value);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const faceMeshRef = useRef<F.FaceMesh | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initFaceMesh = async () => {
      if (typeof window === 'undefined') return;
      
      faceMeshRef.current = new F.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        },
      });

      await faceMeshRef.current.initialize();

      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMeshRef.current.onResults(onResults);
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

        // These points specifically target the iris
        const leftIrisPoints = [474, 475, 476, 477].map(
          (index) => landmarks[index]
        );

        const rightIrisPoints = [469, 470, 471, 472].map(
          (index) => landmarks[index]
        );

        // Set up the drawing style for iris only
        ctx.fillStyle = selectedColor;
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.6; // Increased opacity for more vibrant but natural look

        const getIrisCenter = (points: any[]) => {
          const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
          const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
          return { x, y };
        };

        const getIrisRadius = (
          points: any[],
          center: { x: number; y: number }
        ) => {
          // Slightly reduce the radius to ensure we only color the iris
          return Math.max(
            ...points.map((p) =>
              Math.sqrt(
                Math.pow((p.x - center.x) * canvas.width, 2) +
                  Math.pow((p.y - center.y) * canvas.height, 2)
              )
            )
          ) * 0.85; // Reduce radius by 15% to focus on iris
        };

        if (leftEyeOpen) {
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
        }

        if (rightEyeOpen) {
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