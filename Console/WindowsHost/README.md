# Joynexa Console — Windows Host

This .NET 8 Windows Forms host wraps the shared dashboard in WebView2 and adds native game-library support.

## Requirements
- Windows 10/11 x64
- .NET 8 SDK
- Microsoft Edge WebView2 Runtime (Evergreen)

## Build and run
From this directory:

```powershell
dotnet restore
dotnet run
```

Publish a self-contained x64 build:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true
```

The host copies the shared dashboard files from `Console/` into its output folder. The game library is stored in the current user's LocalAppData under `AtDev/Joynexa/Console/games.json`.

## Native bridge
The host accepts only these JSON message types from the local dashboard:
- `get-library`
- `pick-game` — opens a Windows file picker; user selects one existing `.exe`.
- `launch-game` — launches only an executable already in the saved library.
- `exit-console`

The launcher does not accept shell commands, arbitrary command-line arguments, URLs, or executable paths from webpage messages. Games are launched with `UseShellExecute = false`. The user must add each executable explicitly.

## Notes
- This is an early prototype, not a signed installer.
- Adding a game registers its executable path; it does not install or verify the game.
- Some games require launchers, anti-cheat services, elevated permissions, or store-specific startup flows and may not work through this basic host.
- The web dashboard can still be opened independently in a browser; native launching is available only inside this Windows host.
