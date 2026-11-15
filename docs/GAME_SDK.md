# Joynexa Game SDK (server-side)

Joynexa Achievements lets an approved game define achievements and award them to Joynexa IDs from its trusted game backend.

## 1. Register achievements

The game owner signs in to Joynexa and creates a definition:

```http
POST /api/developer/games/<game-slug>/achievements
Content-Type: application/json
Cookie: jn_session=<developer-session>

{
  "code": "first_win",
  "title": "Primera victoria",
  "description": "Gana una partida por primera vez.",
  "points": 10
}
```

Codes use 2-40 lowercase letters, numbers, underscores or hyphens. Titles are limited to 60 characters, descriptions to 180, and points to 0-1000. Only the owner of an approved game can define achievements.

## 2. Generate a game key

While signed in as the owner:

```http
POST /api/developer/games/<game-slug>/sdk-key
Cookie: jn_session=<developer-session>
```

The response contains a `jn_game_...` token. It is shown only once. The previous key for that game is revoked automatically.

**Keep this token only on your private game server.** Never place it in browser JavaScript, HTML, a mobile app bundle, screenshots, or a public repository. If exposed, generate a replacement key.

## 3. Award an achievement from the game server

Your backend sends the player's Joynexa ID and achievement code:

```http
POST /api/sdk/games/<game-slug>/achievements/first_win
Authorization: Bearer jn_game_<private-token>
Content-Type: application/json

{
  "userId": "<32-character-joynexa-id>"
}
```

A successful first award returns `awarded: true`. Repeating the same award returns `duplicate: true`; the unique database key prevents duplicate awards. Only approved games with a valid, non-revoked server key can call this route.

## 4. Read a player's collection

A signed-in player can retrieve their own achievements:

```http
GET /api/achievements/me
Cookie: jn_session=<player-session>
```

The response includes the achievement title, game, description, earned date, points and total points.

## Security model and limitations

- The game key is stored as a SHA-256 hash in D1; the raw key is returned only when generated.
- The key is a server credential, not a public client SDK key.
- Awarding is idempotent per Joynexa ID and achievement.
- Achievement definitions and keys are limited to the owner of an approved game.
- The developer backend is trusted to decide when a player has met an achievement condition. Joynexa verifies the game credential and prevents duplicates, but cannot independently verify arbitrary game logic.
- Do not put private credentials in client-side code. For browser-only games, call your own backend endpoint and have that backend call Joynexa.

## 5. Node.js Game SDK helper

The repository includes a small Node.js 22 helper in `sdk/`. It calls the server endpoint above and keeps the private key on the game backend.

```js
import { JoynexaGameClient } from "./sdk/index.js";

const joynexa = new JoynexaGameClient({
  baseUrl: process.env.JOYNEXA_API_URL,
  gameSlug: "my-approved-game",
  apiKey: process.env.JOYNEXA_GAME_KEY
});

const result = await joynexa.awardAchievement({
  userId: player.joynexaId,
  code: "first_win"
});

if (result.awarded) {
  console.log("Logro registrado.");
} else if (result.duplicate) {
  console.log("El jugador ya tenía este logro.");
}
```

Run the SDK's tests from the repository root:

```bash
cd sdk
npm test
```

The helper requires HTTPS except for localhost development, rejects invalid player IDs and achievement codes before sending a request, and does not follow redirects with the authorization header. Configure `JOYNEXA_API_URL` and `JOYNEXA_GAME_KEY` as private environment variables on the game server. Do not expose either value to the game client.
