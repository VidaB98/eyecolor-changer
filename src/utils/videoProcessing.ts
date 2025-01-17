import { FaceMesh } from "@mediapipe/face_mesh";
import { toast } from "@/hooks/use-toast";

export const isEyeOpen = (landmarks: any, eyePoints: number[]) => {
  const topY = landmarks[eyePoints[0]].y;
  const bottomY = landmarks[eyePoints[1]].y;
  const eyeHeight = Math.abs(topY - bottomY);
  return eyeHeight;
};

export const drawIris = (
  irisCtx: CanvasRenderingContext2D,
  centerPoint: number,
  boundaryPoints: number[],
  openRatio: number,
  landmarks: any,
  canvas: HTMLCanvasElement,
  selectedColor: string
) => {
  if (!irisCtx) return;
  
  // Calculate opacity based on how open the eye is
  // When openRatio is 0.015 or less, opacity will be 0
  // When openRatio is 0.03 or more, opacity will be 0.7
  // Between these values, opacity scales linearly
  const minRatio = 0.015;
  const maxRatio = 0.03;
  const maxOpacity = 0.7;
  
  let opacity = 0;
  if (openRatio > minRatio) {
    opacity = Math.min(
      ((openRatio - minRatio) / (maxRatio - minRatio)) * maxOpacity,
      maxOpacity
    );
  }
  
  // If eye is completely closed or opacity would be imperceptible, skip drawing
  if (opacity < 0.01) return;

  const centerX = landmarks[centerPoint].x * canvas.width;
  const centerY = landmarks[centerPoint].y * canvas.height;

  const radii = boundaryPoints.map(point => {
    const dx = landmarks[point].x * canvas.width - centerX;
    const dy = landmarks[point].y * canvas.height - centerY;
    return Math.hypot(dx, dy);
  });
  const radius = (radii.reduce((a, b) => a + b, 0) / radii.length) * 0.85;

  irisCtx.globalAlpha = opacity;
  irisCtx.fillStyle = selectedColor;
  irisCtx.strokeStyle = selectedColor;
  irisCtx.beginPath();
  irisCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  irisCtx.fill();
};

export const processVideoFrame = async (
  faceMesh: FaceMesh | null,
  videoRef: HTMLVideoElement,
  canvasRef: HTMLCanvasElement,
  selectedColor: string
) => {
  if (!faceMesh || !videoRef) {
    console.error("Video or FaceMesh not initialized");
    return;
  }

  try {
    await faceMesh.send({ image: videoRef });
  } catch (error) {
    console.error("Error processing video:", error);
    toast({
      title: "Processing Error",
      description: "Failed to process the video frame. Please try again.",
      variant: "destructive",
    });
  }
};