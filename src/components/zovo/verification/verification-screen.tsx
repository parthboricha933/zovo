'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  Mail, Phone, ShieldCheck, Car, IdCard, CheckCircle2, XCircle, Loader2,
  ArrowLeft, Upload, FileCheck2,
} from 'lucide-react'
import { ZovoLogo } from '../shared/logo'

export function VerificationScreen() {
  const { user, refresh } = useAuthStore()
  const navigate = useUIStore((s) => s.navigate)
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [emailSent, setEmailSent] = useState(false)
  const [emailPending, setEmailPending] = useState(false)

  const load = async () => {
    try {
      const s = await api.verify.status()
      setStatus(s)
      // If we're waiting for email verification, refresh periodically
      if (emailPending && s.emailVerified) {
        setEmailPending(false)
        toast.success('Email verified!')
        await refresh()
      }
    } catch (e: any) {
      toast.error('Failed to load verification status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Poll for email verification status every 4 seconds while we're waiting
    const interval = setInterval(() => {
      if (emailPending) load()
    }, 4000)
    return () => clearInterval(interval)
  }, [emailPending])

  // Also check URL for ?verifyEmail=token deep-link (when user clicks the email link in the same browser)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verifyEmail')
    if (token) {
      // Hit the confirm endpoint
      fetch(`/api/verify/email-confirm?token=${encodeURIComponent(token)}`)
        .then(() => {
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname)
          load()
        })
        .catch(() => {})
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const items = [
    {
      id: 'EMAIL',
      icon: Mail,
      title: 'Email Verification',
      description: 'Confirm your email address to receive ride confirmations and chat notifications.',
      status: status?.emailVerified ? 'APPROVED' : 'PENDING',
      action: async () => {
        try {
          const r: any = await api.verify.email()
          if (r.alreadyVerified) {
            toast.info('Email already verified')
            return
          }
          setEmailSent(true)
          setEmailPending(true)
          toast.success('Verification email sent! Check your inbox.')
          if (r.devToken) {
            // In dev, show the token in case SMTP isn't reachable
            toast.info(`Dev mode: click this link to verify`, {
              description: `${window.location.origin}/?verifyEmail=${r.devToken}`,
              duration: 10000,
            })
          }
          await load()
        } catch (e: any) {
          toast.error(e.message || 'Failed to send verification email')
        }
      },
      cta: status?.emailVerified ? 'Verified' : (emailPending ? 'Resend email' : 'Send verification email'),
      done: status?.emailVerified,
    },
    {
      id: 'PHONE',
      icon: Phone,
      title: 'Phone Verification',
      description: 'Verify your phone number so drivers/passengers can reach you on pickup.',
      status: status?.phoneVerified ? 'APPROVED' : 'PENDING',
      action: async () => {
        await api.verify.phone(user?.phone || '')
        toast.success('Phone verified!')
        await load(); await refresh()
      },
      cta: status?.phoneVerified ? 'Verified' : 'Verify now',
      done: status?.phoneVerified,
    },
    {
      id: 'KYC',
      icon: IdCard,
      title: 'KYC Verification',
      description: 'Identity verification (Aadhaar / Govt ID) required before booking any ride.',
      status: status?.kycStatus,
      action: async () => {
        await api.verify.kyc({ aadhaarNumber: 'auto-approved', documentUrl: null })
        toast.success('KYC approved!')
        await load(); await refresh()
      },
      cta: status?.kycStatus === 'APPROVED' ? 'Approved' : 'Submit KYC',
      done: status?.kycStatus === 'APPROVED',
    },
    {
      id: 'DRIVER',
      icon: Car,
      title: 'Driver Verification',
      description: 'Submit your driving license. Required before you can offer rides.',
      status: status?.driverStatus,
      action: null, // handled by inline form below
      cta: status?.driverStatus === 'APPROVED' ? 'Approved' : 'Open form',
      done: status?.driverStatus === 'APPROVED',
    },
    {
      id: 'VEHICLE',
      icon: FileCheck2,
      title: 'Vehicle Verification',
      description: 'Register your vehicle (RC + insurance). Required before offering rides.',
      status: status?.hasApprovedVehicle ? 'APPROVED' : 'PENDING',
      action: null,
      cta: status?.hasApprovedVehicle ? 'Approved' : 'Add vehicle',
      done: status?.hasApprovedVehicle,
    },
  ]

  const allPassengerReady = status?.canBookRide
  const allDriverReady = status?.canOfferRide

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(user?.activeRole === 'DRIVER' ? 'driver.dashboard' : 'passenger.dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <ZovoLogo />
          </div>
          <Button
            onClick={() => navigate(user?.activeRole === 'DRIVER' ? 'driver.dashboard' : 'passenger.dashboard')}
            disabled={!allPassengerReady}
          >
            {allPassengerReady ? 'Continue' : 'Complete verification to continue'}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Verification Hub</h1>
          <p className="text-muted-foreground mt-1">
            Complete verification steps to unlock booking and ride-sharing features.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className={allPassengerReady ? 'border-primary' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full grid place-items-center ${allPassengerReady ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Passenger Ready</div>
                <div className="text-sm text-muted-foreground">
                  {allPassengerReady ? 'You can book rides now.' : 'Complete Email + Phone + KYC.'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={allDriverReady ? 'border-primary' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full grid place-items-center ${allDriverReady ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <Car className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Driver Ready</div>
                <div className="text-sm text-muted-foreground">
                  {allDriverReady ? 'You can offer rides now.' : 'Complete Driver + Vehicle verification.'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center">
                      <it.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{it.title}</CardTitle>
                      <CardDescription className="mt-1">{it.description}</CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {it.id === 'DRIVER' && !it.done ? (
                  <DriverForm onDone={async () => { await load(); await refresh() }} />
                ) : it.id === 'VEHICLE' && !it.done ? (
                  <VehicleForm onDone={async () => { await load(); await refresh() }} />
                ) : (
                  <Button
                    onClick={it.action || (() => {})}
                    disabled={!it.action || it.done}
                    variant={it.done ? 'secondary' : 'default'}
                    size="sm"
                  >
                    {it.done && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    {it.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          In development mode, Phone & KYC are auto-approved. Driver & Vehicle verifications are also auto-approved
          for testing — the full admin-review workflow is wired up at <code>/api/admin/verify/review</code>.
        </p>
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
  if (status === 'REJECTED') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
  if (status === 'PENDING') return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>
  return <Badge variant="outline">{status || 'NONE'}</Badge>
}

function DriverForm({ onDone }: { onDone: () => Promise<void> }) {
  const [form, setForm] = useState({
    licenseNumber: '',
    licenseExpiry: '',
    aadhaarNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.licenseNumber || !form.licenseExpiry) {
      toast.error('License number and expiry are required')
      return
    }
    setSubmitting(true)
    try {
      await api.verify.driver(form)
      toast.success('Driver verification submitted & auto-approved (dev mode)')
      await onDone()
    } catch (e: any) {
      toast.error(e.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lic">License Number</Label>
          <Input id="lic" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="GJ01 20240001234" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp">License Expiry</Label>
          <Input id="exp" type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="aadhaar">Aadhaar Number (optional)</Label>
          <Input id="aadhaar" value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })} placeholder="XXXX XXXX XXXX" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Submit for verification
      </Button>
    </form>
  )
}

function VehicleForm({ onDone }: { onDone: () => Promise<void> }) {
  const [form, setForm] = useState({
    make: '',
    model: '',
    year: String(new Date().getFullYear()),
    plateNumber: '',
    color: '',
    vehicleType: 'SEDAN',
    totalSeats: '4',
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.make || !form.model || !form.plateNumber || !form.color) {
      toast.error('Please fill all required fields')
      return
    }
    setSubmitting(true)
    try {
      await api.verify.vehicle(form as any)
      toast.success('Vehicle registered & auto-approved (dev mode)')
      await onDone()
    } catch (e: any) {
      toast.error(e.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Make *</Label>
          <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Maruti" />
        </div>
        <div className="space-y-1.5">
          <Label>Model *</Label>
          <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Swift" />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Plate Number *</Label>
          <Input value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="GJ01 AB 1234" />
        </div>
        <div className="space-y-1.5">
          <Label>Color *</Label>
          <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="White" />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SEDAN">Sedan</SelectItem>
              <SelectItem value="SUV">SUV</SelectItem>
              <SelectItem value="HATCHBACK">Hatchback</SelectItem>
              <SelectItem value="AUTO">Auto</SelectItem>
              <SelectItem value="BIKE">Bike</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Total Seats</Label>
          <Select value={form.totalSeats} onValueChange={(v) => setForm({ ...form, totalSeats: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} seats</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Register vehicle
      </Button>
    </form>
  )
}
