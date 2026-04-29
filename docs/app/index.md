# Drivly App Documentation

This folder documents the application code under `app/` — the domain model,
business logic, and API surface specific to Drivly. For framework / Stacks
plumbing (auto-imports, model definitions, middleware, deployment) see
`docs/guide/` and `docs/features/`.

| Doc                                          | Covers                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| [Overview](./overview.md)                    | Domain map, conventions, how to navigate the codebase           |
| [Cars & Bookings](./cars-and-bookings.md)    | Listings, search, booking + checkout, reviews, favorites        |
| [Hosts](./hosts.md)                          | Host onboarding, Stripe Connect, ownership patterns             |
| [Relocations](./relocations.md)              | Drive-away marketplace — post / apply / approve / start / complete / withdraw |
| [Roadtrips](./roadtrips.md)                  | Multi-leg planner that chains relocations into a journey        |
| [Status Lifecycles](./status-lifecycles.md)  | Reference table for every model's states + cross-table sync     |

## Recent business-logic changes

The roadtrip + relocation flow had several correctness gaps surfaced
during a 2026-Q2 review. They've been fixed:

- **Snapshot pricing on legs.** A roadtrip leg now copies the
  relocation's `compensation_type / flat_fee / per_mile_rate /
  fuel_allowance / max_extra_days / pickup-window` at add-time, so
  hosts editing their relocation can't quietly change the deal an
  active driver already committed to. See [Roadtrips → Snapshot
  semantics](./roadtrips.md#snapshot-semantics).

- **Realistic schedule check in the planner.** The DFS used to chain
  legs as long as the next pickup wasn't *before* the prior pickup.
  It now requires the next pickup to be on or after the prior pickup
  + a 500 mi/day drive-time floor, so a chain isn't physically
  infeasible by construction. See [Roadtrips → Planner](./roadtrips.md#planner).

- **Bound chains by user deadline.** The planner now drops chains
  whose final leg would dropoff past the user's `latest` window
  instead of returning them as a "you might just barely make it" option.

- **Withdraw endpoint.** `POST /api/relocations/{id}/withdraw` lets a
  driver back out of a pending or approved application; an approved
  application also reverts the relocation to `open` so the host can
  pick someone else. See [Relocations → Withdrawal semantics](./relocations.md#withdrawal-semantics).

- **Status propagation across tables.** Every relocation-side state
  transition now mirrors onto the matching `roadtrip_legs` rows so
  the trip view stays in sync — no more "applied" pills shown weeks
  after the trip completed. See [Status Lifecycles](./status-lifecycles.md).

- **ApplyAllAction batched + per-leg report.** Eliminated N+1 host
  profile lookups, returns per-leg success/skip with reasons so the
  UI can show "applied 3 of 5, 2 skipped because relocation was
  already claimed."
