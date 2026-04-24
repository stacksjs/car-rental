import { response, route } from '@stacksjs/router'

/**
 * Car-rental API routes.
 *
 * Framework routes (auth, dashboard, etc.) load automatically from
 * storage/framework/defaults/routes/. useApi auto-CRUD endpoints (/api/cars,
 * /api/bookings, /api/locations, /api/reviews, etc.) are generated from
 * model definitions in app/Models/*. Only custom endpoints live here.
 */

route.get('/', () => response.text('car-rental api'))

route.group({ prefix: '/api' }, () => {
  route.get('/search/cars', 'Actions/Search/CarSearchAction')
  route.get('/cars/by-slug/{key}', 'Actions/Cars/CarShowBySlugAction')
  route.get('/cars/{id}/availability', 'Actions/Cars/CheckAvailabilityAction')
  route.get('/cars/{id}/similar', 'Actions/Cars/SimilarCarsAction')

  route.group({ middleware: ['auth'] }, () => {
    route.get('/debug/me', 'Actions/DebugMe')
    route.get('/bookings/mine', 'Actions/Bookings/MyBookingsAction')
    route.post('/bookings', 'Actions/Bookings/BookingStoreAction')
    route.post('/bookings/{id}/cancel', 'Actions/Bookings/CancelBookingAction')

    route.post('/cars/{id}/photos', 'Actions/Cars/UploadPhotoAction')

    route.post('/favorites/{carId}', 'Actions/Favorites/AddAction')
    route.delete('/favorites/{carId}', 'Actions/Favorites/RemoveAction')
    route.get('/favorites', 'Actions/Favorites/IndexAction')

    route.post('/host/apply', 'Actions/Host/ApplyAction')
    route.get('/host/dashboard', 'Actions/Host/DashboardAction')
    route.post('/host/connect/onboard', 'Actions/Host/ConnectOnboardingAction')
    route.get('/host/connect/return', 'Actions/Host/ConnectReturnAction')

    route.post('/checkout/booking/{id}', 'Actions/Checkout/BookingCheckoutAction')
    route.post('/subscriptions/drivly-plus', 'Actions/Subscriptions/SubscribeAction')
  })

  route.post('/webhooks/stripe', 'Actions/Webhooks/StripeAction')
  route.post('/webhooks/stripe/connect', 'Actions/Webhooks/StripeConnectAction')

  route.post('/auth/login', 'Actions/Auth/LoginAction')
  route.post('/auth/register', 'Actions/Auth/RegisterAction')
  route.post('/auth/logout', 'Actions/Auth/LogoutAction')
})
