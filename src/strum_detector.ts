import { StrumDirection } from './types';

/**
 * Detect wrist crossings through a horizontal zone with direction and cooldown.
 */
export class StrumDetector {
  public zoneFraction: number;
  public minDeltaFraction: number;
  public cooldown: number; // in seconds
  public previousY: number | null = null;
  public previousTime: number | null = null;
  public lastEventTime: number = 0;

  constructor(zoneFraction: number = 0.62, minDeltaFraction: number = 0.035, cooldown: number = 0.32) {
    this.zoneFraction = zoneFraction;
    this.minDeltaFraction = minDeltaFraction;
    this.cooldown = cooldown;
  }

  public zoneY(frameHeight: number): number {
    return Math.floor(frameHeight * this.zoneFraction);
  }

  /**
   * Update wrist position and detect crossing.
   * @param y Current wrist pixel Y
   * @param timestamp Current time in seconds (e.g. performance.now() / 1000)
   * @param frameHeight Total frame height in pixels
   */
  public update(y: number, timestamp: number, frameHeight: number): StrumDirection | null {
    const zone = this.zoneY(frameHeight);
    const minDelta = frameHeight * this.minDeltaFraction;
    let event: StrumDirection | null = null;

    if (this.previousY !== null) {
      const delta = y - this.previousY;
      const crossed =
        (this.previousY < zone && zone <= y) ||
        (this.previousY > zone && zone >= y);
      const movedEnough = Math.abs(delta) >= minDelta;
      const cooldownDone = timestamp - this.lastEventTime >= this.cooldown;

      if (crossed && movedEnough && cooldownDone) {
        // In image coordinates, y increases downward.
        event = delta > 0 ? 'DOWN' : 'UP';
        this.lastEventTime = timestamp;
      }
    }

    this.previousY = y;
    this.previousTime = timestamp;
    return event;
  }

  public reset(): void {
    this.previousY = null;
    this.previousTime = null;
  }
}
