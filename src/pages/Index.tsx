import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as faceMesh from "@mediapipe/face_mesh";

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
  const faceMeshRef = useRef<faceMesh.FaceMesh | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initFaceMesh = async () => {
      if (typeof window === 'undefined') return;
      
      const faceMeshInstance = new faceMesh.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        },
      });

      await faceMeshInstance.initialize();

      faceMeshInstance.setOptions({
        maxNumFaces: 5, // Increased from 1 to detect multiple faces
        refineLandmarks: true,
        minDetectionConfidence: 0.2, // Lowered from 0.5 for better distance detection
        minTrackingConfidence: 0.2, // Lowered from 0.5 for better tracking
      });

      faceMeshInstance.onResults(onResults);
      faceMeshRef.current = faceMeshInstance;
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
    return eyeHeight > 0.015; // Lowered threshold for better detection at angles
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

        // Iris landmarks for more precise coloring
        const leftIrisPoints = [
          474, 475, 476, 477, // Top, right, bottom, left points of left iris
          469, 470, 471, 472  // Additional iris points
        ];
        const rightIrisPoints = [
          469, 470, 471, 472, // Top, right, bottom, left points of right iris
          474, 475, 476, 477  // Additional iris points
        ];

        ctx.fillStyle = selectedColor;
        ctx.strokeStyle = selectedColor;
        ctx.globalCompositeOperation = "soft-light";
        ctx.globalAlpha = 0.7; // Adjusted opacity to 70%

        const drawIris = (points: number[], isOpen: boolean) => {
          if (!isOpen) return;

          // Calculate iris center
          const irisPoints = points.map(index => ({
            x: landmarks[index].x * canvas.width,
            y: landmarks[index].y * canvas.height
          }));

          const center = {
            x: irisPoints.reduce((sum, p) => sum + p.x, 0) / irisPoints.length,
            y: irisPoints.reduce((sum, p) => sum + p.y, 0) / irisPoints.length
          };

          // Calculate average radius from center to iris points
          const radius = irisPoints.reduce((sum, p) => 
            sum + Math.sqrt(
              Math.pow(p.x - center.x, 2) + 
              Math.pow(p.y - center.y, 2)
            ), 0) / irisPoints.length;

          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
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

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Change your eye color to brown</h1>

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
            disabled={isProcessing || !videoRef.current?.src}
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