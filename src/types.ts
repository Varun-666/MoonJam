export type Landmark = [number, number, number]; // [x, y, z]

export type ChordName = 'C' | 'G' | 'Am' | 'Em';

export type StrumDirection = 'UP' | 'DOWN';

export interface HandData {
  landmarks: Landmark[];
  score: number;
}

export interface DetectedHands {
  Left?: HandData;
  Right?: HandData;
}
