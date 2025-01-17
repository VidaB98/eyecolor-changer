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
  if (openRatio < 0.005) return;

  const centerX = landmarks[centerPoint].x * canvas.width;
  const centerY = landmarks[centerPoint].y * canvas.height;

  const radii = boundaryPoints.map(point => {
    const dx = landmarks[point].x * canvas.width - centerX;
    const dy = landmarks[point].y * canvas.height - centerY;
    return Math.hypot(dx, dy);
  });
  const radius = (radii.reduce((a, b) => a + b, 0) / radii.length) * 0.85;

  // Set a fixed opacity of 0.7 (70%)
  irisCtx.globalAlpha = 0.7;
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