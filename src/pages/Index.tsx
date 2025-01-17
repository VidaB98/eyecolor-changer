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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const targetFPS = 30; // Reduced from 60 to ensure smoother processing
  const frameInterval = 1000 / targetFPS;

  const handleDownload = () => {
    if (!outputVideoRef.current || !mediaStreamRef.current || !videoRef.current) return;

    // Create AudioContext only if it doesn't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    // Create AudioSource only if it doesn't exist
    if (!audioSourceRef.current && audioContextRef.current) {
      audioSourceRef.current = audioContextRef.current.createMediaElementSource(videoRef.current);
    }

    const audioDestination = audioContextRef.current.createMediaStreamDestination();
    
    // Connect the audio source to both the destination and audio context destination
    if (audioSourceRef.current) {
      audioSourceRef.current.connect(audioDestination);
      audioSourceRef.current.connect(audioContextRef.current.destination);
    }

    const combinedStream = new MediaStream([
      ...mediaStreamRef.current.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks()
    ]);

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 8000000
    });
    
    const chunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'processed-video.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Video downloaded successfully with audio",
      });
    };

    mediaRecorder.start();
    
    // Reset video to beginning and play for recording
    videoRef.current.currentTime = 0;
    videoRef.current.play();

    // Stop recording after the video duration
    setTimeout(() => {
      mediaRecorder.stop();
      videoRef.current?.pause();
    }, videoRef.current.duration * 1000);
  };

  const isEyeOpen = (landmarks: any, eyePoints: number[]) => {
    const topY = landmarks[eyePoints[0]].y;
    const bottomY = landmarks[eyePoints[1]].y;
    const eyeHeight = Math.abs(topY - bottomY);
    return eyeHeight;
  };

  const onResults = (results: any) => {
    const currentTime = performance.now();
    const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
    
    // Skip frame if we're processing too quickly
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
      alpha: false // Disable alpha channel for better performance
    });
    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    // Match canvas size to video size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Use faster drawing operation
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

        // Create iris canvas only once and reuse
        const irisCanvas = document.createElement('canvas');
        irisCanvas.width = canvas.width;
        irisCanvas.height = canvas.height;
        const irisCtx = irisCanvas.getContext('2d', { alpha: true });
        if (!irisCtx) return;

        irisCtx.fillStyle = selectedColor;
        irisCtx.strokeStyle = selectedColor;

        const drawIris = (centerPoint: number, boundaryPoints: number[], openRatio: number) => {
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

          const maxOpacity = 0.6;
          const minOpenRatio = 0.005;
          const maxOpenRatio = 0.018;
          const opacity = Math.min(maxOpacity, 
            (openRatio - minOpenRatio) / (maxOpenRatio - minOpenRatio) * maxOpacity
          );
          
          irisCtx.globalAlpha = opacity;
          irisCtx.beginPath();
          irisCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          irisCtx.fill();
        };

        drawIris(leftIrisCenter, leftIrisBoundary, leftEyeOpenRatio);
        drawIris(rightIrisCenter, rightIrisBoundary, rightEyeOpenRatio);

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

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(() => processVideo());
  };

  const processVideo = async () => {
    if (!videoRef.current || !faceMeshRef.current) {
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
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

    setIsProcessing(true);

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

  const initFaceMesh = async () => {
    try {
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      await faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      await faceMesh.initialize();
      
      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;
    } catch (error) {
      console.error("Error initializing FaceMesh:", error);
      toast({
        title: "Error",
        description: "Failed to initialize face detection",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    initFaceMesh();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clean up audio context and source
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [toast]);

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Change eye color to brown</h1>

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
              disabled={!canvasRef.current}
              variant="outline"
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
