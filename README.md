# Eye Focus Controller

A browser-based focus assistant that uses the webcam plus MediaPipe Face Mesh to track whether the user is looking at the screen, yawning, or closing their eyes. It provides live metrics, audible/visual alerts, Picture-in-Picture (PiP) for background monitoring, and session statistics.

## Features
- Head orientation monitoring with yaw/pitch thresholds and confidence scoring.
- Eye closure detection (EAR) and mouth/yawn detection (MAR) with on-screen warnings.
- Live metrics panel, debug face-mesh overlay, and PiP toggle for multitasking.
- Focus state tracker with min/avg/max focus session stats and attention span.
- Custom alert upload: loop your own audio or video instead of the default beep.

## Requirements
- Desktop Chrome/Edge/Firefox with webcam access. Camera permissions are required.
- Serve the files from `localhost` or a local server (camera APIs are blocked on `file://`).
- Internet access to load MediaPipe from jsDelivr.

## Quick Start
1. Clone or download the repository.
2. Start a simple local server in the project root (examples):
   - Python 3: `python -m http.server 8000`
   - Node: `npx serve .`
3. Open `http://localhost:8000` in a supported browser.
4. Allow camera access when prompted.
5. Click **Start Tracking** to begin. Use **Reset Stats** to clear the session.

## Usage Notes
- **PiP**: After starting, click **Enable PiP** to keep the video visible when switching tabs; PiP also keeps realtime detection active.
- **Debug View**: Toggle **Show Debug View** to draw landmark points for troubleshooting.
- **Custom Alerts**: Use **Choose File** to load an audio or video clip; **Clear** returns to the default beep. Video alerts appear in the top-right overlay.
- **Warnings**: "YOU ARE SLEEPY" shows on yawns; "WAKE UP!" shows when eyes stay closed; "No face detected" appears after brief absence.

## Tuning & Internals
- Detection thresholds live in [js/detector.js](js/detector.js):
  - `YAW_MAX` (±25°), `PITCH_MAX` (±20°), `YAWN_MAR` (0.55), `EYE_CLOSED_EAR` (0.18).
  - Debounce windows: yawns (800 ms), eyes closed (1500 ms).
- Focus state machine and session stats are in [js/focus-tracker.js](js/focus-tracker.js).
- UI controls and overlays are handled in [js/ui.js](js/ui.js); audio/video alert handling is in [js/audio.js](js/audio.js).

## Troubleshooting
- **Camera permission denied**: Re-enable camera access in browser settings and reload.
- **No camera found**: Connect a webcam or switch to a device with a camera.
- **Alerts not audible**: Ensure system volume is up; custom media must be playable by the browser.
- **Model not loading**: Confirm internet access to jsDelivr CDN; refresh and retry.

## Privacy
All processing runs locally in your browser; no video or metrics are sent to a server.
