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

## Next engineering steps
1. Add a native Windows shell/launcher host.
2. Enumerate installed games through explicit, user-approved library paths.
3. Implement real process launching with argument validation and safe exit handling.
4. Add controller mapping profiles and per-game configuration.
5. Add startup integration only after the native host is stable.
