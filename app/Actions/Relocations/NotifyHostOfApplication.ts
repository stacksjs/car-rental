/**
 * Pings the host on `relocation:application:created` so they know a
 * driver is waiting. Email + in-app database notification.
 */

export default new Action({
  name: 'NotifyHostOfApplication',
  description: 'Notify the host when a driver applies to one of their relocations',

  async handle(payload: any) {
    const reloc = payload?.relocation
    const app = payload?.application
    if (!reloc?.id || !app?.user_id) return { success: false }

    const hp = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
    if (!hp?.user_id) return { success: false }
    const host = toAttrs<any>(await User.find(hp.user_id))
    const applicant = toAttrs<any>(await User.find(app.user_id))

    await notify(
      { email: host?.email, userId: hp.user_id },
      {
        subject: `New driver application for your relocation`,
        body: `${applicant?.name ?? 'A driver'} applied to drive your car from ${reloc.pickup_address} to ${reloc.dropoff_address}.`,
        data: { relocation_id: reloc.id, application_id: app.id },
      },
      ['email', 'database'],
    )

    log.info(`[relocation] application ${app.id} → host ${host?.email}`)
    return { success: true }
  },
})
