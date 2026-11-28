#!/usr/bin/env python3
"""Joynexa Console native Linux host. Requires pywebview and a desktop WebView runtime."""
from __future__ import annotations

import json
import os
import subprocess
import threading
import uuid
from pathlib import Path

import webview

DATA_DIR = Path.home() / ".local" / "share" / "atdev" / "joynexa-console"
LIBRARY_FILE = DATA_DIR / "games.json"
WEB_DIR = Path(__file__).resolve().parents[1]


class JoynexaAPI:
    def __init__(self) -> None:
        self.games: list[dict[str, str]] = []
        self.window = None
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        try:
            value = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
            if isinstance(value, list):
                self.games = [item for item in value if isinstance(item, dict) and item.get("id") and item.get("path")]
        except (OSError, json.JSONDecodeError):
            self.games = []

    def _save(self) -> None:
        temporary = LIBRARY_FILE.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.games, indent=2), encoding="utf-8")
        temporary.replace(LIBRARY_FILE)

    def _public_library(self) -> dict:
        return {"type": "library", "games": [{"id": item["id"], "name": item["name"]} for item in self.games]}

    def handle_message(self, raw: str) -> dict | None:
        """Called by the dashboard through pywebview's promise-based JS bridge."""
        try:
            message = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return {"type": "host-error", "message": "Invalid request from the dashboard."}

        action = message.get("type")
        if action == "get-library":
            return self._public_library()
        if action == "pick-game":
            return self._pick_game()
        if action == "launch-game":
            return self._launch_game(str(message.get("id", "")))
        if action == "exit-console":
            if self.window:
                self.window.destroy()
            return None
        return {"type": "host-error", "message": "Unsupported host action."}

    def _pick_game(self) -> dict:
        # Tkinter's native file chooser is available on standard Lubuntu desktop installs.
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askopenfilename(
            parent=root,
            title="Choose a Linux game or application",
            filetypes=[("Executable files", "*"), ("All files", "*")],
        )
        root.destroy()
        if not selected:
            return self._public_library()

        executable = Path(selected).expanduser().resolve()
        if not executable.is_file() or not os.access(executable, os.X_OK):
            return {"type": "host-error", "message": "Choose a file marked as executable in Linux."}

        existing = next((game for game in self.games if game["path"] == str(executable)), None)
        if existing is None:
            self.games.append({
                "id": uuid.uuid4().hex,
                "name": executable.stem,
                "path": str(executable),
            })
            self._save()
        return self._public_library()

    def _launch_game(self, game_id: str) -> dict | None:
        game = next((item for item in self.games if item["id"] == game_id), None)
        if not game:
            return {"type": "host-error", "message": "That game is not registered in the library."}
        executable = Path(game["path"])
        if not executable.is_file() or not os.access(executable, os.X_OK):
            return {"type": "host-error", "message": "The executable is missing or no longer executable."}
        try:
            process = subprocess.Popen(
                [str(executable)],
                cwd=str(executable.parent),
                stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
            if self.window:
                self.window.minimize()

            def restore_when_finished() -> None:
                process.wait()
                if self.window:
                    self.window.restore()
                    self.window.show()

            threading.Thread(target=restore_when_finished, daemon=True).start()
            return None
        except OSError as error:
            return {"type": "host-error", "message": f"Could not launch application: {error.strerror or error}"}


def main() -> None:
    api = JoynexaAPI()
    index = WEB_DIR / "index.html"
    if not index.is_file():
        raise SystemExit("Console/index.html is missing.")
    window = webview.create_window(
        "Joynexa Console",
        index.as_uri(),
        js_api=api,
        fullscreen=True,
        min_size=(900, 600),
        background_color="#090d18",
    )
    api.window = window
    webview.start(debug=False)


if __name__ == "__main__":
    main()
