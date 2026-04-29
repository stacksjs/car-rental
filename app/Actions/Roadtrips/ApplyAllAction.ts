/**
 * One-shot apply-to-every-leg helper. The user already vetted each leg's
 * relocation when they added it via the planner; this saves them from
 * re-typing a message into N application forms.
 *
 * Applications go to `pending`. Each leg's status flips to `applied`.
 * The trip status moves planning → confirmed once at least one
 * application is submitted. Idempotent: re-running on a trip that's
 * already had its legs applied is a no-op for those legs.
 *
 * Returns a per-leg result object so the UI can show "applied 3 of 5,
 * 2 skipped because the relocation was already claimed." Skipped legs
 * include a machine-readable reason; the underlying lifecycle still
 * runs (single-leg ApplyAction wires up roadtrip leg sync the same way).
 */

type LegResult =
  | { leg_id: number, ok: true, application: any }
  | { leg_id: number, ok: false, reason: string }

export default new Action({
  name: 'RoadtripsApplyAllAction',
  description: 'Apply to every relocation on the roadtrip in one shot',
  method: 'POST',

  async handle(request: RequestInstance) {
    const userId = await authedUserId(request)
    if (!userId) return response.unauthorized('Auth required')

    const tripId = Number((request as any).params?.id)
    if (!tripId) return response.badRequest('id required')

    const trip = toAttrs<any>(await Roadtrip.find(tripId))
    if (!trip) return response.notFound('Roadtrip not found')
    if (Number(trip.user_id) !== Number(userId))
      return response.forbidden('Not your roadtrip')

    const message = String(request.get('message') ?? '').slice(0, 1000)

    const legs = toAttrs<any[]>(await RoadtripLeg.query()
      .where('roadtrip_id', tripId)
      .orderBy('sequence', 'asc')
      .get())
    if (legs.length === 0) return response.badRequest('Add at least one leg before applying')

    // Batch-load relocations + host_profiles + existing applications. The
    // previous implementation walked one-leg-at-a-time with N queries per
    // table — fine for a 1-leg trip, painful for a 5-leg chain.
    const relocIds = [...new Set(legs.map(l => Number(l.relocation_id)).filter(Boolean))]
    const relocs = relocIds.length
      ? toAttrs<any[]>(await Relocation.query().whereIn('id', relocIds).get())
      : []
    const relocById = new Map<number, any>()
    for (const r of relocs) relocById.set(Number(r.id), r)

    const hostProfileIds = [...new Set(relocs.map(r => Number(r.host_profile_id)).filter(Boolean))]
    const hostProfiles = hostProfileIds.length
      ? toAttrs<any[]>(await HostProfile.query().whereIn('id', hostProfileIds).get())
      : []
    const hostProfileById = new Map<number, any>()
    for (const hp of hostProfiles) hostProfileById.set(Number(hp.id), hp)

    const existingApps = relocIds.length
      ? toAttrs<any[]>(await RelocationApplication.query()
          .whereIn('relocation_id', relocIds)
          .where('user_id', Number(userId))
          .get())
      : []
    const existingByReloc = new Map<number, any>()
    for (const a of existingApps) existingByReloc.set(Number(a.relocation_id), a)

    const results: LegResult[] = []

    for (const leg of legs) {
      const legId = Number(leg.id)
      const relocId = Number(leg.relocation_id ?? 0)
      if (!relocId) {
        results.push({ leg_id: legId, ok: false, reason: 'no_relocation' })
        continue
      }

      const reloc = relocById.get(relocId)
      if (!reloc) {
        results.push({ leg_id: legId, ok: false, reason: 'relocation_not_found' })
        continue
      }
      if (reloc.status !== 'open') {
        results.push({ leg_id: legId, ok: false, reason: `relocation_${reloc.status}` })
        continue
      }

      // Don't let a user apply to drive their own posting (host_profile linked
      // to this user). Mirrors the guard in RelocationsApplyAction.
      const hostProfile = hostProfileById.get(Number(reloc.host_profile_id))
      if (hostProfile && Number(hostProfile.user_id) === Number(userId)) {
        results.push({ leg_id: legId, ok: false, reason: 'own_posting' })
        continue
      }

      const existing = existingByReloc.get(relocId)
      let app: any
      if (existing) {
        if (existing.status === 'pending') {
          app = existing
        }
        else if (existing.status === 'approved') {
          // Already approved (e.g. they applied via the single-leg flow first).
          // Don't re-pend an approved application — just record the leg as
          // already-handled.
          app = existing
        }
        else {
          app = toAttrs<any>(await RelocationApplication.update(existing.id, {
            status: 'pending',
            message: message || existing.message,
          }))
        }
      }
      else {
        app = toAttrs<any>(await RelocationApplication.create({
          relocation_id: relocId,
          user_id: Number(userId),
          status: 'pending',
          message,
        }))
      }

      // Match the leg status to where the application now sits — most legs
      // land at 'applied', but if we found an already-approved application
      // bump the leg to 'approved' so the trip view is honest.
      const newLegStatus = app.status === 'approved' ? 'approved' : 'applied'
      if (leg.status !== newLegStatus)
        await RoadtripLeg.update(legId, { status: newLegStatus })

      results.push({ leg_id: legId, ok: true, application: app })
    }

    const appliedCount = results.filter(r => r.ok).length
    if (appliedCount > 0 && trip.status === 'planning')
      await Roadtrip.update(tripId, { status: 'confirmed' })

    dispatch('roadtrip:applied', { trip, count: appliedCount })
    return response.json({
      data: results,
      applied: appliedCount,
      skipped: results.length - appliedCount,
      total: legs.length,
    })
  },
})
