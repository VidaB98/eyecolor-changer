import { useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isEyeOpen, drawIris } from "@/utils/video-processing";
import { useFaceMesh } from "@/hooks/use-face-mesh";

interface VideoProcessorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  outputVideoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  selectedColor: string;
  setIsProcessing: (value: boolean) => void;
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
}

export const VideoProcessor = ({
  videoRef,
  outputVideoRef,
  canvasRef,
  selectedColor,
  setIsProcessing,
  mediaStreamRef,
}: VideoProcessorProps) => {
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const { faceMeshRef } = useFaceMesh();
  const { toast } = useToast();
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  const onResults = (results: any) => {
    const currentTime = performance.now();
    const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
    
    if (timeSinceLastFrame < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(() => processVideo());
      return;
    }
    
    lastFrameTimeRef.current = currentTime;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.multiFaceLandmarks) {
      setIsProcessing(false);
      return;
    }

    const ctx = canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false
    });
    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0);

    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        const leftEyeVertical = [159, 145];  
        const rightEyeVertical = [386, 374]; 
        
        const leftEyeOpenRatio = isEyeOpen(landmarks, leftEyeVertical);
        const rightEyeOpenRatio = isEyeOpen(landmarks, rightEyeVertical);

        const leftIrisCenter = 468;
        const rightIrisCenter = 473;
        const leftIrisBoundary = [469, 470, 471, 472];
        const rightIrisBoundary = [474, 475, 476, 477];

        const irisCanvas = document.createElement('canvas');
        irisCanvas.width = canvas.width;
        irisCanvas.height = canvas.height;
        const irisCtx = irisCanvas.getContext('2d', { alpha: true });
        if (!irisCtx) return;

        drawIris(irisCtx, landmarks, leftIrisCenter, leftIrisBoundary, leftEyeOpenRatio, canvas, selectedColor);
        drawIris(irisCtx, landmarks, rightIrisCenter, rightIrisBoundary, rightEyeOpenRatio, canvas, selectedColor);

        ctx.globalCompositeOperation = "soft-light";
        ctx.drawImage(irisCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    if (outputVideoRef.current && !outputVideoRef.current.srcObject) {
      const stream = canvas.captureStream(targetFPS);
      mediaStreamRef.current = stream;
      outputVideoRef.current.srcObject = stream;
      outputVideoRef.current.play().catch(console.error);
    }

    if (videoRef.current && (videoRef.current.ended || videoRef.current.paused)) {
      setIsProcessing(false);
    } else {
      animationFrameRef.current = requestAnimationFrame(() => processVideo());
    }
  };

  const processVideo = async () => {
    if (!videoRef.current || !faceMeshRef.current) {
      setIsProcessing(false);
      return;
    }

    try {
      await faceMeshRef.current.send({ image: videoRef.current });
      if (videoRef.current.paused || videoRef.current.ended) {
        setIsProcessing(false);
        return;
      }
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

  useEffect(() => {
    if (faceMeshRef.current) {
      faceMeshRef.current.onResults(onResults);
    }
  }, [faceMeshRef.current]);

  return null;
};