# Joynexa platform status

## Implemented
- Single-site responsive frontend.
- Cloudflare Worker API for health, approved game catalog, Joynexa ID registration/login/logout/session lookup, and private game submissions.
- D1 database joynexa-db created in the connected Cloudflare account and initialized with the initial schema.
- D1 schema for users, sessions, games, achievements, favorites, and moderation history.
- Passwords use PBKDF2-SHA-256 with per-user salts; session tokens are random and only their SHA-256 hashes are stored.
- Submitted games remain pending and are not exposed in the public catalog.
- GitHub Actions syntax validation workflow.
- Workers Static Assets configuration serves the website and API from one origin.

## Not production-ready
- Account recovery, rate limiting, anti-abuse controls, legal/privacy review, age-appropriate consent and security testing are required before public registration.
- There is no admin moderation dashboard yet; submissions cannot be approved from the public site.
- Achievements and cloud saves need a game SDK and game-by-game integration.
- Social, groups, events and developer analytics remain future modules.
- External games are not embedded automatically. Review licensing, content, origin isolation and sandbox policy before launching them.
- The first catalog cards are placeholders until approved games exist.

## Deploy
The repository is configured to serve the frontend and API from one Cloudflare Worker using Workers Static Assets. The D1 database is already created and its schema applied. Its ID is configured in wrangler.toml.

From a development environment with Wrangler installed and authenticated, run:

1. npx wrangler deploy

Connect the GitHub repository to Cloudflare Workers Builds to automate future deployments from main. Do not commit API tokens or secrets.
