import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FaceMesh } from "@mediapipe/face_mesh";

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
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;

  const handleDownload = () => {
    if (!canvasRef.current) return;

    // Create a temporary canvas to record the video
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Set canvas dimensions to match the video
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;

    // Draw the current frame
    tempCtx.drawImage(canvasRef.current, 0, 0);

    // Convert the canvas to a blob
    tempCanvas.toBlob((blob) => {
      if (!blob) {
        toast({
          title: "Error",
          description: "Failed to create video file",
          variant: "destructive",
        });
        return;
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'processed-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Video downloaded successfully",
      });
    }, 'video/mp4');
  };

  useEffect(() => {
    const initFaceMesh = async () => {
      if (typeof window === 'undefined') return;
      
      faceMeshRef.current = new FaceMesh({
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
    // Calculate vertical distance between top and bottom eye points
    const topY = landmarks[eyePoints[0]].y;
    const bottomY = landmarks[eyePoints[1]].y;
    const eyeHeight = Math.abs(topY - bottomY);
    
    // Threshold for determining if eye is open (adjusted for more accuracy)
    return eyeHeight > 0.018; // Increased threshold for more accurate detection
  };

  const onResults = (results: any) => {
    const currentTime = performance.now();
    const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
    
    if (timeSinceLastFrame < frameInterval) {
      return;
    }
    
    lastFrameTimeRef.current = currentTime;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.multiFaceLandmarks) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        // Eye state detection points
        const leftEyeVertical = [159, 145];  // Top and bottom points of left eye
        const rightEyeVertical = [386, 374]; // Top and bottom points of right eye
        
        const leftEyeOpen = isEyeOpen(landmarks, leftEyeVertical);
        const rightEyeOpen = isEyeOpen(landmarks, rightEyeVertical);

        const leftIrisCenter = 468;
        const rightIrisCenter = 473;
        const leftIrisBoundary = [469, 470, 471, 472];
        const rightIrisBoundary = [474, 475, 476, 477];

        ctx.fillStyle = selectedColor;
        ctx.strokeStyle = selectedColor;
        ctx.globalCompositeOperation = "soft-light";
        ctx.globalAlpha = 0.7;

        const drawIris = (centerPoint: number, boundaryPoints: number[], isOpen: boolean) => {
          if (!isOpen) return; // Skip drawing if eye is closed

          const centerX = landmarks[centerPoint].x * canvas.width;
          const centerY = landmarks[centerPoint].y * canvas.height;

          // Calculate average radius using boundary points
          const radii = boundaryPoints.map(point => {
            const dx = landmarks[point].x * canvas.width - centerX;
            const dy = landmarks[point].y * canvas.height - centerY;
            return Math.hypot(dx, dy);
          });
          const radius = radii.reduce((a, b) => a + b, 0) / radii.length;

          // Draw iris only when eye is open
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fill();
        };

        // Only draw iris if the respective eye is open
        if (leftEyeOpen) {
          drawIris(leftIrisCenter, leftIrisBoundary, leftEyeOpen);
        }

        if (rightEyeOpen) {
          drawIris(rightIrisCenter, rightIrisBoundary, rightEyeOpen);
        }
      }
    }

    ctx.restore();

    if (outputVideoRef.current) {
      if (!outputVideoRef.current.srcObject) {
        const stream = canvas.captureStream(targetFPS);
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

          <div className="flex gap-4">
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
              className="flex-1"
            >
              {isProcessing ? "Processing..." : "Change Eye Color"}
            </Button>
            
            <Button
              onClick={handleDownload}
              disabled={!outputVideoRef.current?.srcObject}
              variant="secondary"
              className="flex gap-2"
            >
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Index;

