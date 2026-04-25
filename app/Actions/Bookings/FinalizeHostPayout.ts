export default new Action({
  name: 'FinalizeHostPayout',
  description: 'Trigger a host payout after a completed trip (Stripe Connect will auto-transfer; hook reserved for custom rules)',

  async handle(booking: any) {
    // Stripe Connect transfer_data handles payouts automatically on payment_intent capture.
    // This hook is a place to record internal payout ledger / retention holds.
    return { success: true, bookingId: booking?.id }
  },
})
