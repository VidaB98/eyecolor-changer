import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as F from "@mediapipe/face_mesh";
import { VideoUploader } from "@/components/video/VideoUploader";
import { ColorPicker } from "@/components/video/ColorPicker";
import { VideoPreview } from "@/components/video/VideoPreview";
import { isEyeOpen, getIrisCenter, getIrisRadius } from "@/utils/faceMeshUtils";

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
  const [selectedColor, setSelectedColor] = useState<string>(
    predefinedColors[0].value
  );
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
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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

        ctx.fillStyle = selectedColor;
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.6;

        if (leftEyeOpen) {
          const leftCenter = getIrisCenter(leftIrisPoints);
          const leftRadius = getIrisRadius(leftIrisPoints, leftCenter, canvas.width, canvas.height);
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
          const rightRadius = getIrisRadius(rightIrisPoints, rightCenter, canvas.width, canvas.height);
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
          processVideo();
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
          <VideoUploader onFileUpload={handleFileUpload} />
          <ColorPicker
            selectedColor={selectedColor}
            predefinedColors={predefinedColors}
            onColorChange={handleColorChange}
          />
          <VideoPreview
            videoRef={videoRef}
            outputVideoRef={outputVideoRef}
          />
          <canvas ref={canvasRef} className="hidden" />

          <Button
            onClick={() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current
                  .play()
                  .then(() => {
                    processVideo();
                  })
                  .catch(console.error);
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
