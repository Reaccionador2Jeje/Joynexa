# Joynexa Console — Prototype 01

A controller-friendly, fullscreen-first launcher prototype for the Joynexa project.

## Current scope
- Responsive 10-foot interface for TV and monitor use.
- Keyboard navigation and browser Gamepad API support.
- Local game-library entries stored in the browser.
- Settings panel with controller connection status.
- Safe demo actions: this prototype does not execute arbitrary programs or claim to launch games.

## Run
Open `index.html` in a modern browser. For best Gamepad API support, serve this folder from localhost (for example, `python -m http.server 8080`) and open `http://localhost:8080/Console/`.

## Controls
- Arrow keys / D-pad: move selection
- Enter / A: activate
- Escape / B: back
- Gamepad: D-pad or left stick to navigate, A / south button to select, B / east button to go back

## Hardware target
Prototype 01 is designed to be tested on the ThinkPad Edge E430 (Intel Core i5-2520M, 4 GB RAM, 500 GB HDD) connected to a TV by HDMI. Keep visual effects lightweight.

## Controller and TV setup (0.3.0)
- Xbox-style, PlayStation-style, and generic controller presets.
- Configurable confirm/back button indices using the standard Gamepad API mapping.
- Persistent controller preferences in local browser storage.
- TV interface scale control (85–125%) for different viewing distances.
- Keyboard and D-pad navigation remain available regardless of selected profile.

## Current implementation
- Native Windows host built with .NET 8 Windows Forms and WebView2.
- Explicit executable selection through the Windows file picker.
- Local game library stored under the current user's LocalAppData.
- Launches only previously registered executable IDs; no arbitrary shell commands or webpage-supplied paths.
- Browser Gamepad API and keyboard navigation remain available.

## Next engineering steps
1. Add per-game controller overrides and richer device detection.
2. Add optional startup integration only after the native host is stable.
3. Add packaging, signing, and Windows hardware testing.
