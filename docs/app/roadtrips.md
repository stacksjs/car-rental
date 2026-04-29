# Roadtrips

A **Roadtrip** is a user-planned multi-stop journey stitched together from
one or more open [Relocations](./relocations.md). Where a relocation is a
single point-A-to-point-B drive-away job, a roadtrip is the user's overall
trip — say "LA → NYC" — and the legs are the relocations that combine to
cover it (LA → OKC via one relocation, OKC → NYC via another).

Models live at `app/Models/Roadtrip.ts` and `app/Models/RoadtripLeg.ts`.
Actions live at `app/Actions/Roadtrips/`.

## Lifecycle

```
                ┌────────────┐
                │  planning  │ ← created, no applications submitted yet
                └─────┬──────┘
                      │ apply-all (or single-leg apply)
                      ▼
                ┌────────────┐
                │ confirmed  │ ← ≥1 application submitted to a leg
                └─────┬──────┘
                      │
                      ▼
                ┌────────────┐
                │ in_progress│ ← driver picked up the first leg's car
                └─────┬──────┘
                      │
                      ▼
                ┌────────────┐
                │ completed  │ ← all legs completed
                └────────────┘

  any non-terminal state → cancelled (driver bails out)
```

Each `RoadtripLeg` carries its own status that mirrors its underlying
relocation — see [Status Lifecycles](./status-lifecycles.md) for the
relocation-state-to-leg-status table.

## Endpoints

| Endpoint                                            | Action               | Notes                                            |
| --------------------------------------------------- | -------------------- | ------------------------------------------------ |
| `GET /api/roadtrips/plan`                           | `PlanAction`         | Public — preview chains before signing in        |
| `GET /api/roadtrips`                                | `IndexAction`        | List authed user's trips, grouped by status      |
| `GET /api/roadtrips/{id}`                           | `ShowAction`         | Single trip with hydrated legs                   |
| `POST /api/roadtrips`                               | `StoreAction`        | Save a chain as a trip; legs are snapshotted     |
| `POST /api/roadtrips/{id}/cancel`                   | `CancelAction`       | Cancels trip + withdraws every leg's application |
| `POST /api/roadtrips/{id}/legs`                     | `AddLegAction`       | Append a relocation as a new leg (snapshotted)   |
| `DELETE /api/roadtrips/{id}/legs/{legId}`           | `RemoveLegAction`    | Drop a leg, re-pack `sequence` 0..N-1            |
| `POST /api/roadtrips/{id}/apply`                    | `ApplyAllAction`     | Apply to every leg in one shot, per-leg report   |

## Planner

`PlanAction` discovers candidate chains:

1. Pulls every `open` relocation whose pickup window overlaps the user's
   `[earliest, latest]` range.
2. Indexes by normalized pickup city (substring-extracted from address).
3. DFS from origin to destination, max depth `MAX_DEPTH` (4).
4. Between consecutive legs it enforces a real schedule — the next leg's
   `earliest_pickup_date` must be ≥ the prior leg's
   `earliest_pickup_date + estimateDriveDays(prior.miles)` (500 mi/day).
   Without this check the planner used to suggest "drive 1500 mi today,
   pick up the next car tomorrow morning."
5. Drops chains whose final leg's `latest_dropoff_date` runs past the
   user's `latest` deadline. A "you might just barely make it" chain is
   worse UX than not showing the chain at all.
6. Scores each chain (more pay > shorter total miles > fewer legs as a
   tiebreaker) and returns the top N.

### Scoring & pay (no platform-side bonus)

`total_pay` shown to the driver is the **sum of what each host posted —
nothing more.** There is no platform multiplier and no chain bonus baked
into the displayed total. The score is a soft sort key, not a dollar number:

```ts
score = total_pay − 0.05 * total_miles − 5 * (leg_count − 1)
```

Bonus value (free days, fuel allowance) is surfaced as a separate
indicator (`total_extra_days`, leg's `fuel_allowance`) rather than
folded into the dollar pay. Hosts who want to attract chain-takers
can bump their own `flat_fee` — there is no platform-side promo.

## Snapshot semantics

When a user adds a relocation as a leg (via the planner's "Save this trip"
or the explicit `POST /roadtrips/{id}/legs` endpoint), the relocation's
pricing + window are **copied onto the leg row** at add-time:

```ts
// app/Actions/Roadtrips/_helpers.ts:snapshotLegFromRelocation
{
  from_address, from_city, to_address, to_city,
  earliest_pickup_date, latest_dropoff_date,
  estimated_distance_miles,
  compensation_type, flat_fee, per_mile_rate, fuel_allowance, max_extra_days,
  estimated_pay,
}
```

This means a host can edit their relocation row (e.g. lower the
`flat_fee`) without quietly changing the deal an active driver already
committed to. The trip view reads `estimated_pay` and totals from the
snapshot, not from the live relocation.

A unit test pins this behavior: see
`tests/unit/roadtrip-helpers.test.ts` and the smoke check inside
`tests/integration/roadtrips.test.ts` ("host edit ... does NOT change
the saved trip total").

## Apply-all

`ApplyAllAction` saves the user from clicking through N application forms.
It batch-loads relocations, host profiles, and existing applications
(no N+1), then walks each leg:

- Skips legs whose relocation is no longer `open` (`reason: "relocation_*"`).
- Skips legs that point at the user's own posting (`reason: "own_posting"`).
- Updates an existing application back to `pending` if the user previously
  withdrew or was rejected.
- Creates a new `pending` application otherwise.
- Mirrors leg status to `applied` (or `approved` if an existing
  application was already accepted via the single-leg flow).

Returns:

```json
{
  "applied": 3,
  "skipped": 2,
  "total": 5,
  "data": [
    { "leg_id": 12, "ok": true,  "application": { ... } },
    { "leg_id": 13, "ok": false, "reason": "relocation_claimed" },
    ...
  ]
}
```

## Cancelling a roadtrip

`POST /api/roadtrips/{id}/cancel` flips the trip to `cancelled` and walks
every leg, calling `withdrawApplication` from `_legSync.ts`. Each leg's
application gets withdrawn (or revert-to-open if it had been approved),
and the leg row's status follows. Legs that never had an application
(still in `planned`) are also marked `cancelled` directly.

The `withdrawals` array in the response surfaces per-leg outcome so the
UI can show "1 cancelled · 2 withdrawn · 1 already terminal".

## Why the underscore-prefixed files?

`_helpers.ts` and `_legSync.ts` are not actions — they're shared
modules. The leading underscore is a local convention so the framework's
file-discovery scanners (which match `*.ts` for action registration)
don't try to register them as routes.
