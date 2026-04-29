/**
 * Roadtrip ↔ Relocation status propagation helpers.
 *
 * A roadtrip leg is a snapshot of one relocation. When the underlying
 * relocation changes state — host approves the driver, driver picks up
 * the car, host cancels the posting — the leg's status field needs to
 * follow, otherwise the trip view shows stale "applied" pills under
 * legs that completed days ago. These helpers do that fan-out from
 * the relocation actions back into roadtrip_legs.
 *
 * Keep these small and best-effort: a missed sync is a UX paper-cut,
 * not a data integrity issue (the relocation row itself is the source
 * of truth for the actual job).
 */

/**
 * Withdraw a driver's application from a relocation, propagating the
 * effect onto any roadtrip_legs that reference it.
 *
 * Status transitions:
 *   - pending  → withdrawn  (just back out)
 *   - approved → withdrawn AND relocation reverts to `open` + driver_id
 *                cleared so the host can find someone else
 *   - approved with started_at set (`in_progress`) → refuse — driver is
 *     mid-trip, this needs a host-side cancellation, not a self-withdraw
 *   - rejected / withdrawn → already terminal, no-op
 */
export async function withdrawApplication(args: {
  relocationId: number
  userId: number
}): Promise<{ ok: boolean, reason?: string, application?: any, relocation?: any }> {
  const reloc = toAttrs<any>(await Relocation.find(args.relocationId))
  if (!reloc) return { ok: false, reason: 'relocation_not_found' }

  const app = toAttrs<any>(await RelocationApplication.query()
    .where('relocation_id', args.relocationId)
    .where('user_id', args.userId)
    .first())
  if (!app) return { ok: false, reason: 'no_application' }

  if (app.status === 'rejected' || app.status === 'withdrawn')
    return { ok: true, application: app, relocation: reloc }

  // Mid-trip / completed — a self-withdraw isn't allowed past pickup.
  if (reloc.status === 'in_progress' || reloc.status === 'completed')
    return { ok: false, reason: 'trip_in_progress', application: app, relocation: reloc }

  const now = new Date().toISOString()
  const updatedApp = toAttrs<any>(await RelocationApplication.update(app.id, {
    status: 'withdrawn',
    rejected_at: now,
  }))

  let updatedReloc = reloc
  // If we were the approved driver, hand the relocation back to the host so
  // they can pick another applicant. The other apps were auto-rejected at
  // approval time, but the host can re-open + re-solicit.
  if (app.status === 'approved' && reloc.status === 'claimed') {
    updatedReloc = toAttrs<any>(await Relocation.update(args.relocationId, {
      status: 'open',
      driver_id: null,
    }))
  }

  // Mirror onto every roadtrip leg owned by this user that points at this
  // relocation. Other users' legs aren't affected by this driver's withdraw.
  await syncLegsForUserAndRelocation({
    userId: args.userId,
    relocationId: args.relocationId,
    legStatus: 'cancelled',
  })

  return { ok: true, application: updatedApp, relocation: updatedReloc }
}

/**
 * Find roadtrip legs for the given (user, relocation) pair and set their
 * status. The user_id lives on the parent roadtrip, so we resolve via a
 * two-step lookup. Best-effort — swallows errors so the caller's primary
 * action still returns success even if the secondary mirror fails.
 */
export async function syncLegsForUserAndRelocation(args: {
  userId: number
  relocationId: number
  legStatus: string
}): Promise<number> {
  try {
    const trips = toAttrs<any[]>(await Roadtrip.query()
      .where('user_id', args.userId)
      .get())
    const tripIds = trips.map((t: any) => Number(t.id))
    if (tripIds.length === 0) return 0
    // Per-trip update loop. Kysely's updateTable + 'in' clause renders the
    // wrong SQL on the bundled SQLite driver, and a user typically only has
    // a handful of roadtrips, so the loop is fine.
    let total = 0
    const now = new Date().toISOString()
    for (const tripId of tripIds) {
      const result = await db.updateTable('roadtrip_legs')
        .set({ status: args.legStatus, updated_at: now })
        .where('relocation_id', '=', args.relocationId)
        .where('roadtrip_id', '=', tripId)
        .execute()
      total += Number(result?.[0]?.numUpdatedRows ?? 0)
    }
    return total
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error('[syncLegsForUserAndRelocation] failed', err)
    return 0
  }
}

/**
 * When a relocation flips to a new state for ALL drivers who had legs on
 * it (e.g. the host cancels the posting), bulk-update every leg pointing
 * at it. No per-user filter — every driver's leg gets the same status.
 */
export async function syncAllLegsForRelocation(args: {
  relocationId: number
  legStatus: string
}): Promise<number> {
  try {
    const result = await db.updateTable('roadtrip_legs')
      .set({ status: args.legStatus, updated_at: new Date().toISOString() })
      .where('relocation_id', '=', args.relocationId)
      .execute()
    return Number(result?.[0]?.numUpdatedRows ?? 0)
  }
  catch {
    return 0
  }
}

/**
 * On approval, the winning driver's leg flips to `approved`. Other users'
 * legs (from competing roadtrips) flip to `rejected` since their
 * applications were also auto-rejected.
 */
export async function syncLegsForApproval(args: {
  relocationId: number
  approvedUserId: number
}): Promise<void> {
  try {
    const now = new Date().toISOString()
    // The winning driver's legs go to 'approved'.
    const approvedTrips = toAttrs<any[]>(await Roadtrip.query()
      .where('user_id', args.approvedUserId)
      .get())
    const approvedTripIds = new Set(approvedTrips.map((t: any) => Number(t.id)))
    for (const tripId of approvedTripIds) {
      await db.updateTable('roadtrip_legs')
        .set({ status: 'approved', updated_at: now })
        .where('relocation_id', '=', args.relocationId)
        .where('roadtrip_id', '=', tripId)
        .execute()
    }
    // Everyone else's legs for this relocation are now dead — host picked
    // someone else. We update each non-winning leg individually rather than
    // a NOT IN, since Kysely's updateTable + 'in' family doesn't render
    // correctly on this driver (see syncLegsForUserAndRelocation).
    const otherLegs = toAttrs<any[]>(await RoadtripLeg.query()
      .where('relocation_id', args.relocationId)
      .get())
    for (const leg of otherLegs) {
      if (approvedTripIds.has(Number(leg.roadtrip_id))) continue
      await db.updateTable('roadtrip_legs')
        .set({ status: 'rejected', updated_at: now })
        .where('id', '=', Number(leg.id))
        .execute()
    }
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error('[syncLegsForApproval] failed', err)
  }
}
