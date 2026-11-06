import { ChordName, StrumDirection } from './types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private gainNode: GainNode | null = null;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private isLoaded: boolean = false;
  private volume: number = 0.85;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    const chords: ChordName[] = ['C', 'G', 'Am', 'Em'];
    const directions: StrumDirection[] = ['DOWN', 'UP'];

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.gainNode.connect(this.ctx.destination);
      }
    } catch (e) {
      console.warn('Web Audio Context initialization deferred or unsupported:', e);
    }

    // Preload audio samples
    const loadPromises = [];
    for (const chord of chords) {
      for (const dir of directions) {
        const key = `${chord}_${dir}`;
        const filename = `/audio/${chord}_${dir.toLowerCase()}.wav`;

        // Preload HTMLAudioElement as immediate fallback
        try {
          const audio = new Audio(filename);
          audio.preload = 'auto';
          this.audioElements.set(key, audio);
        } catch {}

        // Fetch buffer for Web Audio API (lower latency)
        if (this.ctx) {
          const p = fetch(filename)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.arrayBuffer();
            })
            .then(arrayBuf => this.ctx!.decodeAudioData(arrayBuf))
            .then(audioBuf => {
              this.audioBuffers.set(key, audioBuf);
            })
            .catch(err => {
              console.warn(`Could not load audio buffer for ${key}:`, err);
            });
          loadPromises.push(p);
        }
      }
    }

    await Promise.allSettled(loadPromises);
    this.isLoaded = true;
  }

  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext:', err);
      }
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    for (const audio of this.audioElements.values()) {
      audio.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public play(chord: ChordName, direction: StrumDirection): void {
    const key = `${chord}_${direction.toUpperCase()}`;

    // Ensure AudioContext is running
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Web Audio buffer playback
    if (this.ctx && this.gainNode && this.audioBuffers.has(key)) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.audioBuffers.get(key)!;
        source.connect(this.gainNode);
        source.start(0);
        return;
      } catch (e) {
        console.warn('Buffer playback error, trying audio element:', e);
      }
    }

    // Fallback: HTML Audio element
    const fallbackAudio = this.audioElements.get(key);
    if (fallbackAudio) {
      try {
        fallbackAudio.currentTime = 0;
        fallbackAudio.volume = this.volume;
        fallbackAudio.play().catch(e => {
          console.warn('Audio play prevented:', e);
        });
      } catch (e) {
        console.warn(`Failed to play fallback audio for ${key}:`, e);
      }
    } else {
      console.log(`Strum detected: ${direction} ${chord} (audio sample pending)`);
    }
  }

  public close(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}
