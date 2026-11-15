# Joynexa and Walletie integration

Walletie is planned as the shared virtual-credit service for optional AtDev ecosystem rewards and virtual items. Joynexa's existing XP and achievement systems remain independent until a verified identity bridge and an explicit product design are implemented.

## Current status

- Joynexa ID has its own account backend and session flow.
- Walletie V1 currently accepts AtDev Cloud HS256 tokens and checks the account in the AtDev Cloud D1 users table.
- A Joynexa ID session is not automatically a valid Walletie token.
- Existing Joynexa XP is not Walletie credit and must not be silently converted or synchronized.
- The Joynexa Game SDK continues to validate achievements on trusted backends.

## Integration sequence

1. Define and implement a verified account-linking/SSO flow using the AtDev identity roadmap.
2. Preserve existing Joynexa account IDs and Walletie balances through an explicit mapping; never link accounts by email alone.
3. Add a Walletie balance/history view only after the authenticated API call works end to end.
4. Define optional virtual items with server-owned SKUs and prices.
5. Grant any future reward only from trusted Joynexa backend code after validating the game or achievement event.
6. Use a unique idempotency key for each reward event and purchase.

## Security rules

- Never put WALLETIE_SERVICE_TOKEN or JWT_SECRET in browser code, iframe messages, game files, or the Joynexa Game SDK client.
- Never accept XP amounts, credit amounts, or achievement eligibility from an iframe.
- Do not let clients choose prices or arbitrary account IDs.
- Do not make core catalog browsing, game launching, or existing achievements depend on credits.

## Current state

This document describes the planned integration contract. Joynexa is not yet connected to Walletie.
