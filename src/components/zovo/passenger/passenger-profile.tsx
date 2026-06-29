'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import {
  Mail, Phone, ShieldCheck, Car, User as UserIcon, Star, LogOut,
  ArrowLeftRight, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export function PassengerProfile() {
  const { user, verification, logout, switchRole } = useAuthStore()
  const { navigate } = useUIStore()

  if (!user) return null

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Profile</h2>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold truncate">{user.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {user.passengerRating.toFixed(1)} passenger
                </span>
                {user.driverStatus === 'APPROVED' && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {user.driverRating.toFixed(1)} driver
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{user.email}</span>
            {user.emailVerified
              ? <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
              : <Badge variant="secondary">Pending</Badge>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{user.phone || 'Not set'}</span>
            {user.phoneVerified
              ? <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
              : <Badge variant="secondary">Pending</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Verification</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Row label="Email" done={user.emailVerified} />
          <Row label="Phone" done={user.phoneVerified} />
          <Row label="KYC" done={user.kycStatus === 'APPROVED'} pending={user.kycStatus === 'PENDING'} />
          <Row label="Driver" done={user.driverStatus === 'APPROVED'} hideIfNone={user.driverStatus === 'NONE'} />
          <Row label="Vehicle" done={verification?.hasApprovedVehicle || false} />
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate('verification')}>
            <ShieldCheck className="h-4 w-4 mr-1.5" /> Manage verifications
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stats</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Rides taken" value={user.passengerRides} />
            <Stat label="Rating" value={user.passengerRating.toFixed(1)} />
            <Stat label="Rides offered" value={user.driverRides} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={async () => {
              try {
                await switchRole(user.activeRole === 'DRIVER' ? 'PASSENGER' : 'DRIVER')
                toast.success(`Switched to ${user.activeRole === 'DRIVER' ? 'passenger' : 'driver'} mode`)
                navigate(user.activeRole === 'DRIVER' ? 'passenger.dashboard' : 'driver.dashboard')
              } catch (e: any) { toast.error(e.message) }
            }}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Switch to {user.activeRole === 'DRIVER' ? 'Passenger' : 'Driver'} mode
          </Button>
          {user.isAdmin && (
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('admin.dashboard')}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Admin Panel
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={async () => { await logout(); navigate('auth') }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, done, pending, hideIfNone }: { label: string; done: boolean; pending?: boolean; hideIfNone?: boolean }) {
  if (hideIfNone) return null
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span>{label}</span>
      {done
        ? <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
        : pending
        ? <Badge variant="secondary">Pending</Badge>
        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not verified</Badge>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function PassengerSupport() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Support</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">How can we help?</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            For immediate assistance, reach out to our 24/7 support team.
          </p>
          <div className="rounded-lg border p-3">
            <div className="font-medium">Email</div>
            <div className="text-muted-foreground">support@zovo.app</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium">Phone</div>
            <div className="text-muted-foreground">+91 1800-ZOVO-HELP</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium">Emergency</div>
            <div className="text-muted-foreground">In case of emergency during a ride, call 112 immediately.</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">FAQ</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { q: 'How do I book a ride?', a: 'Search rides from the Search Ride tab, pick one that matches your route, and tap Book seat. The driver will accept your request.' },
            { q: 'When do I get the OTP?', a: 'The OTP is generated the moment your driver accepts your booking. Share it with the driver at pickup.' },
            { q: 'Can I cancel a booking?', a: 'Yes — you can cancel any time before the ride starts. Cancellations after confirmation may impact your rating.' },
            { q: 'How is the price calculated?', a: 'Drivers set the price per seat when offering a ride. You pay the seat price × number of seats booked.' },
            { q: 'What payment methods are supported?', a: 'Currently cash on completion. UPI, Razorpay, and Stripe are wired in the backend and will be enabled soon.' },
          ].map((f, i) => (
            <details key={i} className="rounded-lg border p-3 cursor-pointer">
              <summary className="font-medium">{f.q}</summary>
              <p className="text-muted-foreground mt-2">{f.a}</p>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
