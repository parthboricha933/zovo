import type { AppNotification } from './api-client'

/**
 * Map a notification to the view the user should be taken to when they click it.
 * Returns null if no navigation is needed.
 *
 * View names match the keys used in useUIStore.navigate().
 */
export function getNotificationTargetView(n: AppNotification | any): string | null {
  const type = n.type
  const data = n.data || {}

  switch (type) {
    // Booking lifecycle → passenger's current booking page
    case 'BOOKING_ACCEPTED':
    case 'BOOKING_REJECTED':
    case 'OTP_GENERATED':
    case 'RIDE_STARTED':
    case 'RIDE_COMPLETED':
    case 'DRIVER_ARRIVED':
      // If we have a bookingId, go to passenger current booking with that booking selected
      if (data.bookingId) return 'passenger.current'
      return 'passenger.current'

    // Booking request → driver's ride requests page
    case 'BOOKING_REQUEST':
      return 'driver.requests'

    // Verification approved → verification hub
    case 'VERIFICATION_APPROVED':
      return 'verification'

    // Chat message → current booking (passenger) or active ride (driver)
    case 'CHAT_MESSAGE':
      if (data.bookingId) return 'passenger.current'
      return null

    // System / welcome → dashboard
    case 'SYSTEM':
      return null

    default:
      return null
  }
}

/**
 * Get the params to pass to navigate() when clicking a notification.
 * Typically includes the bookingId so the target page can auto-select it.
 */
export function getNotificationTargetParams(n: AppNotification | any): Record<string, any> {
  const data = n.data || {}
  if (data.bookingId) return { bookingId: data.bookingId }
  if (data.rideId) return { rideId: data.rideId }
  return {}
}
