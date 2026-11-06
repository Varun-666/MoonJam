# AirGuitar — Real-Time Computer Vision Instrument

AirGuitar is a Python webcam project that tracks hands with MediaPipe, maps a simple left-hand pose to a chord, detects right-hand wrist motion across a virtual strum zone, and plays local WAV samples.

## Current prototype

- Tracks up to two hands using MediaPipe Hands (21 landmarks per hand).
- Shows camera preview, landmarks, chord, last strum, hand status and FPS.
- Maps a simple finger-count heuristic to four demo chords: `C`, `G`, `Am`, `Em`.
- Detects `UP` and `DOWN` wrist crossings with a cooldown.
- Includes original synthesized placeholder chord samples. They are useful for testing the pipeline, but are not realistic guitar recordings.
- No custom dataset or trained classifier is needed for the first version.

**Important:** chord selection is currently a demo gesture mapping, not real guitar fingering. Handedness labels may feel reversed because the camera preview is mirrored. The app uses the labels MediaPipe returns; use the on-screen hand indicators and test which hand is assigned to each role.

## Requirements

- 64-bit Windows, macOS, or Linux
- Python 3.12 recommended (64-bit)
- Webcam
- 8 GB RAM recommended
- Good, even lighting

## Windows setup (PowerShell)

From the folder containing `main.py`:

```powershell
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
python main.py
```

If PowerShell blocks activation, use this session-only workaround:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

If `py -3.12` is unavailable, run `py -0p` to see installed Python versions. Create the environment with the exact version shown.

## Controls

- Stand with both hands visible and keep them separated enough for the camera to distinguish them.
- The hand labelled `Left` selects the demo chord by the number of extended fingers.
- Move the hand labelled `Right` across the green horizontal line to strum.
- Press `Q` or `Esc` while the camera window is focused to exit.

## Project layout

```text
AirGuitar/
├── main.py
├── requirements.txt
├── README.md
├── audio/                  # WAV samples used by the audio engine
├── data/                   # Optional collected landmark CSVs
├── models/                 # Optional trained model artifacts
├── notebooks/              # Space for experiments
└── src/
    ├── app.py              # Main application loop / integration
    ├── hand_tracker.py     # MediaPipe hand detection and landmarks
    ├── chord_detector.py   # Rule-based demo chord recognition
    ├── strum_detector.py   # Wrist motion, direction and cooldown
    ├── audio_engine.py     # Pygame sample loading/playback
    └── ui.py               # On-screen HUD
```

## Troubleshooting

- **No webcam:** close apps using the camera; try changing `camera_index=0` in `main.py` to `1`.
- **No sound:** check OS output volume and ensure `audio/` contains the WAV files. Restart after changing audio devices.
- **Hands missing:** improve lighting, bring hands fully into frame, and avoid overlapping them.
- **Lag / low FPS:** reduce webcam resolution in `src/app.py` to 640×480.
- **Install errors:** use a fresh Python 3.12 virtual environment and install the pinned requirements.

## Next development milestones

1. Validate camera + two-hand detection.
2. Improve chord pose logic and add calibration.
3. Tune strum thresholds and audio latency.
4. Add a CSV landmark recorder with chord labels.
5. Train and evaluate a classifier only after collecting useful examples.
6. Replace placeholder sounds with licensed/recorded guitar samples.

## Data and licensing

The bundled WAV samples are procedurally synthesized for this project. If replacing them with recordings from an external sample pack, verify the license permits use and redistribution before committing them.
