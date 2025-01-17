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
  const targetFPS = 60;
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
    
    // Return the actual eye height ratio instead of a boolean
    return eyeHeight;
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

    // Draw the original frame first
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

        // Create a separate canvas for the iris coloring
        const irisCanvas = document.createElement('canvas');
        irisCanvas.width = canvas.width;
        irisCanvas.height = canvas.height;
        const irisCtx = irisCanvas.getContext('2d');
        if (!irisCtx) return;

        irisCtx.fillStyle = selectedColor;
        irisCtx.strokeStyle = selectedColor;
        irisCtx.globalCompositeOperation = "source-over";

        const drawIris = (centerPoint: number, boundaryPoints: number[], openRatio: number) => {
          if (!irisCtx) return;

          // Only draw if the eye is at least slightly open
          if (openRatio < 0.005) return;

          const centerX = landmarks[centerPoint].x * canvas.width;
          const centerY = landmarks[centerPoint].y * canvas.height;

          // Calculate average radius but make it slightly smaller to avoid coloring eyelashes
          const radii = boundaryPoints.map(point => {
            const dx = landmarks[point].x * canvas.width - centerX;
            const dy = landmarks[point].y * canvas.height - centerY;
            return Math.hypot(dx, dy);
          });
          const radius = (radii.reduce((a, b) => a + b, 0) / radii.length) * 0.85; // Reduce radius by 15%

          // Adjust opacity based on how open the eye is
          // Map the openRatio to a range between 0 and 0.6
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

        // Blend the iris coloring with the original frame
        ctx.globalCompositeOperation = "soft-light";
        ctx.drawImage(irisCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
    }

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
          processVideo();
        }
      };
    }
  };

  const initFaceMesh = async () => {
    try {
      console.log("Creating FaceMesh instance...");
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          console.log(`Loading MediaPipe file: ${file}`);
          // Try multiple CDNs for better availability
          const cdnUrls = [
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
            `https://unpkg.com/@mediapipe/face_mesh@0.4.1633559619/${file}`,
            `https://www.gstatic.com/mediapipe/face_mesh/${file}`
          ];
          
          // Return the first CDN URL, if it fails the browser will try the next one
          return cdnUrls[0];
        }
      });

      console.log("Setting FaceMesh options...");
      await faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      console.log("Setting up onResults handler...");
      faceMesh.onResults(onResults);

      console.log("Initializing FaceMesh...");
      try {
        // Preload required assets with fallback URLs
        const assetUrls = [
          ['face_mesh_solution_packed_assets.data', 'face_mesh.data'],
          ['face_mesh_solution_simd_wasm_bin.js', 'face_mesh_simd.js'],
          ['face_mesh_solution_wasm_bin.js', 'face_mesh.js']
        ];

        const cdnBases = [
          'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/',
          'https://unpkg.com/@mediapipe/face_mesh@0.4.1633559619/',
          'https://www.gstatic.com/mediapipe/face_mesh/'
        ];

        // Try loading from each CDN until successful
        for (const base of cdnBases) {
          try {
            await Promise.all(
              assetUrls.map(([primary, fallback]) =>
                fetch(base + primary).catch(() => fetch(base + fallback))
              )
            );
            break; // If successful, exit the loop
          } catch (e) {
            console.log(`Failed to load from ${base}, trying next CDN...`);
            continue;
          }
        }

        await faceMesh.initialize();
        console.log("FaceMesh initialized successfully!");
        faceMeshRef.current = faceMesh;
      } catch (initError) {
        console.error("Error during face mesh initialization:", initError);
        toast({
          title: "Face Detection Error",
          description: "Failed to initialize face detection. Please try using a different browser or check your internet connection.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating or setting up FaceMesh:", error);
      toast({
        title: "Browser Compatibility Issue",
        description: "Your browser might not support all required features. Please try using Chrome, Firefox, or Edge.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let cleanup = false;

    const setup = async () => {
      if (!cleanup) {
        await initFaceMesh();
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
