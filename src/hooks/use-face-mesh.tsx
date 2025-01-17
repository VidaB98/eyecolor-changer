import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export const useFaceMesh = () => {
  const faceMeshRef = useRef<any>(null);
  const { toast } = useToast();

  const initFaceMesh = async () => {
    try {
      if (faceMeshRef.current) {
        await faceMeshRef.current.close();
        faceMeshRef.current = null;
      }

      const { FaceMesh } = await import('@mediapipe/face_mesh');
      
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });

      await faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      await faceMesh.initialize();
      
      faceMeshRef.current = faceMesh;
      console.log("FaceMesh initialized successfully");
    } catch (error) {
      console.error("Error initializing FaceMesh:", error);
      setTimeout(() => {
        if (!faceMeshRef.current) {
          initFaceMesh();
        }
      }, 1000);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await initFaceMesh();
      }
    };

    init();

    return () => {
      mounted = false;
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, []);

  return { faceMeshRef };
};