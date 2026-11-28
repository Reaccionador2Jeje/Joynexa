# Joynexa Console — Platform architecture

Joynexa Console uses one shared dashboard and three native launch hosts.

| Platform | Host | Launch target | Library storage |
|---|---|---|---|
| Windows | .NET 8 WinForms + WebView2 | User-selected Windows .exe | LocalAppData |
| Linux | Python + pywebview | User-selected executable file | ~/.local/share/atdev |
| Android | Native Android WebView bridge | User-selected installed launcher app | Private SharedPreferences |

## Shared interface

`index.html`, `styles.css`, and `app.js` are the common dashboard. The JavaScript bridge uses the same message contract on all platforms:

- `get-library`
- `pick-game`
- `launch-game` with a previously registered ID
- `exit-console`

Each host owns its platform-specific file/app picker, persistent library and process launching. The dashboard never supplies an arbitrary shell command or executable path.

## Platform behavior

### Windows
The .NET 8 host uses WebView2 and a Windows file picker to register executables.

### Linux
The Python host uses pywebview, Tkinter's file picker and `subprocess.Popen` with an argument list (no shell). A chosen file must have its executable bit set.

### Android
The Android host lists apps exposed by the Android launcher, lets the user choose one, and starts it by package launch intent. It does not browse arbitrary APKs or install applications.

## Build status

These are source implementations, not certified releases. Windows, Linux and Android hosts still require platform-specific build and hardware testing before distribution. Do not describe an untested host as production-ready.
