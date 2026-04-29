# Hosts

A user becomes a host by creating a `HostProfile`. The profile is what
"owns" cars + relocations on the platform — auth checks compare
`reloc.host_profile_id` against `(host_profile.user_id === authedUserId)`
rather than comparing user_ids directly.

## Becoming a host

| Endpoint                            | Action                                  | Purpose                                       |
| ----------------------------------- | --------------------------------------- | --------------------------------------------- |
| `POST /api/host/apply`              | `Host/ApplyAction`                      | Create the host profile                       |
| `GET /api/host/dashboard`           | `Host/DashboardAction`                  | Aggregate listings, bookings, payouts         |
| `POST /api/host/connect/onboard`    | `Host/ConnectOnboardingAction`          | Stripe Connect Express account link          |
| `GET /api/host/connect/return`      | `Host/ConnectReturnAction`              | Stripe redirects here after onboarding        |

The Stripe Connect return URL is intentionally registered *outside* the
`auth` middleware group — Stripe redirects the browser without our
bearer token, so the action resolves the host via the `?acct=` query
param it stamped onto the AccountLink generation.

## Authed-fill pattern

`Car`, `Relocation`, and `Roadtrip` use the `authedFill` model trait so
that mass-assignment via auto-CRUD can't fake ownership. When a host
POSTs without an explicit `host_profile_id`, the framework derives it
from the authed user's host profile. Example from `app/Models/Relocation.ts`:

```ts
authedFill: {
  creating: {
    host_profile_id: async (user) => {
      const userId = Number(user?._attributes?.id ?? user?.id)
      if (!userId) return null
      const hp = await HostProfile.query().where('user_id', userId).first()
      return hp ? Number(hp._attributes?.id ?? hp.id) : null
    },
  },
},
```

## Host-side relocation endpoints

See [Relocations](./relocations.md) — every action that mutates a
relocation is gated to the host whose profile owns it.
