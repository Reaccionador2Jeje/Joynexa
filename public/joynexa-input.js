(function (root) {
  "use strict";
  const BUTTONS = ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "select", "start", "ls", "rs", "up", "down", "left", "right", "home"];
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right",
    Enter: "start", Escape: "select", " ": "a", z: "a", Z: "a", x: "b", X: "b",
    q: "lb", Q: "lb", e: "rb", E: "rb"
  };

  class JoynexaInput extends EventTarget {
    constructor(options = {}) {
      super();
      this.deadzone = Math.min(0.5, Math.max(0, Number(options.deadzone ?? 0.18)));
      this.buttons = Object.fromEntries(BUTTONS.map((name) => [name, false]));
      this.axes = { leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
      this.connected = [];
      this.keys = new Set();
      this.touch = new Set();
      this.running = false;
      this._raf = 0;
      this._onConnect = (event) => {
        this._refreshPads();
        this.dispatchEvent(new CustomEvent("connect", { detail: { id: event.gamepad.id, index: event.gamepad.index } }));
      };
      this._onDisconnect = (event) => {
        this._refreshPads();
        this.dispatchEvent(new CustomEvent("disconnect", { detail: { id: event.gamepad.id, index: event.gamepad.index } }));
      };
      this._onKeyDown = (event) => {
        const name = KEYS[event.key];
        if (!name || event.repeat) return;
        this.keys.add(name);
        if (["up", "down", "left", "right", "a", "b", "start", "select"].includes(name)) event.preventDefault();
      };
      this._onKeyUp = (event) => {
        const name = KEYS[event.key];
        if (name) this.keys.delete(name);
      };
      this._refreshPads();
    }

    _refreshPads() {
      this.connected = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
    }

    _axis(value) {
      return Math.abs(value) < this.deadzone ? 0 : Number(value.toFixed(3));
    }

    _poll() {
      this._refreshPads();
      const next = Object.fromEntries(BUTTONS.map((name) => [name, this.keys.has(name) || this.touch.has(name)]));
      const axes = { leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
      const pad = this.connected.find((item) => item.mapping === "standard") || this.connected[0];
      if (pad) {
        const map = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15, home: 16 };
        for (const [name, index] of Object.entries(map)) next[name] ||= Boolean(pad.buttons[index]?.pressed || (pad.buttons[index]?.value ?? 0) > 0.5);
        axes.leftX = this._axis(pad.axes[0] || 0);
        axes.leftY = this._axis(pad.axes[1] || 0);
        axes.rightX = this._axis(pad.axes[2] || 0);
        axes.rightY = this._axis(pad.axes[3] || 0);
        if (pad.axes[0] < -0.55) next.left = true;
        if (pad.axes[0] > 0.55) next.right = true;
        if (pad.axes[1] < -0.55) next.up = true;
        if (pad.axes[1] > 0.55) next.down = true;
      }
      for (const [name, pressed] of Object.entries(next)) {
        if (pressed !== this.buttons[name]) {
          this.dispatchEvent(new CustomEvent("button", { detail: { name, pressed } }));
        }
      }
      if (Object.keys(axes).some((key) => axes[key] !== this.axes[key])) {
        this.dispatchEvent(new CustomEvent("axes", { detail: axes }));
      }
      this.buttons = next;
      this.axes = axes;
      this.dispatchEvent(new CustomEvent("frame", { detail: this.snapshot() }));
      if (this.running) this._raf = requestAnimationFrame(() => this._poll());
    }

    snapshot() {
      return { buttons: { ...this.buttons }, axes: { ...this.axes }, connected: this.connected.map((pad) => ({ id: pad.id, index: pad.index, mapping: pad.mapping })) };
    }

    start() {
      if (this.running) return this;
      this.running = true;
      window.addEventListener("gamepadconnected", this._onConnect);
      window.addEventListener("gamepaddisconnected", this._onDisconnect);
      window.addEventListener("keydown", this._onKeyDown, { passive: false });
      window.addEventListener("keyup", this._onKeyUp);
      window.addEventListener("blur", () => { this.keys.clear(); this.touch.clear(); });
      this._poll();
      return this;
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this._raf);
      window.removeEventListener("gamepadconnected", this._onConnect);
      window.removeEventListener("gamepaddisconnected", this._onDisconnect);
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("keyup", this._onKeyUp);
      this.keys.clear();
      this.touch.clear();
      return this;
    }

    setTouchButton(name, pressed) {
      if (!BUTTONS.includes(name)) return;
      if (pressed) this.touch.add(name);
      else this.touch.delete(name);
    }

    async vibrate(duration = 120, weakMagnitude = 0.35, strongMagnitude = 0.55) {
      const pad = this.connected.find((item) => item.vibrationActuator);
      if (!pad) return false;
      try {
        await pad.vibrationActuator.playEffect("dual-rumble", {
          duration: Math.max(0, Math.min(500, duration)),
          weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
          strongMagnitude: Math.max(0, Math.min(1, strongMagnitude))
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  root.JoynexaInput = { JoynexaInput, buttons: BUTTONS.slice() };
})(typeof window !== "undefined" ? window : globalThis);
