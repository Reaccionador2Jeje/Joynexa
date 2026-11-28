(function (root) {
  "use strict";
  const BUTTONS=["a","b","x","y","lb","rb","lt","rt","select","start","ls","rs","up","down","left","right","home"];
  const KEYS={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",W:"up",s:"down",S:"down",a:"left",A:"left",d:"right",D:"right",Enter:"start",Escape:"select"," ":"a",z:"a",Z:"a",x:"b",X:"b",q:"lb",Q:"lb",e:"rb",E:"rb"};
  const STANDARD={a:0,b:1,x:2,y:3,lb:4,rb:5,lt:6,rt:7,select:8,start:9,ls:10,rs:11,up:12,down:13,left:14,right:15,home:16};
  class JoynexaInput extends EventTarget {
    constructor(options={}) {
      super(); this.deadzone=Math.min(.8,Math.max(0,Number(options.deadzone??.18)));
      this.buttonMap={...STANDARD,...(options.buttonMap||{})}; this.buttons=Object.fromEntries(BUTTONS.map(n=>[n,false]));
      this.axes={leftX:0,leftY:0,rightX:0,rightY:0};this.connected=[];this.keys=new Set();this.touch=new Set();this.running=false;this._raf=0;
      this._onConnect=e=>{this._refreshPads();this.dispatchEvent(new CustomEvent("connect",{detail:{id:e.gamepad.id,index:e.gamepad.index}}));};
      this._onDisconnect=e=>{this._refreshPads();this.dispatchEvent(new CustomEvent("disconnect",{detail:{id:e.gamepad.id,index:e.gamepad.index}}));};
      this._onKeyDown=e=>{const n=KEYS[e.key];if(!n||e.repeat)return;this.keys.add(n);if(["up","down","left","right","a","b","start","select"].includes(n))e.preventDefault();};
      this._onKeyUp=e=>{const n=KEYS[e.key];if(n)this.keys.delete(n);};
      this._onBlur=()=>{this.keys.clear();this.touch.clear();};
      this._refreshPads();
    }
    setDeadzone(value){this.deadzone=Math.min(.8,Math.max(0,Number(value)||0));return this.deadzone;}
    setButtonMap(map){this.buttonMap={...this.buttonMap,...map};}
    _refreshPads(){this.connected=Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(Boolean);}
    _axis(value){const v=Number(value)||0;if(Math.abs(v)<this.deadzone)return 0;return Number((Math.sign(v)*(Math.abs(v)-this.deadzone)/(1-this.deadzone)).toFixed(3));}
    _poll(){
      this._refreshPads();const next=Object.fromEntries(BUTTONS.map(n=>[n,this.keys.has(n)||this.touch.has(n)]));
      const axes={leftX:0,leftY:0,rightX:0,rightY:0};
      // Merge pressed buttons across connected pads so a second controller can also play.
      for(const pad of this.connected){
        const map=pad.mapping==="standard"?STANDARD:this.buttonMap;
        for(const [name,index] of Object.entries(map)){if(index>=0&&pad.buttons[index])next[name] ||= Boolean(pad.buttons[index].pressed||(pad.buttons[index].value??0)>.5);}
        if(pad.axes.length>=2){
          const lx=this._axis(pad.axes[0]),ly=this._axis(pad.axes[1]);
          if(Math.hypot(lx,ly)>Math.hypot(axes.leftX,axes.leftY)){axes.leftX=lx;axes.leftY=ly;}
          if(pad.axes.length>=4){const rx=this._axis(pad.axes[2]),ry=this._axis(pad.axes[3]);if(Math.hypot(rx,ry)>Math.hypot(axes.rightX,axes.rightY)){axes.rightX=rx;axes.rightY=ry;}}
          if(pad.axes[0]<-.55)next.left=true;if(pad.axes[0]>.55)next.right=true;if(pad.axes[1]<-.55)next.up=true;if(pad.axes[1]>.55)next.down=true;
        }
      }
      for(const [name,pressed] of Object.entries(next))if(pressed!==this.buttons[name])this.dispatchEvent(new CustomEvent("button",{detail:{name,pressed}}));
      if(Object.keys(axes).some(k=>axes[k]!==this.axes[k]))this.dispatchEvent(new CustomEvent("axes",{detail:axes}));
      this.buttons=next;this.axes=axes;this.dispatchEvent(new CustomEvent("frame",{detail:this.snapshot()}));
      if(this.running)this._raf=requestAnimationFrame(()=>this._poll());
    }
    snapshot(){return{buttons:{...this.buttons},axes:{...this.axes},connected:this.connected.map(p=>({id:p.id,index:p.index,mapping:p.mapping,buttons:p.buttons.length,axes:p.axes.length}))};}
    start(){if(this.running)return this;this.running=true;window.addEventListener("gamepadconnected",this._onConnect);window.addEventListener("gamepaddisconnected",this._onDisconnect);window.addEventListener("keydown",this._onKeyDown,{passive:false});window.addEventListener("keyup",this._onKeyUp);window.addEventListener("blur",this._onBlur);document.addEventListener("visibilitychange",this._onBlur);this._poll();return this;}
    stop(){this.running=false;cancelAnimationFrame(this._raf);window.removeEventListener("gamepadconnected",this._onConnect);window.removeEventListener("gamepaddisconnected",this._onDisconnect);window.removeEventListener("keydown",this._onKeyDown);window.removeEventListener("keyup",this._onKeyUp);window.removeEventListener("blur",this._onBlur);document.removeEventListener("visibilitychange",this._onBlur);this._onBlur();return this;}
    setTouchButton(name,pressed){if(!BUTTONS.includes(name))return;if(pressed)this.touch.add(name);else this.touch.delete(name);}
    async vibrate(duration=140,weak=.35,strong=.55,index=null){
      const pads=index===null?this.connected:[this.connected.find(p=>p.index===index)].filter(Boolean);
      for(const pad of pads){const actuator=pad.vibrationActuator||pad.hapticActuators?.[0];if(!actuator)continue;try{if(actuator.playEffect)await actuator.playEffect("dual-rumble",{duration:Math.max(0,Math.min(500,duration)),weakMagnitude:Math.max(0,Math.min(1,weak)),strongMagnitude:Math.max(0,Math.min(1,strong))});else if(actuator.pulse)await actuator.pulse(strong,duration);else continue;return true;}catch{}}
      return false;
    }
  }
  root.JoynexaInput={JoynexaInput,buttons:BUTTONS.slice()};
})(typeof window!=="undefined"?window:globalThis);
