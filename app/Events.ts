
export default {
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],

  'booking:created': ['Bookings/SendBookingConfirmation', 'Bookings/NotifyHostOfNewBooking'],
  'booking:cancelled': ['Bookings/SendCancellationEmail', 'Bookings/RefundBooking'],
  'booking:completed': ['Bookings/RequestReview', 'Bookings/FinalizeHostPayout'],

  'payment:succeeded': ['Bookings/MarkBookingConfirmed'],
  'payment:failed': ['Bookings/HandlePaymentFailure'],

  'review:created': ['Reviews/RecomputeCarRating'],

  'car:created': ['Cars/IndexCarInSearch'],
  'car:updated': ['Cars/IndexCarInSearch'],
  'car:deleted': ['Cars/RemoveCarFromSearch'],

  // Relocation marketplace events. Listeners are best-effort notifications
  // (email + in-app database) — they never mutate state, so re-emits are safe.
  'relocation:application:created': ['Relocations/NotifyHostOfApplication'],
  'relocation:approved': ['Relocations/NotifyDriverOfApproval'],
  'relocation:completed': ['Relocations/NotifyHostOfCompletion'],
} satisfies Events
