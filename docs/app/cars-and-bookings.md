# Cars & Bookings

The core peer-to-peer rental flow: a host lists a `Car`, renters browse
and book it for a date range, payment captures via Stripe at checkout.

## Cars

Defined in `app/Models/Car.ts`. Listed publicly via the `useApi` trait
(`GET /api/cars`, `GET /api/cars/{id}`) plus the custom slugged + search
endpoints in `routes/api.ts`:

| Endpoint                         | Action                                 | Purpose                                |
| -------------------------------- | -------------------------------------- | -------------------------------------- |
| `GET /api/search/cars`           | `Search/CarSearchAction`               | Faceted search (categories, price, …)  |
| `GET /api/cars/by-slug/{key}`    | `Cars/CarShowBySlugAction`             | Detail page lookup by SEO slug         |
| `GET /api/cars/{id}/availability`| `Cars/CheckAvailabilityAction`         | Date-range availability check          |
| `GET /api/cars/{id}/similar`     | `Cars/SimilarCarsAction`               | Related cars on detail page            |
| `POST /api/cars/{id}/photos`     | `Cars/UploadPhotoAction`               | Host adds photos (auth + ownership)    |

A `Car` belongs to a `HostProfile`. The Auto-CRUD writes are *not* exposed
publicly — listings are seeded or created through the host dashboard.
See [Hosts](./hosts.md).

## Bookings

Defined in `app/Models/Booking.ts`. The lifecycle:

1. Renter calls `POST /api/bookings` (`Bookings/BookingStoreAction`) with a
   car_id + date range. The booking is created in `pending` payment state.
2. Renter calls `POST /api/checkout/booking/{id}` (`Checkout/BookingCheckoutAction`)
   which creates a Stripe PaymentIntent and stores the client secret.
3. Stripe redirects on success → webhook (`POST /api/webhooks/stripe`) flips
   the booking to `paid` and records a `PaymentTransaction`.
4. Renter can cancel via `POST /api/bookings/{id}/cancel` until the rental
   start date — refund policy enforced inside the action.

| Endpoint                                | Action                                 |
| --------------------------------------- | -------------------------------------- |
| `GET /api/bookings/mine`                | `Bookings/MyBookingsAction`            |
| `POST /api/bookings`                    | `Bookings/BookingStoreAction`          |
| `POST /api/bookings/{id}/cancel`        | `Bookings/CancelBookingAction`         |
| `POST /api/checkout/booking/{id}`       | `Checkout/BookingCheckoutAction`       |
| `POST /api/webhooks/stripe`             | `Webhooks/StripeAction`                |

## Reviews

A renter who completed a booking can leave a `Review` via
`POST /api/reviews` (`Reviews/ReviewStoreAction`). Reviews tie back to the
car and surface in the listing detail.

## Favorites

Auth-gated heart-icon endpoints:

| Endpoint                          | Action                            |
| --------------------------------- | --------------------------------- |
| `GET /api/favorites`              | `Favorites/IndexAction`           |
| `POST /api/favorites/{carId}`     | `Favorites/AddAction`             |
| `DELETE /api/favorites/{carId}`   | `Favorites/RemoveAction`          |
