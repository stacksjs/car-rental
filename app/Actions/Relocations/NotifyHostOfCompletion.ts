/**
 * Tells the host the trip wrapped, with miles + payout, on
 * `relocation:completed`.
 */

export default new Action({
  name: 'NotifyHostOfCompletion',
  description: 'Notify the host when a relocation trip is completed',

  async handle(reloc: any) {
    if (!reloc?.host_profile_id) return { success: false }
    const hp = toAttrs<any>(await HostProfile.find(reloc.host_profile_id))
    if (!hp?.user_id) return { success: false }
    const host = toAttrs<any>(await User.find(hp.user_id))

    await notify(
      { email: host?.email, userId: hp.user_id },
      {
        subject: `Relocation complete · car delivered`,
        body: `Your car arrived at ${reloc.dropoff_address}. ${reloc.actual_miles_driven ?? 0} miles driven, $${reloc.payout_amount ?? 0} paid out to the driver.`,
        data: { relocation_id: reloc.id, action: 'view' },
      },
      ['email', 'database'],
    )

    log.info(`[relocation] completion notified for #${reloc.id}`)
    return { success: true }
  },
})
