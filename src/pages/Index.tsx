import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FaceMesh } from "@mediapipe/face_mesh";
import VideoControls from "@/components/VideoControls";
import VideoPreview from "@/components/VideoPreview";
import { processVideoFrame, isEyeOpen, drawIris } from "@/utils/videoProcessing";

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
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;

  const processVideo = async () => {
    if (!videoRef.current || !faceMeshRef.current) return;
    
    setIsProcessing(true);
    await processVideoFrame(faceMeshRef.current, videoRef.current, canvasRef.current!, selectedColor);
    setIsProcessing(false);

    if (!videoRef.current.paused) {
      animationFrameRef.current = requestAnimationFrame(() => processVideo());
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

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
        if (!irisCtx) return;

        drawIris(irisCtx, leftIrisCenter, leftIrisBoundary, leftEyeOpenRatio, landmarks, canvas, selectedColor);
        drawIris(irisCtx, rightIrisCenter, rightIrisBoundary, rightEyeOpenRatio, landmarks, canvas, selectedColor);

        ctx.globalCompositeOperation = "soft-light";
        ctx.drawImage(irisCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    if (outputVideoRef.current) {
      try {
        if (!outputVideoRef.current.srcObject) {
          let stream;
          try {
            stream = canvas.captureStream(30);
          } catch (e) {
            stream = canvas.captureStream?.(30) || canvas.webkitCaptureStream?.(30) || canvas.mozCaptureStream?.(30);
          }

          if (!stream) {
            throw new Error("Failed to capture stream from canvas");
          }

          mediaStreamRef.current = stream;
          outputVideoRef.current.srcObject = stream;
          outputVideoRef.current.autoplay = true;
          outputVideoRef.current.play().catch(error => {
            console.error("Error playing output video:", error);
            toast({
              title: "Playback Error",
              description: "Unable to play processed video. Please try a different browser.",
              variant: "destructive",
            });
          });
        }
      } catch (error) {
        console.error("Error capturing stream:", error);
        toast({
          title: "Stream Error",
          description: "Unable to process video stream. Please try a different browser.",
          variant: "destructive",
        });
      }
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

    const videoUrl = URL.createObjectURL(new Blob([file], { type: file.type }));
    
    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();

      videoRef.current.onerror = (e) => {
        console.error("Error loading video:", e);
        toast({
          title: "Video Error",
          description: "Failed to load the video. Please try a different format.",
          variant: "destructive"
        });
      };

      videoRef.current.onloadeddata = () => {
        if (videoRef.current) {
          if (videoRef.current.canPlayType(file.type)) {
            videoRef.current.play().catch(error => {
              console.error("Error playing video:", error);
              toast({
                title: "Playback Error",
                description: "Unable to play the video. Please try a different browser or video format.",
                variant: "destructive"
              });
            });
            processVideo();
          } else {
            toast({
              title: "Format Error",
              description: "This video format is not supported by your browser. Please try a different format.",
              variant: "destructive"
            });
          }
        }
      };
    }
  };

  useEffect(() => {
    let cleanup = false;

    const setup = async () => {
      if (!cleanup) {
        try {
          console.log("Starting FaceMesh initialization...");
          
          const faceMeshInstance = new FaceMesh({
            locateFile: (file) => {
              console.log("Loading file:", file);
              const baseUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619";
              
              setTimeout(() => {
                const url = `${baseUrl}/${file}`;
                fetch(url, { method: 'HEAD' })
                  .then(response => {
                    if (response.ok) {
                      console.log("Successfully verified resource:", url);
                    } else {
                      console.error("Resource verification failed:", url);
                    }
                  })
                  .catch(error => {
                    console.error("Resource loading error:", error);
                  });
              }, 0);

              return `${baseUrl}/${file}`;
            },
          });

          console.log("Setting FaceMesh options...");
          await faceMeshInstance.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          console.log("Setting up FaceMesh results handler...");
          faceMeshInstance.onResults(onResults);

          console.log("Initializing FaceMesh...");
          try {
            await faceMeshInstance.initialize();
            console.log("FaceMesh initialized successfully");
            faceMeshRef.current = faceMeshInstance;
          } catch (error) {
            console.error("Error initializing FaceMesh:", error);
            toast({
              title: "Initialization Error",
              description: "Failed to initialize face detection. Please refresh the page.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error during FaceMesh setup:", error);
          toast({
            title: "Setup Error",
            description: "Failed to set up face detection. Please refresh and try again.",
            variant: "destructive",
          });
        }
      }
    };

    setup();

    return () => {
      cleanup = true;
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
