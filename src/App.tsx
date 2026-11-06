import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChordDetector } from './chord_detector';
import { StrumDetector } from './strum_detector';
import { AudioEngine } from './audio_engine';
import { BrowserHandTracker } from './hand_tracker';
import { drawHUD, drawHandLandmarks } from './ui';
import { ChordName, DetectedHands, StrumDirection } from './types';
import { getVirtualLeftHandLandmarks, getVirtualRightHandLandmarks } from './virtual_hands';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Music,
  Sliders,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Radio,
} from 'lucide-react';

const CHORDS: { name: ChordName; label: string; fingers: string; count: number }[] = [
  { name: 'Em', label: 'E minor', fingers: '0 fingers', count: 0 },
  { name: 'C', label: 'C Major', fingers: '1 finger / 4+', count: 1 },
  { name: 'G', label: 'G Major', fingers: '2 fingers', count: 2 },
  { name: 'Am', label: 'A minor', fingers: '3 fingers', count: 3 },
];

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Engine instances
  const chordDetectorRef = useRef<ChordDetector>(new ChordDetector(4));
  const strumDetectorRef = useRef<StrumDetector>(new StrumDetector(0.62, 0.035, 0.32));
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const handTrackerRef = useRef<BrowserHandTracker | null>(null);

  // State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentChord, setCurrentChord] = useState<ChordName>('C');
  const [lastStrum, setLastStrum] = useState<string>('—');
  const [isStrumFlashing, setIsStrumFlashing] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [handsDetected, setHandsDetected] = useState<DetectedHands>({});
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [fingerCount, setFingerCount] = useState<number>(1);
  const [manualWristY, setManualWristY] = useState<number>(50); // percentage (0-100)
  const [isPointerDown, setIsPointerDown] = useState<boolean>(false);
  const [isAutoJamming, setIsAutoJamming] = useState<boolean>(false);

  // Internal loop refs
  const lastTimeRef = useRef<number>(performance.now());
  const fpsRef = useRef<number>(0);
  const flashTimeoutRef = useRef<number | null>(null);
  const autoJamIntervalRef = useRef<number | null>(null);

  // Initialize audio engine and hand tracker on mount
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    handTrackerRef.current = new BrowserHandTracker(2, 0.6, 0.55);

    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.close();
      }
      if (handTrackerRef.current) {
        handTrackerRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (autoJamIntervalRef.current) {
        window.clearInterval(autoJamIntervalRef.current);
      }
    };
  }, []);

  // Trigger audio strum with visual pulse
  const triggerStrum = useCallback(
    (direction: StrumDirection, chordToPlay?: ChordName) => {
      const activeChord = chordToPlay || currentChord;
      if (audioEngineRef.current) {
        audioEngineRef.current.resume();
        audioEngineRef.current.play(activeChord, direction);
      }
      setLastStrum(direction);
      setIsStrumFlashing(true);
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = window.setTimeout(() => {
        setIsStrumFlashing(false);
      }, 320);
    },
    [currentChord]
  );

  // Select demo chord
  const selectChord = useCallback((chord: ChordName) => {
    setCurrentChord(chord);
    chordDetectorRef.current.setChord(chord);
    const countMap: Record<ChordName, number> = { Em: 0, C: 1, G: 2, Am: 3 };
    setFingerCount(countMap[chord] ?? 1);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1':
          selectChord('Em');
          break;
        case '2':
          selectChord('C');
          break;
        case '3':
          selectChord('G');
          break;
        case '4':
          selectChord('Am');
          break;
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          triggerStrum('DOWN');
          break;
        case 'ArrowUp':
          e.preventDefault();
          triggerStrum('UP');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectChord, triggerStrum]);

  // Start webcam with graceful permission handling
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (audioEngineRef.current) {
        audioEngineRef.current.resume();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Webcam is restricted in this embedded preview frame. Virtual AirGuitar mode is active with full sound and interactive gestures!'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        if (handTrackerRef.current) {
          await handTrackerRef.current.initialize();
        }
      }
    } catch (err: unknown) {
      console.warn('Camera access unavailable in current context:', err);
      const isIframe = window.self !== window.top;
      const message = isIframe
        ? 'Camera access is blocked by the embedded preview iframe security policy. You can open the app in a new tab for webcam tracking, or play with the full interactive Virtual AirGuitar mode right here!'
        : 'Camera access was not granted. Interactive Virtual AirGuitar mode is active below!';
      setCameraError(message);
      setCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setHandsDetected({});
    strumDetectorRef.current.reset();
  };

  // Automated Jam Demo Mode
  const toggleAutoJam = () => {
    if (isAutoJamming) {
      if (autoJamIntervalRef.current) {
        window.clearInterval(autoJamIntervalRef.current);
        autoJamIntervalRef.current = null;
      }
      setIsAutoJamming(false);
    } else {
      setIsAutoJamming(true);
      if (audioEngineRef.current) {
        audioEngineRef.current.resume();
      }

      const progression: ChordName[] = ['C', 'G', 'Am', 'Em'];
      let chordIdx = 0;
      let beat = 0;

      autoJamIntervalRef.current = window.setInterval(() => {
        beat = (beat + 1) % 4;
        if (beat === 0) {
          chordIdx = (chordIdx + 1) % progression.length;
          selectChord(progression[chordIdx]);
        }

        // Down on beat 0, 2; Up on beat 1, 3
        const dir: StrumDirection = beat % 2 === 0 ? 'DOWN' : 'UP';
        setManualWristY(dir === 'DOWN' ? 72 : 45);

        const canvas = canvasRef.current;
        if (canvas) {
          const height = canvas.height;
          const targetY = (dir === 'DOWN' ? 0.72 : 0.45) * height;
          const ev = strumDetectorRef.current.update(targetY, performance.now() / 1000, height);
          if (ev) {
            triggerStrum(ev, progression[chordIdx]);
          } else {
            triggerStrum(dir, progression[chordIdx]);
          }
        }
      }, 650);
    }
  };

  // Main frame render loop
  useEffect(() => {
    let active = true;

    const renderLoop = async () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          // Compute FPS
          const now = performance.now();
          const dt = (now - lastTimeRef.current) / 1000;
          lastTimeRef.current = now;
          if (dt > 0) {
            const instantFps = 1.0 / dt;
            fpsRef.current = fpsRef.current === 0 ? instantFps : 0.85 * fpsRef.current + 0.15 * instantFps;
            setFps(fpsRef.current);
          }

          let currentHandsToDraw: DetectedHands = {};

          // If camera is active, process video frames
          if (cameraActive && video && video.readyState >= 2) {
            // Draw mirrored camera frame to canvas
            ctx.save();
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, width, height);
            ctx.restore();

            // Run MediaPipe frame detection
            if (handTrackerRef.current) {
              await handTrackerRef.current.processFrame(video, (hands) => {
                setHandsDetected(hands);
                currentHandsToDraw = hands;

                const leftHand = hands.Left;
                const rightHand = hands.Right;

                // 1. Left hand detects chord
                if (leftHand && leftHand.landmarks) {
                  const chord = chordDetectorRef.current.detect(leftHand.landmarks);
                  if (chord) {
                    setCurrentChord(chord);
                  }
                  setFingerCount(chordDetectorRef.current.lastFingerCount);
                }

                // 2. Right hand wrist triggers strum
                if (rightHand && rightHand.landmarks) {
                  const wristY = rightHand.landmarks[0][1] * height;
                  const event = strumDetectorRef.current.update(wristY, performance.now() / 1000, height);
                  if (event) {
                    triggerStrum(event);
                  }
                } else {
                  strumDetectorRef.current.reset();
                }

                // Draw landmarks
                if (leftHand && leftHand.landmarks) {
                  drawHandLandmarks(ctx, leftHand.landmarks, width, height, 'Left', true);
                }
                if (rightHand && rightHand.landmarks) {
                  drawHandLandmarks(ctx, rightHand.landmarks, width, height, 'Right', true);
                }
              });
            }
          } else {
            // Camera inactive: render Virtual AirGuitar Stage
            ctx.fillStyle = '#0a0f0c';
            ctx.fillRect(0, 0, width, height);

            // Subtle soundwave visualizer in background
            ctx.strokeStyle = isStrumFlashing ? 'rgba(74, 222, 128, 0.25)' : 'rgba(30, 50, 38, 0.35)';
            ctx.lineWidth = 1.5;
            for (let i = 1; i <= 6; i++) {
              const y = (height / 7) * i;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(width, y);
              ctx.stroke();
            }

            // Generate virtual hands
            const virtualLeft = getVirtualLeftHandLandmarks(fingerCount);
            const virtualRight = getVirtualRightHandLandmarks(manualWristY / 100);

            currentHandsToDraw = {
              Left: { landmarks: virtualLeft, score: 0.99 },
              Right: { landmarks: virtualRight, score: 0.99 },
            };

            // Draw virtual hands skeletons
            drawHandLandmarks(ctx, virtualLeft, width, height, 'Left', false);
            drawHandLandmarks(ctx, virtualRight, width, height, 'Right', false);

            // Dynamic strum cursor circle
            const wristPxY = (manualWristY / 100) * height;
            ctx.beginPath();
            ctx.arc(width * 0.75, wristPxY, 12, 0, Math.PI * 2);
            ctx.fillStyle = isStrumFlashing ? '#4ade80' : 'rgba(74, 222, 128, 0.6)';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Interactive helper label
            ctx.font = '12px monospace';
            ctx.fillStyle = 'rgba(230, 255, 235, 0.8)';
            ctx.fillText(
              'SWEEP MOUSE / FINGER UP & DOWN ACROSS STRUM LINE',
              width * 0.42,
              height - 52
            );
          }

          // Draw OpenCV-accurate HUD
          const strumY = strumDetectorRef.current.zoneY(height);
          drawHUD({
            ctx,
            width,
            height,
            chord: currentChord,
            lastStrum,
            fps: fpsRef.current,
            hands: cameraActive ? handsDetected : currentHandsToDraw,
            strumY,
            isStrummingFlash: isStrumFlashing,
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    cameraActive,
    currentChord,
    fingerCount,
    handsDetected,
    isStrumFlashing,
    lastStrum,
    manualWristY,
    triggerStrum,
  ]);

  // Handle direct pointer motion on canvas for sweeping strums
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;
    const clampedYPct = Math.max(10, Math.min(95, relativeY * 100));
    setManualWristY(clampedYPct);

    const height = canvas.height;
    const pixelY = relativeY * height;
    const event = strumDetectorRef.current.update(pixelY, performance.now() / 1000, height);
    if (event) {
      triggerStrum(event);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsPointerDown(true);
    handleCanvasPointerMove(e);
  };

  const handleCanvasPointerUp = () => {
    setIsPointerDown(false);
  };

  // Adjust volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(val);
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioEngineRef.current) {
        audioEngineRef.current.setVolume(volume > 0 ? volume : 0.85);
      }
    } else {
      setIsMuted(true);
      if (audioEngineRef.current) {
        audioEngineRef.current.setVolume(0);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080b09] text-emerald-100 select-none">
      {/* Top Header */}
      <header className="border-b border-emerald-950/60 bg-[#0d1310] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shadow-inner">
            🎸
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-emerald-300 font-mono flex items-center gap-2">
              MOONJAM <span className="text-zinc-400 font-normal">| AirGuitar</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                {cameraActive ? 'Webcam Active' : 'Virtual Mode Active'}
              </span>
            </h1>
            <p className="text-xs text-emerald-400/70">Real-Time Computer Vision Instrument</p>
          </div>
        </div>

        {/* Audio Volume Controls & Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-1.5">
            <button
              onClick={toggleMute}
              className="text-emerald-400 hover:text-emerald-200 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 accent-emerald-400 cursor-pointer h-1.5 bg-emerald-900 rounded-lg"
            />
            <span className="text-xs font-mono text-emerald-400 min-w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>

          {/* Autoplay / Jam Demo button */}
          <button
            onClick={toggleAutoJam}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isAutoJamming
                ? 'bg-emerald-400 text-zinc-950 border-emerald-300 animate-pulse'
                : 'bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isAutoJamming ? 'Stop Jam' : 'Auto Jam'}</span>
          </button>

          {/* Camera toggle */}
          {cameraActive ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-2 bg-rose-950/60 border border-rose-700/60 text-rose-200 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-900/60 transition-colors shadow-sm"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-900/30 active:scale-95"
            >
              <Camera className="w-4 h-4 text-zinc-950" />
              Start Camera
            </button>
          )}

          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 text-xs text-emerald-400/80 hover:text-emerald-300 border border-emerald-900/50 rounded-lg px-2.5 py-1.5 bg-emerald-950/20"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Guide</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Camera Information / Fallback notification */}
      {cameraError && (
        <div className="bg-[#181a13] border-b border-amber-500/40 px-6 py-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 max-w-3xl">
            <span className="font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
              Iframe Sandbox Info
            </span>
            <span className="text-zinc-300">{cameraError}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-3 py-1 rounded text-xs transition-colors"
            >
              <span>Open in New Tab for Webcam</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setCameraError(null)}
              className="text-zinc-400 hover:text-zinc-200 underline text-xs px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Guide Banner */}
      {showGuide && (
        <div className="bg-[#101813] border-b border-emerald-900/60 px-6 py-4 text-xs text-emerald-200 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Left Hand: Chord Selection
            </h4>
            <p className="text-zinc-400">
              Selects chords based on extended fingers:
            </p>
            <ul className="text-zinc-300 font-mono space-y-0.5 pl-2 border-l border-emerald-900">
              <li>0 fingers → <strong className="text-emerald-300">Em</strong> (E minor)</li>
              <li>1 finger → <strong className="text-emerald-300">C</strong> (C Major)</li>
              <li>2 fingers → <strong className="text-emerald-300">G</strong> (G Major)</li>
              <li>3 fingers → <strong className="text-emerald-300">Am</strong> (A minor)</li>
              <li>4/5 fingers → <strong className="text-emerald-300">C</strong></li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Right Hand: Strumming
            </h4>
            <p className="text-zinc-400">
              Move your wrist downward or upward across the horizontal green <strong className="text-emerald-400">STRUM ZONE</strong> line.
            </p>
            <p className="text-zinc-400">
              In Virtual Mode, you can sweep your mouse or finger directly across the screen!
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Keyboard Shortcuts
            </h4>
            <p className="text-zinc-400">
              Play directly from your keyboard:
            </p>
            <ul className="text-zinc-300 font-mono space-y-0.5 pl-2 border-l border-emerald-900">
              <li>Keys <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">1</kbd>-<kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">4</kbd> → Chords Em, C, G, Am</li>
              <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">Space</kbd> / <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">↓</kbd> → Strum DOWN</li>
              <li><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">↑</kbd> → Strum UP</li>
            </ul>
          </div>
        </div>
      )}

      {/* Main Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-6xl w-full mx-auto gap-4">
        {/* Hidden video element for camera input */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="hidden"
          width={1280}
          height={720}
        />

        {/* Viewport / Instrument Screen */}
        <div className="relative w-full aspect-video max-w-4xl rounded-2xl overflow-hidden border border-emerald-900/60 bg-[#0d1410] shadow-2xl shadow-emerald-950/50 cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onPointerMove={handleCanvasPointerMove}
            onPointerDown={handleCanvasPointerDown}
            onPointerUp={handleCanvasPointerUp}
            className="w-full h-full object-cover block touch-none"
          />

          {/* Quick status bar overlay at bottom inside canvas frame when camera is not running */}
          {!cameraActive && (
            <div className="absolute inset-x-0 bottom-12 flex items-center justify-center pointer-events-none px-4">
              <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-700/40 rounded-xl px-5 py-2.5 text-center shadow-lg pointer-events-auto flex items-center gap-4">
                <span className="text-xs text-emerald-300">
                  🎸 <strong>Virtual AirGuitar is live!</strong> Sweep cursor across the green line to strum, or click buttons below.
                </span>
                <button
                  onClick={startCamera}
                  className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-3 py-1 rounded text-xs transition-colors shrink-0"
                >
                  Enable Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Instrument Controls Deck */}
        <div className="w-full max-w-4xl bg-[#0f1712] border border-emerald-950/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/80 pb-4">
            {/* Chord Selection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Select Chord (Left Hand Pose)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {CHORDS.map((c) => {
                  const isSelected = currentChord === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() => selectChord(c.name)}
                      className={`px-4 py-2 rounded-xl font-mono font-bold text-sm transition-all flex flex-col items-center justify-center min-w-20 ${
                        isSelected
                          ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 scale-105 border-2 border-emerald-300'
                          : 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 hover:bg-emerald-900/40'
                      }`}
                    >
                      <span className="text-base">{c.name}</span>
                      <span className={`text-[10px] font-normal ${isSelected ? 'text-zinc-800' : 'text-emerald-500/80'}`}>
                        {c.fingers}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strum Triggers */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Strum Triggers (Right Hand)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerStrum('DOWN')}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    isStrumFlashing && lastStrum === 'DOWN'
                      ? 'bg-emerald-400 text-zinc-950 scale-105'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 active:scale-95'
                  }`}
                >
                  <Play className="w-4 h-4 rotate-90" />
                  Strum DOWN (↓ / Space)
                </button>

                <button
                  onClick={() => triggerStrum('UP')}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                    isStrumFlashing && lastStrum === 'UP'
                      ? 'bg-emerald-400 text-zinc-950 scale-105'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 active:scale-95'
                  }`}
                >
                  <Play className="w-4 h-4 -rotate-90" />
                  Strum UP (↑)
                </button>
              </div>
            </div>
          </div>

          {/* Virtual Wrist Strum Cross Slider */}
          <div className="flex items-center gap-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3">
            <div className="flex flex-col min-w-44">
              <span className="text-xs font-bold text-emerald-300">Virtual Strum Slider</span>
              <span className="text-[11px] text-zinc-400">
                Drag past the 62% line or sweep cursor across the stage
              </span>
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="20"
                max="90"
                step="1"
                value={manualWristY}
                onChange={(e) => {
                  const newYPct = parseFloat(e.target.value);
                  setManualWristY(newYPct);
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const height = canvas.height;
                    const pixelY = (newYPct / 100) * height;
                    const ev = strumDetectorRef.current.update(pixelY, performance.now() / 1000, height);
                    if (ev) {
                      triggerStrum(ev);
                    }
                  }
                }}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-emerald-950 rounded-lg"
              />
              {/* 62% marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-emerald-400 rounded-full pointer-events-none shadow-sm shadow-emerald-400/50"
                style={{ left: `${((62 - 20) / (90 - 20)) * 100}%` }}
                title="Strum Zone Threshold (62%)"
              />
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold min-w-16 text-right">
              Wrist: {Math.round(manualWristY)}%
            </span>
          </div>

          {/* Real-time status readouts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2.5">
              <span className="text-zinc-400 block text-[10px] uppercase">Active Chord</span>
              <span className="text-emerald-300 font-bold text-base">{currentChord}</span>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2.5">
              <span className="text-zinc-400 block text-[10px] uppercase">Last Strum</span>
              <span className={`font-bold text-base ${isStrumFlashing ? 'text-emerald-300' : 'text-zinc-300'}`}>
                {lastStrum}
              </span>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2.5">
              <span className="text-zinc-400 block text-[10px] uppercase">Left Hand (Chords)</span>
              <span className="text-emerald-400 font-bold">
                {cameraActive
                  ? handsDetected.Left
                    ? `Active (${fingerCount} fingers)`
                    : 'Searching...'
                  : `Virtual (${fingerCount} fingers)`}
              </span>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2.5">
              <span className="text-zinc-400 block text-[10px] uppercase">Right Hand (Strum)</span>
              <span className="text-emerald-400 font-bold">
                {cameraActive
                  ? handsDetected.Right
                    ? 'Tracking Wrist'
                    : 'Searching...'
                  : 'Interactive Cursor'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-950/60 bg-[#0a0f0c] px-6 py-3 text-center text-xs text-emerald-500/70">
        AirGuitar Instrument • MediaPipe Computer Vision & Web Audio • Real-Time Chord & Strum Detection
      </footer>
    </div>
  );
}
