# AtDev Billing — Hybrid plans (Joynexa)

**Status:** proposal / integration specification. Billing is disabled; no real payments or paid entitlements are active.

## Product policy

Joynexa remains usable for free. Playing games, creating a basic profile, accessing public community features, and publishing within the free limits must not require a subscription. Paid plans may add convenience and creator tools; they must not sell competitive advantages, visibility guarantees, moderation priority, or access to other people's content.

## Proposed plans (CLP, not active prices)

| Plan | Monthly reference price | Intended benefits |
| --- | ---: | --- |
| Free | $0 | Play, profile, community, basic creator/publishing tools |
| Creator | $990 | Extended creator analytics, extra private drafts, additional customization |
| Creator+ | $1,990 | Higher creator workspace limits and advanced project presentation tools |

Prices are exploratory and must be reviewed against hosting costs, taxes, payment fees, and user feedback before launch. No checkout, renewal, or charge may be enabled by this document.

## Integration contract

- Billing decisions must be made by a trusted server, never by frontend flags or client-supplied plan names.
- Use stable internal product IDs: `joynexa`, `joynexa_creator`, and `joynexa_creator_plus`.
- Entitlements should be explicit, scoped, revocable, and have a recorded source and expiry.
- A missing Billing service must fail safely to the Free experience.
- Never store card numbers, CVV, bank credentials, or payment-provider secrets in Joynexa.
- Do not grant paid entitlements from Walletie credits: Walletie credits are virtual and have no cash value.
- Keep account identity linked to the existing AtDev Accounts/Joynexa account system; do not create duplicate user identities.

## Suggested entitlement keys

- `creator.analytics.extended`
- `creator.drafts.private.extra`
- `creator.profile.customization`
- `creator.workspace.projects.extra`

Entitlement names and limits are proposals; define numeric quotas centrally before implementation.

## Launch gates

1. A separately maintained AtDev Billing service and documented API exist.
2. Server-side authorization and webhook signature verification are tested.
3. Free-tier behavior is tested with Billing unavailable.
4. Cancellation, expiry, refunds, and provider outages have documented behavior.
5. An adult account owner has reviewed provider eligibility, legal obligations, taxes, and payment setup before any real-money feature is activated.

Until all gates are met, display plans as **coming later** or omit checkout entirely.
