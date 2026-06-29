/**
 * Frontend API client. Small wrappers around fetch that auto-inject credentials
 * and parse JSON, with typed responses.
 */

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  activeRole: 'PASSENGER' | 'DRIVER' | 'ADMIN'
  isAdmin: boolean
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  driverStatus: string
  passengerRating: number
  driverRating: number
  passengerRides: number
  driverRides: number
  hasDriverProfile: boolean
  hasPassengerProfile: boolean
  driverProfile: any | null
  vehicles: Vehicle[]
}

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  plateNumber: string
  color: string
  vehicleType: string
  totalSeats: number
  status: string
}

export interface VerificationStatus {
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  driverStatus: string
  hasApprovedVehicle: boolean
  canBookRide: boolean
  canOfferRide: boolean
}

export interface Ride {
  id: string
  driverId: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  destAddress: string
  destLat: number
  destLng: number
  departureTime: string
  totalSeats: number
  availableSeats: number
  pricePerSeat: number
  status: 'SCHEDULED' | 'ACTIVE' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'
  notes?: string | null
  routeDistance?: number | null
  routeDuration?: number | null
  driver?: {
    id: string
    name: string
    phone?: string
    avatarUrl?: string | null
    driverRating: number
    driverProfile?: { rating: number; totalRides: number; totalEarnings: number } | null
  }
  vehicle?: Vehicle
  pickupDistKm?: number | null
  destDistKm?: number | null
  bookings?: Booking[]
  startedAt?: string | null
  completedAt?: string | null
}

export interface Booking {
  id: string
  rideId: string
  passengerId: string
  seatsBooked: number
  totalPrice: number
  status: 'REQUESTED' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'STARTED' | 'COMPLETED'
  paymentMethod: string
  paymentStatus: string
  otpCode?: string | null
  requestedAt: string
  confirmedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  chatArchived?: boolean
  ride?: Ride
  passenger?: { id: string; name: string; phone?: string; avatarUrl?: string | null; passengerRating: number }
  messages?: Message[]
}

export interface Message {
  id: string
  bookingId: string
  senderId: string
  content: string
  readAt?: string | null
  createdAt: string
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  data?: any
  readAt?: string | null
  createdAt: string
}

export interface PlaceResult {
  id: string
  label: string
  lat: number
  lng: number
  type?: string
  category?: string
  address?: any
}

