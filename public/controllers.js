(() => {
  const input = new JoynexaInput.JoynexaInput().start();
  const status = document.getElementById("status");
  const devices = document.getElementById("devices");
  const state = document.getElementById("button-state");
  const activeCount = document.getElementById("active-count");
  const touchToggle = document.getElementById("touch-toggle");
  const touchControls = document.getElementById("touch-controls");
  const names = JoynexaInput.buttons;
  function renderDevices() {
    const pads = input.snapshot().connected;
    status.textContent = pads.length ? pads.length + " mando(s) conectado(s)" : "Esperando conexión";
    devices.innerHTML = "";
    if (!pads.length) {
      devices.innerHTML = '<p class="muted">No hay mandos detectados. Conecta uno por Bluetooth o USB y pulsa un botón.</p>';
      return;
    }
    pads.forEach((pad) => {
      const item = document.createElement("article");
      item.className = "device";
      const title = document.createElement("b");
      title.textContent = pad.id || "Mando sin nombre";
      const detail = document.createElement("small");
      detail.textContent = "Índice " + pad.index + " · " + (pad.mapping || "mapeo genérico");
      item.append(title, detail);
      devices.append(item);
    });
  }
  function renderButtons(snapshot) {
    state.innerHTML = "";
    let count = 0;
    names.forEach((name) => {
      const active = Boolean(snapshot.buttons[name]);
      if (active) count++;
      const chip = document.createElement("span");
      chip.textContent = name.toUpperCase();
      chip.classList.toggle("active", active);
      state.append(chip);
      document.querySelectorAll('[data-input="' + name + '"]').forEach((button) => button.classList.toggle("active", active));
    });
    activeCount.textContent = count + " botones activos";
    const left = document.getElementById("left-stick");
    const right = document.getElementById("right-stick");
    left.style.transform = "translate(" + (snapshot.axes.leftX * 28) + "px," + (snapshot.axes.leftY * 28) + "px)";
    right.style.transform = "translate(" + (snapshot.axes.rightX * 28) + "px," + (snapshot.axes.rightY * 28) + "px)";
  }
  input.addEventListener("frame", (event) => { renderButtons(event.detail); renderDevices(); });
  input.addEventListener("connect", renderDevices);
  input.addEventListener("disconnect", renderDevices);
  document.getElementById("scan").addEventListener("click", renderDevices);
  touchToggle.addEventListener("change", () => touchControls.classList.toggle("enabled", touchToggle.checked));
  document.querySelectorAll("[data-touch]").forEach((button) => {
    const name = button.dataset.touch;
    const down = (event) => { event.preventDefault(); input.setTouchButton(name, true); button.classList.add("active"); };
    const up = () => { input.setTouchButton(name, false); button.classList.remove("active"); };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  });
  renderDevices();
})();
