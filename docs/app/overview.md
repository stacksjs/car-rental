# Drivly — App Overview

Drivly is a peer-to-peer car-rental marketplace built on Stacks. Hosts list
their vehicles for rent; renters book them by the day. On top of the standard
P2P rental flow, Drivly runs two additional marketplaces:

- **Relocations** — one-way "drive-away" jobs. A host needs their car moved
  from point A to point B and pays a driver to do it (flat fee, per-mile, or
  free use of the car). Modeled after Hertz/Enterprise's rental car
  relocation programs and apps like JUCY's "drive-a-car".
- **Roadtrips** — multi-leg journeys stitched together from open relocations.
  A driver who wants to get from LA to NYC can chain a LA→OKC relocation
  with an OKC→NYC relocation, get paid for each leg, and ride the trip from
  end to end without buying a ticket.

This folder documents the domain model, API surface, and the business rules
that aren't obvious from a single file's source code. For framework / Stacks
plumbing (auto-imports, model definitions, middleware, etc.) see
`docs/guide/`.

## Domain map

| Concern              | Primary models                                    | Where it lives                                   |
| -------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Cars + listings      | `Car`, `CarPhoto`, `Category`, `Location`         | `app/Models/Car.ts`, `app/Actions/Cars/`         |
| Hosts                | `HostProfile`                                     | `app/Models/HostProfile.ts`, `app/Actions/Host/` |
| Bookings + checkout  | `Booking`, `Payment`, `PaymentTransaction`        | `app/Actions/Bookings/`, `app/Actions/Checkout/` |
| Reviews + favorites  | `Review`                                          | `app/Actions/Reviews/`, `app/Actions/Favorites/` |
| Relocations          | `Relocation`, `RelocationApplication`             | `app/Actions/Relocations/`                       |
| Roadtrips            | `Roadtrip`, `RoadtripLeg`                         | `app/Actions/Roadtrips/`                         |
| Subscriptions        | `Subscription`                                    | `app/Actions/Subscriptions/`                     |

## Top-level API surface

All routes are defined in `routes/api.ts`. Auto-CRUD endpoints
(`/api/cars`, `/api/bookings`, `/api/locations`, …) are generated from
the model definitions via the `useApi` trait — they don't need explicit
route lines. Custom endpoints (anything that needs ownership checks,
side-effects, or multi-table state transitions) are explicit routes
backed by files in `app/Actions/**`.

| Surface              | Doc                                |
| -------------------- | ---------------------------------- |
| Cars + bookings      | [`./cars-and-bookings.md`](./cars-and-bookings.md) |
| Hosts                | [`./hosts.md`](./hosts.md)         |
| Relocations          | [`./relocations.md`](./relocations.md) |
| Roadtrips            | [`./roadtrips.md`](./roadtrips.md) |
| Status lifecycles    | [`./status-lifecycles.md`](./status-lifecycles.md) |

## Conventions

- **Auth-gated writes:** browsing (cars, relocations) is public; anything
  that mutates state goes through the `auth` middleware group at the end
  of `routes/api.ts`.
- **Ownership checks live in actions, not middleware.** Each action that
  mutates a row re-derives the authed user via `authedUserId(request)` and
  checks the row's `user_id` / `host_profile_id` directly.
- **Snapshots over joins for stable deals.** When a user commits to a
  derived deal (e.g. a roadtrip leg pulled from a relocation), the
  pricing fields are copied onto the leg row at add-time so a host's
  later edits don't quietly change the deal — see the snapshot pattern
  in [Roadtrips](./roadtrips.md).
- **Status propagation via best-effort sync helpers.** When state in one
  table moves (relocation approved/cancelled), helpers in
  `app/Actions/Roadtrips/_legSync.ts` mirror it onto downstream tables.
  Sync failures are logged but not fatal — the canonical row is the
  one being updated.
