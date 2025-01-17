import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FaceMesh } from "@mediapipe/face_mesh";
import VideoControls from "@/components/VideoControls";
import VideoPreview from "@/components/VideoPreview";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { processVideoFrame, isEyeOpen, drawIris } from "@/utils/videoProcessing";

const predefinedColors = [
  { name: "Brown", value: "#8B4513" },
];

interface ExtendedHTMLCanvasElement extends HTMLCanvasElement {
  captureStream(frameRate?: number): MediaStream;
}

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(predefinedColors[0].value);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { toast } = useToast();
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;

  useEffect(() => {
    const initializeFaceMesh = async () => {
      try {
        setInitError(null);
        
        const faceMeshInstance = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
          },
        });

        await faceMeshInstance.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMeshInstance.onResults(onResults);
        await faceMeshInstance.initialize();
        faceMeshRef.current = faceMeshInstance;
        console.log("FaceMesh initialized successfully");
      } catch (error) {
        console.error("Error during FaceMesh setup:", error);
        setInitError("Failed to initialize face detection. Please refresh the page and ensure you're using a modern browser.");
      }
    };

    initializeFaceMesh();

    return () => {
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const processVideo = async () => {
    if (!videoRef.current || !faceMeshRef.current) {
      setInitError("Face detection is not initialized. Please refresh the page.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await processVideoFrame(faceMeshRef.current, videoRef.current, canvasRef.current!, selectedColor);
      setIsProcessing(false);

      if (!videoRef.current.paused) {
        animationFrameRef.current = requestAnimationFrame(() => processVideo());
      }
    } catch (error) {
      console.error("Error processing video frame:", error);
      setInitError("Error processing video. Please refresh and try again.");
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputVideoRef.current || !mediaStreamRef.current || !videoRef.current) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!audioSourceRef.current && audioContextRef.current) {
      audioSourceRef.current = audioContextRef.current.createMediaElementSource(videoRef.current);
    }

    const audioDestination = audioContextRef.current.createMediaStreamDestination();
    
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
    videoRef.current.currentTime = 0;
    videoRef.current.play();

    setTimeout(() => {
      mediaRecorder.stop();
      videoRef.current?.pause();
    }, videoRef.current.duration * 1000);
  };

  const onResults = (results: any) => {
    const currentTime = performance.now();
    const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
    
    if (timeSinceLastFrame < frameInterval) return;
    
    lastFrameTimeRef.current = currentTime;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.multiFaceLandmarks) return;

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
          const irisCtx = irisCanvas.getContext('2d');
          if (!irisCtx) {
            throw new Error("Could not get iris canvas context");
          }

          drawIris(irisCtx, leftIrisCenter, leftIrisBoundary, leftEyeOpenRatio, landmarks, canvas, selectedColor);
          drawIris(irisCtx, rightIrisCenter, rightIrisBoundary, rightEyeOpenRatio, landmarks, canvas, selectedColor);

          ctx.globalCompositeOperation = "soft-light";
          ctx.drawImage(irisCanvas, 0, 0);
          ctx.globalCompositeOperation = "source-over";
        }
      }

      if (outputVideoRef.current && !outputVideoRef.current.srcObject) {
        try {
          const canvas = canvasRef.current as ExtendedHTMLCanvasElement;
          let stream: MediaStream | null = null;
          
          if (typeof canvas.captureStream === 'function') {
            stream = canvas.captureStream(30);
          } else if (typeof (canvas as any).webkitCaptureStream === 'function') {
            stream = (canvas as any).webkitCaptureStream(30);
          } else if (typeof (canvas as any).mozCaptureStream === 'function') {
            stream = (canvas as any).mozCaptureStream(30);
          }

          if (!stream) {
            throw new Error("Failed to capture stream from canvas");
          }

          mediaStreamRef.current = stream;
          outputVideoRef.current.srcObject = stream;
          outputVideoRef.current.play().catch(error => {
            console.error("Error playing output video:", error);
            setInitError("Unable to play processed video. Please try a different browser.");
          });
        } catch (error) {
          console.error("Error capturing stream:", error);
          setInitError("Unable to process video stream. Please try a different browser.");
        }
      }
    } catch (error) {
      console.error("Error in onResults:", error);
      setInitError("Error processing video. Please refresh and try again.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInitError(null);
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
          videoRef.current.play().catch(error => {
            console.error("Error playing video:", error);
            setInitError("Unable to play the video. Please try a different browser or video format.");
          });
          processVideo();
        }
      };
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Change eye color to brown</h1>

        {initError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Setup Error</AlertTitle>
            <AlertDescription>{initError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <VideoControls
            onFileUpload={handleFileUpload}
            onDownload={handleDownload}
            isProcessing={isProcessing}
            hasVideo={!!videoRef.current?.src}
          />

          <VideoPreview
            videoRef={videoRef}
            outputVideoRef={outputVideoRef}
            canvasRef={canvasRef}
            onVideoPlay={() => processVideo()}
          />
        </div>
      </Card>
    </div>
  );
};

export default Index;
