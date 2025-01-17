export const isEyeOpen = (landmarks: any, eyePoints: number[]) => {
  const topY = landmarks[eyePoints[0]].y;
  const bottomY = landmarks[eyePoints[1]].y;
  const eyeHeight = Math.abs(topY - bottomY);
  return eyeHeight;
};

export const drawIris = (
  irisCtx: CanvasRenderingContext2D,
  landmarks: any,
  centerPoint: number,
  boundaryPoints: number[],
  openRatio: number,
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

  const maxOpacity = 0.6;
  const minOpenRatio = 0.005;
  const maxOpenRatio = 0.018;
  const opacity = Math.min(maxOpacity, 
    (openRatio - minOpenRatio) / (maxOpenRatio - minOpenRatio) * maxOpacity
  );
  
  irisCtx.globalAlpha = opacity;
  irisCtx.fillStyle = selectedColor;
  irisCtx.strokeStyle = selectedColor;
  irisCtx.beginPath();
  irisCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  irisCtx.fill();
};