async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!r.ok) {
    let msg = `Request failed (${r.status})`
    try {
      const j = await r.json()
      msg = j.error || msg
    } catch {}
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  auth: {
    signup: (body: { name: string; email: string; password: string; phone?: string }) =>
      http<{ user: User; requiresRoleSelection: boolean }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      http<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    google: (body: { credential?: string; googleId?: string; email?: string; name?: string; picture?: string; idToken?: string }) =>
      http<{ user: User; requiresRoleSelection: boolean }>('/api/auth/google', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => http<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    me: () => http<{ user: User | null; verification: VerificationStatus | null }>('/api/auth/me'),
    switchRole: (role: 'PASSENGER' | 'DRIVER') =>
      http<{ ok: boolean; role: string }>('/api/auth/switch-role', { method: 'POST', body: JSON.stringify({ role }) }),
  },
  verify: {
    status: () => http<VerificationStatus & { driverProfile: any; vehicles: Vehicle[] }>('/api/verify/status'),
    email: () => http<{ ok: boolean }>('/api/verify/email-request', { method: 'POST' }),
    phone: (phone: string) =>
      http<{ ok: boolean }>('/api/verify/phone-request', { method: 'POST', body: JSON.stringify({ phone }) }),
    kyc: (body: any) => http<{ ok: boolean }>('/api/verify/kyc-submit', { method: 'POST', body: JSON.stringify(body) }),
    driver: (body: any) => http<{ ok: boolean; profile: any }>('/api/verify/driver-submit', { method: 'POST', body: JSON.stringify(body) }),
    vehicle: (body: any) => http<{ ok: boolean; vehicle: Vehicle }>('/api/verify/vehicle-submit', { method: 'POST', body: JSON.stringify(body) }),
  },
  rides: {
    create: (body: any) => http<{ ride: Ride }>('/api/rides/create', { method: 'POST', body: JSON.stringify(body) }),
    search: (params: URLSearchParams) => http<{ items: Ride[] }>(`/api/rides/search?${params}`),
    list: (params: URLSearchParams) => http<{ items: any[] }>(`/api/rides/list?${params}`),
    detail: (id: string) => http<{ ride: Ride }>(`/api/rides/detail?id=${id}`),
    cancel: (rideId: string) => http<{ ok: boolean }>('/api/rides/cancel', { method: 'POST', body: JSON.stringify({ rideId }) }),
    start: (rideId: string) => http<{ ok: boolean }>('/api/rides/start', { method: 'POST', body: JSON.stringify({ rideId }) }),
    complete: (rideId: string) => http<{ ok: boolean }>('/api/rides/complete', { method: 'POST', body: JSON.stringify({ rideId }) }),
  },
  bookings: {
    request: (body: { rideId: string; seatsBooked: number; paymentMethod?: string }) =>
      http<{ booking: Booking }>('/api/bookings/request', { method: 'POST', body: JSON.stringify(body) }),
    accept: (bookingId: string) => http<{ ok: boolean }>('/api/bookings/accept', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    reject: (bookingId: string, reason?: string) =>
      http<{ ok: boolean }>('/api/bookings/reject', { method: 'POST', body: JSON.stringify({ bookingId, reason }) }),
    cancel: (bookingId: string, reason?: string) =>
      http<{ ok: boolean }>('/api/bookings/cancel', { method: 'POST', body: JSON.stringify({ bookingId, reason }) }),
    verifyOtp: (bookingId: string, otp: string) =>
      http<{ ok: boolean }>('/api/bookings/verify-otp', { method: 'POST', body: JSON.stringify({ bookingId, otp }) }),
    rate: (bookingId: string, rating: number, comment?: string) =>
      http<{ ok: boolean }>('/api/bookings/rate', { method: 'POST', body: JSON.stringify({ bookingId, rating, comment }) }),
    list: (params: URLSearchParams) => http<{ items: Booking[] }>(`/api/bookings/list?${params}`),
    detail: (id: string) => http<{ booking: Booking }>(`/api/bookings/detail?id=${id}`),
  },
  chat: {
    messages: (bookingId: string) => http<{ items: Message[] }>(`/api/chat/messages?bookingId=${bookingId}`),
    send: (bookingId: string, content: string) =>
      http<{ message: Message }>('/api/chat/send', { method: 'POST', body: JSON.stringify({ bookingId, content }) }),
    markRead: (bookingId: string) =>
      http<{ ok: boolean }>('/api/chat/mark-read', { method: 'POST', body: JSON.stringify({ bookingId }) }),
  },
  notifications: {
    list: (unreadOnly = false) => http<{ items: AppNotification[] }>(`/api/notifications/list?${unreadOnly ? 'unread=1' : ''}`),
    unreadCount: () => http<{ count: number }>('/api/notifications/unread-count'),
    markRead: (id?: string) =>
      http<{ ok: boolean }>('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify(id ? { id } : { all: true }) }),
  },
  location: {
    autocomplete: (q: string) => http<{ items: PlaceResult[] }>(`/api/location/autocomplete?q=${encodeURIComponent(q)}`),
    geocode: (lat: number, lng: number) => http<{ label: string; lat: number; lng: number; address: any }>(`/api/location/geocode?lat=${lat}&lng=${lng}`),
    route: (a: { fromLat: number; fromLng: number; toLat: number; toLng: number }) =>
      http<{ distance: number; duration: number; geometry: any; etaMinutes: number }>(
        `/api/location/route?fromLat=${a.fromLat}&fromLng=${a.fromLng}&toLat=${a.toLat}&toLng=${a.toLng}`
      ),
    update: (body: { rideId?: string; lat: number; lng: number; heading?: number; speed?: number }) =>
      http<{ ok: boolean }>('/api/location/update', { method: 'POST', body: JSON.stringify(body) }),
  },
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' }).then((r) => r.json())
  },
  admin: {
    stats: () => http<any>('/api/admin/stats'),
    users: (q?: string, role?: string) => http<{ items: any[] }>(`/api/admin/users?${new URLSearchParams({ q: q || '', role: role || '' })}`),
    rides: (status?: string) => http<{ items: any[] }>(`/api/admin/rides?${status ? `status=${status}` : ''}`),
    payments: () => http<{ items: any[] }>('/api/admin/payments'),
    verifyList: () => http<{ items: any[] }>('/api/admin/verify/list'),
    verifyReview: (verificationId: string, status: string, notes?: string) =>
      http<{ ok: boolean }>('/api/admin/verify/review', { method: 'POST', body: JSON.stringify({ verificationId, status, notes }) }),
    userAction: (userId: string, action: string) =>
      http<{ ok: boolean }>('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId, action }) }),
  },
}
