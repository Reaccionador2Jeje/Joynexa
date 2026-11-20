# Joynexa — Ecosystem Integration

Status: coordination plan; existing account routes and fallback behavior are not changed by this document.

## Integration boundaries
- Preserve the existing frontend routes while backend migration is in progress.
- Treat the configured accounts backend as an explicit deployment dependency.
- Keep D1 catalog/moderation/favorites responsibilities separate from account identity.
- Use Walletie only through authenticated server-to-server calls; do not trust browser-provided XP or prices.

## Next tasks
1. Document account backend selection and fallback behavior.
2. Add contract tests for register, login, logout and current-user routes.
3. Test ownership and authorization for favorites and moderation actions.
4. Define a server-verified active-play event before any credit or reward integration.
5. Add migration and rollback notes before changing identity providers.

## Safety and privacy
Collect only data required for game features. Make moderation and account deletion behavior explicit. Never expose backend credentials in the frontend.