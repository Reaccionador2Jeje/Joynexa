# Joynexa platform status

## Implemented in this repository
- Responsive single-site frontend.
- Cloudflare Worker API: health, approved game catalog, account registration/login/logout/current session, and game submission queue.
- D1 schema for users, sessions, games, achievements, favorites, and moderation history.
- Passwords use PBKDF2-SHA-256 with per-user salts. Random session tokens are generated and only their SHA-256 hashes are stored.
- Game submissions remain private and pending until reviewed. There is no public chat or direct messaging.

## Not production-ready yet
- Joynexa ID needs account recovery, abuse/rate-limit protections, privacy policy, age-appropriate consent review, and security testing before public launch.
- Moderation needs an authenticated administrator workflow. Never approve arbitrary submitted game URLs automatically.
- Achievements and cloud saves require a game SDK and per-game integration. The schema is only a foundation.
- Social, groups, events, developer analytics, and a full launcher/player are future modules.
- Do not embed untrusted third-party games until origin isolation, content review, licensing checks, and sandbox policies are implemented.

## Cloudflare setup
1. Create a D1 database named joynexa-db.
2. Copy its database ID into wrangler.toml.
3. Apply the D1 migration with Wrangler.
4. Set APP_ORIGIN to the exact deployed frontend origin.
5. Deploy the Worker with Wrangler.
6. Configure the frontend API URL after deployment.

The repository intentionally contains no passwords, API tokens, or Cloudflare secrets.
