import { useEffect, useRef } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

interface VideoProcessorProps {
  videoUrl: string | null;
  selectedColor: string;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

export const VideoProcessor = ({ 
  videoUrl, 
  selectedColor,
  onProcessingStateChange 
}: VideoProcessorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);

  useEffect(() => {
    const initFaceMesh = async () => {
      const faceMesh = new FaceMesh({
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
        const leftIrisPoints = [474, 475, 476, 477].map(
          (index) => landmarks[index]
        );

        const rightIrisPoints = [469, 470, 471, 472].map(
          (index) => landmarks[index]
        );

        ctx.fillStyle = selectedColor;
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.6;

        // Calculate iris centers and radii
        const getIrisCenter = (points: any[]) => {
          const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
          const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
          return { x, y };
        };

        const getIrisRadius = (
          points: any[],
          center: { x: number; y: number }
        ) => {
          return Math.max(
            ...points.map((p) =>
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

    onProcessingStateChange(true);
    try {
      await faceMeshRef.current.send({ image: videoRef.current });
      if (videoRef.current.paused || videoRef.current.ended) {
        onProcessingStateChange(false);
        return;
      }
      requestAnimationFrame(processVideo);
    } catch (error) {
      console.error("Error processing video:", error);
      onProcessingStateChange(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
    }
  }, [videoUrl]);

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        controls
        className="w-full rounded-lg"
        playsInline
        onPlay={() => processVideo()}
      />
      <canvas ref={canvasRef} className="w-full rounded-lg" />
    </div>
  );
};