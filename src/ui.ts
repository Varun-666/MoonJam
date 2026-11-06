import { ChordName, DetectedHands, Landmark } from './types';

export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12], [5, 9],
  // Ring
  [13, 14], [14, 15], [15, 16], [9, 13],
  // Pinky
  [17, 18], [18, 19], [19, 20], [13, 17], [0, 17]
];

export interface DrawHUDOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  chord: ChordName;
  lastStrum: string;
  fps: number;
  hands: DetectedHands;
  strumY: number;
  isStrummingFlash?: boolean;
}

export function drawHUD({
  ctx,
  width,
  height,
  chord,
  lastStrum,
  fps,
  hands,
  strumY,
  isStrummingFlash = false,
}: DrawHUDOptions): void {
  // 1. Semi-opaque dark header panel (rgb(18, 25, 22) @ 0.72)
  ctx.save();
  ctx.fillStyle = 'rgba(18, 25, 22, 0.78)';
  ctx.fillRect(0, 0, width, 118);

  // 2. Title: AIR GUITAR
  ctx.font = 'bold 24px monospace, sans-serif';
  ctx.fillStyle = '#e6ffeb';
  ctx.fillText('AIR GUITAR', 22, 36);

  // 3. Current Chord
  ctx.font = 'bold 24px monospace, sans-serif';
  ctx.fillStyle = '#78f0a0';
  ctx.fillText(`CHORD: ${chord}`, 22, 77);

  // 4. Last Strum
  ctx.font = 'bold 18px monospace, sans-serif';
  ctx.fillStyle = isStrummingFlash ? '#50e488' : '#f0f0f0';
  ctx.fillText(`LAST STRUM: ${lastStrum}`, 240, 77);

  // 5. FPS
  ctx.font = '16px monospace, sans-serif';
  ctx.fillStyle = '#dcf0e1';
  const fpsText = `FPS: ${fps.toFixed(1)}`;
  ctx.fillText(fpsText, width - 155, 36);

  // 6. Hand Indicators (LEFT & RIGHT)
  const leftDetected = !!hands.Left;
  const rightDetected = !!hands.Right;

  // Left circle + label
  ctx.beginPath();
  ctx.arc(width - 170, 78, 7, 0, Math.PI * 2);
  ctx.fillStyle = leftDetected ? '#50dc78' : '#646464';
  ctx.fill();

  ctx.font = '13px monospace, sans-serif';
  ctx.fillStyle = '#f0f0f0';
  ctx.fillText('LEFT', width - 155, 83);

  // Right circle + label
  ctx.beginPath();
  ctx.arc(width - 90, 78, 7, 0, Math.PI * 2);
  ctx.fillStyle = rightDetected ? '#50dc78' : '#646464';
  ctx.fill();

  ctx.fillText('RIGHT', width - 75, 83);

  // 7. Strum Zone Line
  ctx.strokeStyle = isStrummingFlash ? '#4ade80' : 'rgba(80, 220, 140, 0.85)';
  ctx.lineWidth = isStrummingFlash ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(0, strumY);
  ctx.lineTo(width, strumY);
  ctx.stroke();

  // Strum Zone Label
  ctx.font = '14px monospace, sans-serif';
  ctx.fillStyle = '#78f0a0';
  ctx.fillText('STRUM ZONE', 12, strumY - 10);

  // 8. Bottom Instruction Text
  ctx.font = '14px monospace, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(
    'Move right wrist across the green line to strum | Left hand fingers select chord',
    20,
    height - 20
  );

  ctx.restore();
}

/**
 * Draw hand landmarks and bone connections on canvas.
 */
export function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  handLabel: 'Left' | 'Right',
  mirrored: boolean = true
): void {
  ctx.save();
  const boneColor = handLabel === 'Left' ? '#38bdf8' : '#4ade80';
  const jointColor = handLabel === 'Left' ? '#0284c7' : '#16a34a';
  const tipColor = '#facc15';

  // Draw bone lines
  ctx.strokeStyle = boneColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const p1 = landmarks[startIdx];
    const p2 = landmarks[endIdx];
    if (!p1 || !p2) continue;

    const x1 = mirrored ? (1 - p1[0]) * width : p1[0] * width;
    const y1 = p1[1] * height;
    const x2 = mirrored ? (1 - p2[0]) * width : p2[0] * width;
    const y2 = p2[1] * height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw joints
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    const x = mirrored ? (1 - p[0]) * width : p[0] * width;
    const y = p[1] * height;

    const isTip = [4, 8, 12, 16, 20].includes(i);
    const isWrist = i === 0;

    ctx.beginPath();
    ctx.arc(x, y, isWrist ? 7 : isTip ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isWrist ? '#ec4899' : isTip ? tipColor : jointColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw hand label above wrist
  const wrist = landmarks[0];
  if (wrist) {
    const wx = mirrored ? (1 - wrist[0]) * width : wrist[0] * width;
    const wy = wrist[1] * height;
    ctx.font = 'bold 12px monospace, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(handLabel.toUpperCase(), wx - 16, wy - 14);
  }

  ctx.restore();
}
