import { DetectedHands, HandData, Landmark } from './types';

// MediaPipe global interfaces
interface MediaPipeHandLandmark {
  x: number;
  y: number;
  z: number;
}

interface MediaPipeClassification {
  index: number;
  score: number;
  label: 'Left' | 'Right';
}

interface MediaPipeResults {
  multiHandLandmarks?: MediaPipeHandLandmark[][];
  multiHandedness?: MediaPipeClassification[];
}

export class BrowserHandTracker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mpHands: any = null;
  private isModelReady: boolean = false;
  private maxHands: number;
  private detectionConfidence: number;
  private trackingConfidence: number;

  constructor(maxHands: number = 2, detectionConfidence: number = 0.6, trackingConfidence: number = 0.55) {
    this.maxHands = maxHands;
    this.detectionConfidence = detectionConfidence;
    this.trackingConfidence = trackingConfidence;
  }

  public async initialize(): Promise<boolean> {
    if (this.isModelReady && this.mpHands) return true;

    // Wait up to 5 seconds for window.Hands to be available from script tags
    let waited = 0;
    while (!(window as unknown as { Hands?: unknown }).Hands && waited < 50) {
      await new Promise((r) => setTimeout(r, 100));
      waited++;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HandsClass = (window as any).Hands;
    if (!HandsClass) {
      console.warn('MediaPipe Hands script not found in window object');
      return false;
    }

    try {
      this.mpHands = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.mpHands.setOptions({
        maxNumHands: this.maxHands,
        modelComplexity: 0,
        minDetectionConfidence: this.detectionConfidence,
        minTrackingConfidence: this.trackingConfidence,
      });

      this.isModelReady = true;
      return true;
    } catch (err) {
      console.error('Failed to initialize MediaPipe Hands:', err);
      return false;
    }
  }

  public async processFrame(
    video: HTMLVideoElement,
    onResults: (hands: DetectedHands, rawResults: MediaPipeResults) => void
  ): Promise<void> {
    if (!this.mpHands || !this.isModelReady) return;

    this.mpHands.onResults((results: MediaPipeResults) => {
      const hands: DetectedHands = {};

      if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const rawLandmarks: MediaPipeHandLandmark[] | undefined = results.multiHandLandmarks[i];
          const handednessItem: MediaPipeClassification | undefined = results.multiHandedness[i];
          if (!handednessItem || !rawLandmarks) continue;

          const landmarks: Landmark[] = rawLandmarks.map((p) => [p.x, p.y, p.z]);
          if (handednessItem.label === 'Left') {
            hands.Left = { landmarks, score: handednessItem.score };
          } else if (handednessItem.label === 'Right') {
            hands.Right = { landmarks, score: handednessItem.score };
          }
        }
      }

      onResults(hands, results);
    });

    try {
      await this.mpHands.send({ image: video });
    } catch {
      // Ignore transient frame send failures during shutdown or resize
    }
  }

  public close(): void {
    if (this.mpHands) {
      try {
        this.mpHands.close();
      } catch {}
      this.mpHands = null;
    }
    this.isModelReady = false;
  }
}
