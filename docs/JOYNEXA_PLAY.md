# Joynexa Play: embedded games, sessions and XP

## Player experience

The catalog uses an in-site player for titles whose records have `embed_enabled = 1` and a valid HTTPS `embed_url`. Other titles remain outbound links. The iframe is sandboxed and does not receive Joynexa cookies or private API credentials. If a publisher blocks framing, players can use the original-site link.

## Playtime XP

Authenticated players start a server-side session with `POST /api/play/:slug/start`. The browser sends a heartbeat every 60 seconds and ends the session when the player closes the player.

- XP is awarded only to signed-in accounts.
- One XP is awarded for an accepted active heartbeat interval.
- Intervals shorter than 55 seconds do not award XP; intervals over 100 seconds are treated as inactive.
- The daily playtime XP cap is 120.
- The API tracks session ownership and updates the last heartbeat atomically.
- Global XP includes playtime XP plus points from awarded achievements.

Endpoints:
- `POST /api/play/:slug/start`
- `POST /api/play/:slug/heartbeat` with `{ "sessionId": "..." }`
- `POST /api/play/:slug/end` with `{ "sessionId": "..." }`
- `GET /api/xp/me`

## Achievements and trust

An iframe is an untrusted client. A game can modify its browser code, and a player can manipulate messages from developer tools. Therefore, Joynexa does not accept achievement awards or arbitrary XP amounts directly from iframe messages.

Game achievements continue to use the Joynexa Game SDK from a trusted game backend. The private `jn_game_...` key must never be placed in HTML, browser JavaScript, iframe URLs, or a public repository. The backend validates the game key and awards only achievement definitions registered for that game. Each achievement can be awarded once per Joynexa user.

## Enabling an embedded title

Only enable embedding after reviewing the game and confirming that its publisher permits framing. Set:
- `embed_enabled = 1`
- `embed_url` to the reviewed HTTPS game URL

Do not set `embed_url` to an arbitrary user-provided URL. Keep external-only as the default. Test on desktop and mobile, including fullscreen, pointer lock, audio, storage, and whether the publisher sends frame-blocking headers.

## Database migration

Apply `migrations/0007_joynexa_play_xp.sql` after the earlier migrations. It adds embed metadata, play sessions, and the XP ledger. It does not change account identities or existing achievement records.
