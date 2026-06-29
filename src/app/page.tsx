'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { AuthScreen } from '@/components/zovo/auth/auth-screen'
import { RoleSelectScreen } from '@/components/zovo/auth/role-select-screen'
import { VerificationScreen } from '@/components/zovo/verification/verification-screen'
import { DashboardShell } from '@/components/zovo/shared/dashboard-shell'
import { PassengerSearch } from '@/components/zovo/passenger/passenger-search'
import { PassengerCurrent } from '@/components/zovo/passenger/passenger-current'
import { PassengerHistory } from '@/components/zovo/passenger/passenger-history'
import { PassengerProfile, PassengerSupport } from '@/components/zovo/passenger/passenger-profile'
import { DriverDashboard } from '@/components/zovo/driver/driver-dashboard'
import { DriverOffer } from '@/components/zovo/driver/driver-offer'
import { DriverRequests } from '@/components/zovo/driver/driver-requests'
import { DriverActive } from '@/components/zovo/driver/driver-active'
import { DriverUpcoming, DriverHistory, DriverEarnings, DriverProfile } from '@/components/zovo/driver/driver-misc'
import {
  AdminDashboard, AdminUsers, AdminRides, AdminVerifications, AdminPayments,
} from '@/components/zovo/admin/admin-views'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const { user, verification, initialized, init } = useAuthStore()
  const { view, navigate } = useUIStore()

  useEffect(() => {
    init()
  }, [])

  // Handle email verification deep-link (?verifyEmail=token)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verifyEmail')
    if (token) {
      fetch(`/api/verify/email-confirm?token=${encodeURIComponent(token)}`)
        .then(() => {
          window.history.replaceState({}, document.title, window.location.pathname)
          // Refresh auth state to pick up the verified email
          setTimeout(() => init(), 500)
        })
        .catch(() => {})
    }
  }, [])

  // Auto-redirect based on auth state
  useEffect(() => {
    if (!initialized) return
    if (!user && view !== 'auth') navigate('auth')
    if (user && view === 'auth') {
      // Decide where to go: role-select if no role chosen, else dashboard
      const freshSignup = !user.hasPassengerProfile && !user.hasDriverProfile && user.driverStatus === 'NONE'
      if (freshSignup) navigate('role-select')
      else if (user.activeRole === 'ADMIN') navigate('admin.dashboard')
      else if (user.activeRole === 'DRIVER') navigate('driver.dashboard')
      else navigate('passenger.dashboard')
    }
  }, [user, initialized])

  if (!initialized) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || view === 'auth') {
    return <AuthScreen />
  }

  if (view === 'role-select') {
    return <RoleSelectScreen />
  }

  if (view === 'verification') {
    return <VerificationScreen />
  }

  // ADMIN VIEWS (rendered without DashboardShell — admin uses its own layout)
  if (user.activeRole === 'ADMIN' || view.startsWith('admin.')) {
    let content: React.ReactNode = null
    switch (view) {
      case 'admin.dashboard': content = <AdminDashboard />; break
      case 'admin.users': content = <AdminUsers />; break
      case 'admin.rides': content = <AdminRides />; break
      case 'admin.verifications': content = <AdminVerifications />; break
      case 'admin.payments': content = <AdminPayments />; break
      default: content = <AdminDashboard />
    }
    return <DashboardShell>{content}</DashboardShell>
  }

  // PASSENGER / DRIVER VIEWS
  let content: React.ReactNode = null
  switch (view) {
    // passenger
    case 'passenger.dashboard': content = <PassengerSearch />; break
    case 'passenger.search': content = <PassengerSearch />; break
    case 'passenger.current': content = <PassengerCurrent />; break
    case 'passenger.history': content = <PassengerHistory />; break
    case 'passenger.support': content = <PassengerSupport />; break
    case 'passenger.profile': content = <PassengerProfile />; break
    // driver
    case 'driver.dashboard': content = <DriverDashboard />; break
    case 'driver.offer': content = <DriverOffer />; break
    case 'driver.requests': content = <DriverRequests />; break
    case 'driver.active': content = <DriverActive />; break
    case 'driver.upcoming': content = <DriverUpcoming />; break
    case 'driver.earnings': content = <DriverEarnings />; break
    case 'driver.history': content = <DriverHistory />; break
    case 'driver.profile': content = <DriverProfile />; break
    default:
      content = user.activeRole === 'DRIVER' ? <DriverDashboard /> : <PassengerSearch />
  }

  return <DashboardShell>{content}</DashboardShell>
}
