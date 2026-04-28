/**
 * Tells the winning driver they got the relocation, and the losing
 * applicants that they were rejected. Fires on `relocation:approved`.
 *
 * The action is idempotent against re-emits: it just sends notifications,
 * doesn't mutate any rows.
 */

export default new Action({
  name: 'NotifyDriverOfApproval',
  description: 'Email + database notify the approved driver (and rejected applicants)',

  async handle(payload: any) {
    const reloc = payload?.relocation
    const approvedApp = payload?.application
    if (!reloc?.id || !approvedApp?.user_id) return { success: false }

    const driver = toAttrs<any>(await User.find(approvedApp.user_id))
    if (driver?.email || approvedApp.user_id) {
      await notify(
        { email: driver?.email, userId: approvedApp.user_id },
        {
          subject: `You're approved for the ${reloc.pickup_address.split(',')[0]} → ${reloc.dropoff_address.split(',')[0]} relocation`,
          body: `Pickup any time after ${reloc.earliest_pickup_date}. Drop off by ${reloc.latest_dropoff_date}. Tap the booking page to record the start odometer when you have the keys.`,
          data: { relocation_id: reloc.id, application_id: approvedApp.id, action: 'pickup' },
        },
        ['email', 'database'],
      )
    }

    // Auto-rejected applicants get a brief courtesy ping so their UI flips
    // from "pending" without making them poll. No email — that'd be spammy.
    try {
      const others = toAttrs<any[]>(await RelocationApplication.query()
        .where('relocation_id', reloc.id)
        .where('status', 'rejected')
        .get())
      for (const other of others) {
        if (other.id === approvedApp.id) continue
        await notify(
          { userId: other.user_id },
          {
            subject: `Relocation no longer available`,
            body: `Your application for the ${reloc.pickup_address.split(',')[0]} → ${reloc.dropoff_address.split(',')[0]} relocation was passed over. Other open jobs are waiting.`,
            data: { relocation_id: reloc.id, action: 'browse_more' },
          },
          ['database'],
        )
      }
    }
    catch (err) {
      log.warn(`[relocation] failed to notify rejected applicants for #${reloc.id}: ${(err as Error).message}`)
    }

    return { success: true }
  },
})
