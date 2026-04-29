# Status Lifecycles

Quick reference for the states each model can sit in, and how state in
one table propagates into the others. The `roadtrip_legs` table is the
denormalized view — it mirrors what's happening in the underlying
`relocations` row, kept in sync by helpers in `app/Actions/Roadtrips/_legSync.ts`.

## Relocation

| Status        | Set by                                                       |
| ------------- | ------------------------------------------------------------ |
| `open`        | `Relocations/StoreAction` (default), `WithdrawAction` (on revert from `claimed`) |
| `claimed`     | `Relocations/ApproveAction`                                  |
| `in_progress` | `Relocations/StartAction`                                    |
| `completed`   | `Relocations/CompleteAction`                                 |
| `cancelled`   | `Relocations/CancelAction`                                   |

## RelocationApplication

| Status      | Set by                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `pending`   | `Relocations/ApplyAction`, `Roadtrips/ApplyAllAction`                   |
| `approved`  | `Relocations/ApproveAction`                                             |
| `rejected`  | `Relocations/RejectAction`, `ApproveAction` (auto-rejects siblings), `Relocations/CancelAction` (auto-rejects pending apps) |
| `withdrawn` | `Relocations/WithdrawAction`                                            |

## Roadtrip

| Status        | Set by                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| `planning`    | `Roadtrips/StoreAction` (default)                                      |
| `confirmed`   | `Roadtrips/ApplyAllAction` once at least one leg's application lands   |
| `in_progress` | (planned future state — driver picks up first leg's car)               |
| `completed`   | (planned future state — last leg completes)                            |
| `cancelled`   | `Roadtrips/CancelAction`                                               |

## RoadtripLeg

| Status        | Set by                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `planned`     | Default at `StoreAction` / `AddLegAction`                                                         |
| `applied`     | `Roadtrips/ApplyAllAction`, mirrored from `Relocations/ApplyAction` via `syncLegsForUserAndRelocation` |
| `approved`    | Mirrored from `Relocations/ApproveAction` via `syncLegsForApproval` (winning driver only)         |
| `rejected`    | Mirrored from `Relocations/RejectAction` (this driver) or `ApproveAction` (other drivers)         |
| `in_progress` | Mirrored from `Relocations/StartAction`                                                           |
| `completed`   | Mirrored from `Relocations/CompleteAction`                                                        |
| `cancelled`   | `Roadtrips/RemoveLegAction` (leg removed), `Roadtrips/CancelAction` (trip cancelled), `Relocations/CancelAction` (relocation cancelled across all drivers), `Relocations/WithdrawAction` (this driver gave up) |

## Propagation matrix

What happens to *other* tables when a relocation transition fires:

| Relocation action            | Application effect                          | Leg effect (this driver)        | Leg effect (other drivers)      |
| ---------------------------- | ------------------------------------------- | ------------------------------- | ------------------------------- |
| `Apply`                      | Create / re-pend                            | `applied`                       | —                               |
| `Withdraw` (pending)         | This app → `withdrawn`                      | `cancelled`                     | —                               |
| `Withdraw` (approved)        | This app → `withdrawn`; reloc → `open`      | `cancelled`                     | —                               |
| `Reject`                     | This app → `rejected`                       | `rejected`                      | —                               |
| `Approve`                    | This app → `approved`; siblings → `rejected`; reloc → `claimed` | `approved`                      | `rejected`                      |
| `Start`                      | —                                           | `in_progress`                   | —                               |
| `Complete`                   | —                                           | `completed`                     | —                               |
| `Cancel` (host-side)         | All pending → `rejected`                    | `cancelled`                     | `cancelled`                     |

All "leg effect" updates are best-effort — if the secondary update fails
(SQL error, missing row, etc.), the helper logs the error and the
primary action still returns success. The relocation row is the
canonical truth; the leg is a denormalized mirror.
