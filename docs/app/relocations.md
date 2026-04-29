# Relocations

A **Relocation** is a one-way "drive-away" job. A host needs their car moved
from point A to point B; a driver gets the car for the trip and gets paid
(flat fee, per-mile, or just fuel + free use of the car for some bonus
days). This is the same pattern as Hertz/Enterprise's rental car
relocation programs and apps like JUCY's "drive-a-car".

Models live at `app/Models/Relocation.ts` and `app/Models/RelocationApplication.ts`.
Actions live at `app/Actions/Relocations/`.

## Lifecycle

```
                       ┌──────────────────────────┐
                       │           open           │  ← host posts (StoreAction)
                       └─────┬─────────────────┬──┘
            host cancels    │                 │  host approves an application
              (reopens)     │                 ▼
              ┌─────────────┘   ┌─────────────────────┐
              ▼                 │       claimed       │  driver assigned, hasn't picked up yet
       ┌────────────┐           └─────┬───────────────┘
       │ cancelled  │                 │ driver starts (StartAction)
       └────────────┘                 ▼
                              ┌─────────────────────┐
                              │     in_progress     │  driver is en route
                              └─────┬───────────────┘
                                    │ driver completes (CompleteAction)
                                    ▼
                              ┌─────────────────────┐
                              │      completed      │  payout settled
                              └─────────────────────┘
```

The `RelocationApplication` row tracks each driver's bid:

- `pending` — driver applied, host hasn't decided
- `approved` — host picked this driver (reverts to `pending` on host re-thinking is not supported)
- `rejected` — host explicitly rejected, OR was auto-rejected because the host approved someone else, OR was auto-rejected because the host cancelled the relocation
- `withdrawn` — driver pulled their own application

## Actions

### Host-side

| Endpoint                                                              | Action                          | Notes                                              |
| --------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `GET /api/relocations`                                                | (Auto-CRUD)                     | Public list                                        |
| `GET /api/relocations/{id}`                                           | (Auto-CRUD)                     | Public detail                                      |
| `POST /api/relocations`                                               | `StoreAction`                   | Creates an `open` relocation                       |
| `GET /api/relocations/mine/host`                                      | `MyHostAction`                  | List the host's postings                           |
| `POST /api/relocations/{id}/cancel`                                   | `CancelAction`                  | Allowed while `open` or `claimed`                  |
| `POST /api/relocations/{id}/applications/{applicationId}/approve`     | `ApproveAction`                 | Promotes one bid, auto-rejects others              |
| `POST /api/relocations/{id}/applications/{applicationId}/reject`      | `RejectAction`                  | Single-app reject without changing relocation status |

### Driver-side

| Endpoint                                       | Action               | Notes                                                                    |
| ---------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `GET /api/relocations/mine/driver`             | `MyDriverAction`     | List the driver's applications + active/history trips                    |
| `POST /api/relocations/{id}/apply`             | `ApplyAction`        | Bid on a posting; one pending row per (relocation, user)                 |
| `POST /api/relocations/{id}/withdraw`          | `WithdrawAction`     | Pull your own application; reverts a `claimed` relocation back to `open` |
| `POST /api/relocations/{id}/start`             | `StartAction`        | Driver picks up car, records `start_odometer`                            |
| `POST /api/relocations/{id}/complete`          | `CompleteAction`     | Driver drops off, computes payout from `actual_miles_driven`             |

## Compensation + payout

Set on the relocation at create time, on the application/leg as a snapshot:

- `compensation_type` — `"flat"`, `"per_mile"`, or `"free"` (the perk *is*
  the free use of the car).
- `flat_fee` — paid as-is when `compensation_type === "flat"`.
- `per_mile_rate` — multiplied by `actual_miles_driven` at completion when
  `compensation_type === "per_mile"`.
- `fuel_allowance` — paid in addition to the above on every type, including
  `"free"` (so drivers aren't out of pocket for fill-ups).
- `max_extra_days` — how many extra days the driver can hold the car after
  the dropoff window. Surfaced in the UI as a value indicator; not folded
  into the dollar payout.

Payout formula (in `_helpers.ts:computePay`, used by both `CompleteAction`
and the planner's pre-flight estimate):

```
flat:     payout = flat_fee + fuel_allowance
per_mile: payout = round(per_mile_rate * actual_miles_driven) + fuel_allowance
free:     payout = fuel_allowance
```

## Withdrawal semantics

A driver can `POST /api/relocations/{id}/withdraw` while the relocation is
in `open` or `claimed` state:

- If their application was `pending`, it just flips to `withdrawn`.
- If their application was `approved` (relocation was `claimed`), the
  relocation reverts to `open` and `driver_id` clears so the host can
  pick another applicant.
- If the relocation is `in_progress` or `completed`, the request is
  refused — at that point we need the host-side cancellation flow,
  not a self-withdraw.

The withdraw helper (`Roadtrips/_legSync.ts:withdrawApplication`) is
shared between the explicit withdraw endpoint and the
[`Roadtrips/CancelAction`](./roadtrips.md#cancelling-a-roadtrip) so a
trip cancel reliably backs out every leg's application.

## Status propagation into roadtrips

Every state transition above also updates any `roadtrip_legs` that
reference the relocation, via the helpers in
`app/Actions/Roadtrips/_legSync.ts`. See
[Status Lifecycles](./status-lifecycles.md) for the full mapping.
