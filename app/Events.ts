import type { Events } from '@stacksjs/types'

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
} satisfies Events
