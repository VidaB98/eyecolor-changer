export const isEyeOpen = (landmarks: any, eyePoints: number[]) => {
  const topY = landmarks[eyePoints[0]].y;
  const bottomY = landmarks[eyePoints[1]].y;
  const eyeHeight = Math.abs(topY - bottomY);
  return eyeHeight > 0.02;
};

export const getIrisCenter = (points: any[]) => {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
};

export const getIrisRadius = (
  points: any[],
  center: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
) => {
  return (
    Math.max(
      ...points.map((p) =>
        Math.sqrt(
          Math.pow((p.x - center.x) * canvasWidth, 2) +
            Math.pow((p.y - center.y) * canvasHeight, 2)
        )
      )
    ) * 0.85
  );
};