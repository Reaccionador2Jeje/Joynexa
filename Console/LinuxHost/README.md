# Joynexa Console — Linux Host

Native desktop host for Lubuntu and other Linux desktops. It reuses the shared dashboard in `Console/`.

## Requirements

- Python 3.10+
- A working desktop session (X11 or Wayland)
- GTK/WebKitGTK runtime supported by pywebview
- Tkinter for the native file chooser

On Debian/Ubuntu/Lubuntu, install the system packages first:

```bash
sudo apt update
sudo apt install python3-venv python3-tk python3-gi gir1.2-webkit2-4.1
```

Create an environment and launch:

```bash
cd Console/LinuxHost
python3 -m venv --system-site-packages .venv
. .venv/bin/activate
pip install -r requirements.txt
python joynexa_console.py
```

If your Lubuntu release provides WebKitGTK 4.0 instead of 4.1, install the matching runtime package offered by that release. Do not install a second desktop environment.

## Current Linux host behavior

- Fullscreen dashboard using the shared HTML/CSS/JavaScript.
- Native file picker to register an executable Linux application.
- Launches only an explicitly registered executable, using an argument list (never a shell command).
- Stores its library in `~/.local/share/atdev/joynexa-console/games.json`.
- Minimizes Joynexa while a selected process runs and restores it after that process exits.

For a selected script or AppImage, the file must already have its executable permission enabled. This host does not install games or bypass operating-system permissions.
