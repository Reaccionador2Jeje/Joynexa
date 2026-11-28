# Joynexa Input Hub

Joynexa Input Hub provides one browser-side input interface for games that need to support physical controllers, keyboards and virtual touch buttons.

## Supported input sources

- USB and Bluetooth gamepads exposed through the browser Gamepad API.
- Standard Gamepad mapping where the operating system/browser provides it.
- Keyboard fallback: arrows or WASD for directions, Space/Z for A, X for B, Q/E for shoulder buttons, Enter for Start and Escape for Select.
- Touch buttons through the same normalized button names.
- Multiple connected pads can contribute input; the strongest active stick vector is selected to avoid combining noisy axes.
- Configurable analog deadzone through `setDeadzone(value)`.
- Optional dual-rumble / pulse feedback when the browser exposes a compatible actuator.
- Generic mappings fall back to button indexes and can be customized with the `buttonMap` constructor option.

This is browser capability detection, not a guarantee that every controller works on every device. Some low-cost generic pads report vendor-specific layouts or require OS-level pairing. The test page at `/controllers.html` displays the mapping exposed by the browser.

## Add it to a game

Load the helper before the game script:

```html
<script src="/joynexa-input.js"></script>
<script>
  const input = new JoynexaInput.JoynexaInput({ deadzone: 0.18 });
  input.setDeadzone(0.2); // optional, from 0 to 0.8
  input.addEventListener("button", ({ detail }) => {
    if (detail.name === "a" && detail.pressed) player.jump();
  });
  input.addEventListener("frame", ({ detail }) => {
    player.move(detail.axes.leftX, detail.axes.leftY);
  });
  input.start();
</script>
```

Call `input.stop()` when the game is disposed. Use `input.setTouchButton("a", true)` and `input.setTouchButton("a", false)` to bridge custom touch UI into the same input stream. The built-in tester demonstrates pointer handling.

## Security and privacy

Input is read locally in the browser. The helper does not transmit controller IDs, button presses or axis values to Joynexa servers. Avoid collecting controller fingerprints or raw input telemetry. Treat input as untrusted game input and validate all game actions server-side when they affect online state, rankings, rewards or achievements.

## Browser notes

The Gamepad API is available in secure contexts in supported browsers. A user gesture (pressing a controller button) may be required before a controller appears. Vibration is optional and may be unavailable even when the controller is connected. Touch controls are a fallback and do not emulate a physical device at the operating-system level.
