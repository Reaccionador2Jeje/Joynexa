/* Joynexa Input SDK — keyboard, touch and generic Gamepad API support. */
(() => {
  "use strict";
  const ACTIONS = ["up","down","left","right","a","b","x","y","start","select","l1","r1"];
  const KEY_MAP = {
    ArrowUp:"up", KeyW:"up", ArrowDown:"down", KeyS:"down",
    ArrowLeft:"left", KeyA:"left", ArrowRight:"right", KeyD:"right",
    Space:"a", Enter:"start", Escape:"select", KeyJ:"a", KeyK:"b",
    KeyU:"x", KeyI:"y", KeyQ:"l1", KeyE:"r1"
  };
  const BUTTON_MAP = {0:"a",1:"b",2:"x",3:"y",4:"l1",5:"r1",8:"select",9:"start",12:"up",13:"down",14:"left",15:"right"};
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  class JoynexaInput extends EventTarget {
    constructor(options = {}) {
      super();
      this.options = { deadzone:0.18, touchControls:false, target:document.body, ...options };
      this.state = Object.fromEntries(ACTIONS.map(action => [action,false]));
      this.axes = {x:0,y:0};
      this.controllers = new Map();
      this.keys = new Set();
      this.running = false;
      this.frame = 0;
      this.touchLayer = null;
      this._keyDown = event => {
        const action = KEY_MAP[event.code];
        if (!action) return;
        if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
        this._set(action,true,"keyboard");
      };
      this._keyUp = event => {
        const action = KEY_MAP[event.code];
        if (action) this._set(action,false,"keyboard");
      };
      this._connect = event => {
        this.controllers.set(event.gamepad.index,{id:event.gamepad.id,mapping:event.gamepad.mapping||"unknown"});
        this.dispatchEvent(new CustomEvent("controllerchange",{detail:this.getControllers()}));
      };
      this._disconnect = event => {
        this.controllers.delete(event.gamepad.index);
        this.dispatchEvent(new CustomEvent("controllerchange",{detail:this.getControllers()}));
        this._releaseAll("controller");
      };
    }
    start() {
      if (this.running) return this;
      this.running = true;
      window.addEventListener("keydown",this._keyDown);
      window.addEventListener("keyup",this._keyUp);
      window.addEventListener("blur",()=>this._releaseAll("window"));
      window.addEventListener("gamepadconnected",this._connect);
      window.addEventListener("gamepaddisconnected",this._disconnect);
      this._poll();
      if (this.options.touchControls) this.enableTouchControls();
      return this;
    }
    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      window.removeEventListener("keydown",this._keyDown);
      window.removeEventListener("keyup",this._keyUp);
      window.removeEventListener("gamepadconnected",this._connect);
      window.removeEventListener("gamepaddisconnected",this._disconnect);
      this.disableTouchControls();
      this._releaseAll("stop");
    }
    getControllers() {
      return Array.from(this.controllers.entries()).map(([index,item])=>({index,...item}));
    }
    getState() { return {...this.state,axes:{...this.axes}}; }
    _set(action,pressed,source) {
      if (!(action in this.state) || this.state[action]===pressed) return;
      this.state[action]=pressed;
      this.dispatchEvent(new CustomEvent(pressed?"inputdown":"inputup",{detail:{action,source,state:this.getState()}}));
      this.dispatchEvent(new CustomEvent("inputchange",{detail:{action,pressed,source,state:this.getState()}}));
    }
    _releaseAll(source) { for (const action of ACTIONS) this._set(action,false,source); }
    _poll() {
      if (!this.running) return;
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const active = new Set();
      for (const pad of pads) {
        active.add(pad.index);
        if (!this.controllers.has(pad.index)) {
          this.controllers.set(pad.index,{id:pad.id,mapping:pad.mapping||"unknown"});
          this.dispatchEvent(new CustomEvent("controllerchange",{detail:this.getControllers()}));
        }
        const pressed = new Set();
        const axisX = pad.axes?.[0] || 0, axisY = pad.axes?.[1] || 0;
        const dz = this.options.deadzone;
        if (axisY < -dz) pressed.add("up");
        if (axisY > dz) pressed.add("down");
        if (axisX < -dz) pressed.add("left");
        if (axisX > dz) pressed.add("right");
        (pad.buttons||[]).forEach((button,index)=>{if(button.pressed || button.value>0.55){const action=BUTTON_MAP[index];if(action)pressed.add(action)}});
        for (const action of ACTIONS) this._set(action,pressed.has(action),"gamepad");
        this.axes={x:Math.abs(axisX)<dz?0:clamp(axisX,-1,1),y:Math.abs(axisY)<dz?0:clamp(axisY,-1,1)};
      }
      for (const index of this.controllers.keys()) if(!active.has(index)) this.controllers.delete(index);
      this.frame=requestAnimationFrame(()=>this._poll());
    }
    enableTouchControls() {
      if (this.touchLayer || !this.options.target) return;
      const layer=document.createElement("div");
      layer.className="joynexa-touch-controls";
      layer.setAttribute("aria-label","Controles táctiles de Joynexa");
      layer.innerHTML='<style>.joynexa-touch-controls{position:fixed;inset:auto 0 16px;z-index:2147483000;display:flex;justify-content:space-between;align-items:end;padding:0 18px;pointer-events:none;touch-action:none;font:600 14px system-ui}.jn-pad,.jn-actions{display:grid;gap:7px;pointer-events:auto}.jn-pad{grid-template:repeat(2,48px)/repeat(3,48px)}.jn-actions{grid-template:repeat(2,54px)/repeat(2,54px);transform:rotate(-8deg)}.jn-touch{border:1px solid #ffffff66;border-radius:15px;background:#18213ddd;color:white;font:700 18px system-ui;box-shadow:0 4px 14px #0005;touch-action:none;user-select:none}.jn-touch:active,.jn-touch.active{background:#6557e8}.jn-empty{visibility:hidden}@media(pointer:fine){.joynexa-touch-controls{display:none}}</style><div class="jn-pad"><span class="jn-empty"></span><button class="jn-touch" data-action="up" aria-label="Arriba">▲</button><span class="jn-empty"></span><button class="jn-touch" data-action="left" aria-label="Izquierda">◀</button><button class="jn-touch" data-action="down" aria-label="Abajo">▼</button><button class="jn-touch" data-action="right" aria-label="Derecha">▶</button></div><div class="jn-actions"><button class="jn-touch" data-action="x">X</button><button class="jn-touch" data-action="y">Y</button><button class="jn-touch" data-action="b">B</button><button class="jn-touch" data-action="a">A</button></div>';
      this.options.target.append(layer); this.touchLayer=layer;
      layer.querySelectorAll("[data-action]").forEach(button=>{
        const action=button.dataset.action;
        const down=event=>{event.preventDefault();button.classList.add("active");button.setPointerCapture?.(event.pointerId);this._set(action,true,"touch")};
        const up=event=>{event.preventDefault();button.classList.remove("active");this._set(action,false,"touch")};
        button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);
        button.addEventListener("pointercancel",up);button.addEventListener("lostpointercapture",up);
      });
    }
    disableTouchControls(){this.touchLayer?.remove();this.touchLayer=null;}
    vibrate(duration=80){const pad=navigator.getGamepads?.().find(Boolean);try{pad?.vibrationActuator?.playEffect?.("dual-rumble",{duration,strongMagnitude:0.35,weakMagnitude:0.2})}catch{}}
  }
  window.JoynexaInput = JoynexaInput;
  window.JoynexaInputActions = ACTIONS.slice();
})();