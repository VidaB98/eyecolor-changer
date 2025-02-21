
declare global {
  interface Window {
    FaceMesh: new (config: {
      locateFile: (file: string) => string;
    }) => {
      initialize(): Promise<void>;
      setOptions(options: {
        maxNumFaces: number;
        refineLandmarks: boolean;
        minDetectionConfidence: number;
        minTrackingConfidence: number;
      }): Promise<void>;
      onResults(callback: (results: any) => void): void;
      send(options: { image: HTMLVideoElement }): Promise<void>;
      close(): Promise<void>;
    };
  }
}

export {};
