(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "joynexa-console-games-v1";
  const CONTROLLER_KEY = "joynexa-controller-settings-v1";
  const DEFAULT_CONTROLLER = { profile: "generic", confirm: 0, back: 1, dpad: true, scale: "100" };
  let controllerConfig = loadControllerConfig();

  function loadControllerConfig() {
    try { return { ...DEFAULT_CONTROLLER, ...JSON.parse(localStorage.getItem(CONTROLLER_KEY) || "{}") }; }
    catch { return { ...DEFAULT_CONTROLLER }; }
  }

  function saveControllerConfig() {
    const profile = $("#controller-profile").value;
    const confirm = Number($("#confirm-button").value);
    const back = Number($("#back-button").value);
    const scale = $("#ui-scale").value;
    controllerConfig = { profile, confirm, back, scale, dpad: true };
    try { localStorage.setItem(CONTROLLER_KEY, JSON.stringify(controllerConfig)); }
    catch { notify("Could not save controller settings."); return; }
    applyScale();
    updateProfileLabels();
    notify("Controller settings saved.");
  }

  function applyScale() {
    document.documentElement.style.setProperty("--ui-scale", controllerConfig.scale || "100");
    $("#ui-scale-value").textContent = (controllerConfig.scale || "100") + "%";
  }

  function updateProfileLabels() {
    const names = { xbox: "Xbox layout", playstation: "PlayStation layout", generic: "Generic / DirectInput" };
    $("#profile-summary").textContent = names[controllerConfig.profile] || names.generic;
  }

  function loadControllerSettingsUI() {
    $("#controller-profile").value = controllerConfig.profile;
    $("#confirm-button").value = String(controllerConfig.confirm);
    $("#back-button").value = String(controllerConfig.back);
    $("#ui-scale").value = controllerConfig.scale || "100";
    applyScale();
    updateProfileLabels();
  }
  const isNativeHost = () => Boolean(window.chrome?.webview || window.joynexaAndroid || window.pywebview?.api);
  const hostPlatformName = () => window.joynexaAndroid ? "Android" : window.pywebview?.api ? "Linux" : "Windows";
  function postHostMessage(message) {
    if (window.chrome?.webview) { window.chrome.webview.postMessage(message); return; }
    if (window.joynexaAndroid?.postMessage) { window.joynexaAndroid.postMessage(JSON.stringify(message)); return; }
    if (window.pywebview?.api?.handle_message) {
      window.pywebview.api.handle_message(JSON.stringify(message))
        .then(response => { if (response) window.joynexaHostMessage(response); })
        .catch(() => notify("The Linux host could not complete that action."));
    }
  }
  let nativeGames = [];
  const views = ["home", "library", "settings"];
  let activeView = "home";
  let focusedIndex = 0;
  let lastPadButtons = [];
  let lastAxisDirection = 0;
  let toastTimer;

  function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function showView(name) {
    if (!views.includes(name)) return;
    activeView = name;
    views.forEach(view => {
      const section = $(`#${view}-view`);
      section.hidden = view !== name;
      section.classList.toggle("active", view === name);
    });
    $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === name));
    focusedIndex = 0;
    focusCurrent();
  }

  function currentControls() {
    const view = $(`#${activeView}-view`);
    return $$("button:not(:disabled)", view).filter(el => el.offsetParent !== null);
  }

  function focusCurrent() {
    const controls = currentControls();
    if (!controls.length) return;
    focusedIndex = Math.max(0, Math.min(focusedIndex, controls.length - 1));
    controls[focusedIndex].focus({preventScroll:true});
  }

  function moveFocus(delta) {
    const controls = currentControls();
    if (!controls.length) return;
    focusedIndex = (focusedIndex + delta + controls.length) % controls.length;
    focusCurrent();
  }

  function getGames() {
    try {
      const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(games) ? games.filter(g => typeof g.name === "string") : [];
    } catch { return []; }
  }

  function saveGames(games) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(games)); }
    catch { notify("Browser storage is unavailable."); }
  }

  function renderGames() {
    const grid = $("#game-grid");
    const games = getGames();
    grid.replaceChildren();
    if (!games.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>Your library is waiting.</strong><br>Add a game title to start your collection.";
      grid.append(empty);
      return;
    }
    games.forEach((game, index) => {
      const card = document.createElement("article");
      card.className = "game-card";
      const title = document.createElement("strong");
      title.textContent = game.name;
      const meta = document.createElement("small");
      meta.textContent = "Demo entry · browser only";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove from library";
      remove.addEventListener("click", () => {
        const next = getGames();
        next.splice(index, 1);
        saveGames(next);
        renderGames();
        notify("Removed from library.");
      });
      card.append(title, meta, remove);
      grid.append(card);
    });
  }

  function addGame() {
    if (isNativeHost()) { postHostMessage({type:"pick-game"}); return; }
    const name = window.prompt("Enter the game title:");
    if (name === null) return;
    const clean = name.trim().slice(0, 80);
    if (!clean) { notify("Enter a game title first."); return; }
    const games = getGames();
    if (games.some(game => game.name.toLowerCase() === clean.toLowerCase())) {
      notify("That title is already in your library.");
      return;
    }
    games.push({name:clean});
    saveGames(games);
    renderGames();
    notify("Added to your library.");
  }

  function activate(element) {
    if (!element) return;
    if (element.dataset.view) showView(element.dataset.view);
    else if (element.dataset.action === "open-library") showView("library");
    else if (element.dataset.action === "add-game") addGame();
    else if (element.dataset.action === "fullscreen") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => notify("Fullscreen request was blocked."));
      else document.exitFullscreen?.();
    } else if (element.dataset.action === "help") {
      notify("D-pad / arrows move · A / Enter selects · B / Esc goes back.");
    } else if (element.dataset.action === "exit-console" && isNativeHost()) {
      postHostMessage({type:"exit-console"});
    } else element.click();
  }

  document.addEventListener("click", event => {
    const control = event.target.closest("[data-view], [data-action]");
    if (!control) return;
    if (control.dataset.view) showView(control.dataset.view);
    else if (control.dataset.action === "open-library") showView("library");
    else if (control.dataset.action === "add-game") addGame();
    else if (control.dataset.action === "fullscreen") activate(control);
    else if (control.dataset.action === "help") activate(control);
    else if (control.dataset.action === "exit-console" && isNativeHost()) activate(control);
  });

  document.addEventListener("keydown", event => {
    if (event.target.matches("input,textarea")) return;
    if (["ArrowDown","ArrowRight"].includes(event.key)) { event.preventDefault(); moveFocus(1); }
    else if (["ArrowUp","ArrowLeft"].includes(event.key)) { event.preventDefault(); moveFocus(-1); }
    else if (event.key === "Escape" && activeView !== "home") { event.preventDefault(); showView("home"); }
  });

  function connectedPads() {
    return [...(navigator.getGamepads?.() || [])].filter(Boolean);
  }

  function updateControllerStatus() {
    const pads = connectedPads();
    const label = pads.length ? `${pads.length} controller${pads.length === 1 ? "" : "s"} connected` : "No controller detected";
    $("#controller-status").textContent = label;
    $("#controller-count").textContent = `${pads.length} connected`;
    $("#controller-detail").textContent = pads.length ? pads.map(p => p.id).join(" · ") : "Connect a USB or Bluetooth controller, then press any button.";
    $(".status-dot").classList.toggle("connected", pads.length > 0);
  }


  window.joynexaHostMessage = raw => {
    let message;
    try { message = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { notify("Could not read a message from the native host."); return; }
    if (message.type === "library") {
      nativeGames = Array.isArray(message.games) ? message.games : [];
      const grid = $("#game-grid");
      grid.replaceChildren();
      if (!nativeGames.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = "<strong>Your library is waiting.</strong><br>Select Add a game to choose an application.";
        grid.append(empty);
        return;
      }
      nativeGames.forEach(game => {
        const card = document.createElement("article");
        card.className = "game-card";
        const title = document.createElement("strong");
        title.textContent = game.name;
        const meta = document.createElement("small");
        meta.textContent = "Registered " + hostPlatformName() + " application";
        const launch = document.createElement("button");
        launch.type = "button";
        launch.textContent = "Launch game →";
        launch.addEventListener("click", () => postHostMessage({type:"launch-game", id:game.id}));
        card.append(title, meta, launch);
        grid.append(card);
      });
    } else if (message.type === "host-error") {
      notify(message.message || "Native host error.");
    }
  };

  function pollGamepads() {
    const pad = connectedPads()[0];
    if (pad) {
      const pressed = pad.buttons.map(button => button.pressed);
      const justPressed = index => Boolean(pressed[index] && !lastPadButtons[index]);
      if (justPressed(12) || justPressed(15)) moveFocus(1);
      if (justPressed(13) || justPressed(14)) moveFocus(-1);
      if (justPressed(0)) activate(document.activeElement);
      if (justPressed(1)) activeView === "home" ? notify("You are already at Home.") : showView("home");
      lastPadButtons = pressed;
      const axis = pad.axes[1] || 0;
      const direction = axis > .65 ? 1 : axis < -.65 ? -1 : 0;
      if (direction && direction !== lastAxisDirection) moveFocus(direction);
      lastAxisDirection = direction;
    } else {
      lastPadButtons = [];
      lastAxisDirection = 0;
    }
    requestAnimationFrame(pollGamepads);
  }

  $("#save-controller-settings").addEventListener("click", saveControllerConfig);
  $("#ui-scale").addEventListener("input", event => {
    $("#ui-scale-value").textContent = event.target.value + "%";
  });
  $("#controller-profile").addEventListener("change", event => {
    const presets = { xbox: [0, 1], playstation: [0, 1], generic: [0, 1] };
    const [confirm, back] = presets[event.target.value] || presets.generic;
    $("#confirm-button").value = String(confirm);
    $("#back-button").value = String(back);
    updateProfileLabels();
  });

  window.addEventListener("gamepadconnected", updateControllerStatus);
  window.addEventListener("gamepaddisconnected", updateControllerStatus);
  function updateClock() {
    $("#clock").textContent = new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date());
  }
  if (window.chrome?.webview) {
    window.chrome.webview.addEventListener("message", event => window.joynexaHostMessage(event.data));
    postHostMessage({type:"get-library"});
  } else if (window.joynexaAndroid || window.pywebview?.api) {
    postHostMessage({type:"get-library"});
  } else {
    renderGames();
    window.addEventListener("pywebviewready", () => postHostMessage({type:"get-library"}), {once:true});
  }
  updateControllerStatus();
  updateClock();
  setInterval(updateClock, 30000);
  requestAnimationFrame(pollGamepads);
})();