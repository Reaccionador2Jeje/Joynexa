# Joynexa Input SDK

Joynexa Input is a small browser-side input layer for games published in Joynexa. It normalizes keyboard, touch and standard Gamepad API input into the same action names.

## Compatibility goals

- Android phones and tablets using a browser with Gamepad API support.
- Bluetooth and USB HID controllers that Android or the computer recognizes as game controllers.
- Generic USB/Bluetooth pads using the standard browser gamepad mapping.
- Keyboard controls on desktop.
- Optional on-screen touch controls for portrait/landscape mobile play.

A controller must first pair with the device / be recognized by its operating system. Joynexa cannot make an unsupported controller compatible by software alone. Generic pads with non-standard layouts may need an in-game remapping screen; rumble is optional and depends on both browser and hardware.

## Add to a game

Load `/joynexa-input.js` from the Joynexa site or bundle a reviewed copy with your game:

```html
<script src="https://joynexa.example/joynexa-input.js"></script>
<script>
  const input = new JoynexaInput({ touchControls: true }).start();
  input.addEventListener("inputchange", ({ detail }) => {
    // detail.action: up, down, left, right, a, b, x, y, start, select, l1, r1
    // detail.pressed: true / false
    // Apply the action to your game's own input system.
  });
</script>
```

Replace the example host with the actual Joynexa deployment origin. For a game bundled on the same origin, use `/joynexa-input.js`.

## Events and API

- `start()` / `stop()`
- `getState()` — current normalized button state and analog axes.
- `getControllers()` — connected controller metadata.
- `inputdown`, `inputup`, `inputchange`
- `controllerchange`
- `enableTouchControls()` / `disableTouchControls()`
- `vibrate(milliseconds)` — best-effort optional rumble.

Keyboard defaults: WASD / arrows, Space (A), Enter (Start), Escape (Select), J/K/U/I (A/B/X/Y), Q/E (L1/R1).

## Important iframe boundary

The parent Joynexa Play page cannot inject controller or touch events into an unrelated cross-origin game iframe. The game itself must support browser gamepads/touch, or its developer must integrate this SDK. Joynexa keeps external games on their original sites unless embedding is explicitly permitted by the publisher. Never enable iframe embedding without checking publisher permission.

## Testing

Open `/controller-test.html` on a phone or computer, connect a controller, press a button and verify that the controller and action indicators respond. Also test keyboard and touch controls. Test the actual game separately: browser support does not guarantee that every game implements controller input.
