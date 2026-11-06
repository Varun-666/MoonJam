import { ChordName, Landmark } from './types';

/**
 * Beginner-friendly heuristic chord selector.
 * Uses the number of extended fingers on the hand MediaPipe labels 'Left'.
 * This is intentionally a demo mapping, not real guitar fingering:
 *   0 extended -> Em, 1 -> C, 2 -> G, 3 -> Am, 4/5 -> C.
 * A short stable history avoids rapid chord flicker.
 */
export class ChordDetector {
  static readonly FINGER_PAIRS: ReadonlyArray<readonly [number, number]> = [
    [8, 6],   // Index
    [12, 10], // Middle
    [16, 14], // Ring
    [20, 18], // Pinky
  ];

  public stableFrames: number;
  private candidate: ChordName | null = null;
  private count: number = 0;
  private stable: ChordName = 'C';
  public lastFingerCount: number = 1;

  constructor(stableFrames: number = 4) {
    this.stableFrames = stableFrames;
  }

  private static distance(a: Landmark, b: Landmark): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public fingerCount(landmarks: Landmark[]): number {
    if (!landmarks || landmarks.length < 21) return 0;
    const wrist = landmarks[0];
    let extended = 0;
    for (const [tipIdx, pipIdx] of ChordDetector.FINGER_PAIRS) {
      const tipD = ChordDetector.distance(landmarks[tipIdx], wrist);
      const pipD = ChordDetector.distance(landmarks[pipIdx], wrist);
      if (tipD > pipD * 1.08) {
        extended += 1;
      }
    }
    this.lastFingerCount = extended;
    return extended;
  }

  public detect(landmarks: Landmark[]): ChordName {
    const count = this.fingerCount(landmarks);
    const mapping: Record<number, ChordName> = {
      0: 'Em',
      1: 'C',
      2: 'G',
      3: 'Am',
      4: 'C',
    };
    const chord: ChordName = mapping[count] ?? 'C';

    if (chord === this.candidate) {
      this.count += 1;
    } else {
      this.candidate = chord;
      this.count = 1;
    }

    if (this.count >= this.stableFrames) {
      this.stable = chord;
    }

    return this.stable;
  }

  public setChord(chord: ChordName): void {
    this.stable = chord;
    this.candidate = chord;
    this.count = this.stableFrames;
  }

  public getStableChord(): ChordName {
    return this.stable;
  }
}
