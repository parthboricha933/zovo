'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ZovoLogo } from '../shared/logo'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { Car, Users, ShieldCheck, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function RoleSelectScreen() {
  const { user, switchRole } = useAuthStore()
  const navigate = useUIStore((s) => s.navigate)

  const pick = async (role: 'PASSENGER' | 'DRIVER') => {
    try {
      await switchRole(role)
      toast.success(`You're now using ZOVO as a ${role.toLowerCase()}`)
      navigate(role === 'DRIVER' ? 'driver.dashboard' : 'passenger.dashboard')
    } catch (e: any) {
      toast.error(e.message || 'Failed to switch role')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mb-8 text-center">
        <ZovoLogo size="lg" className="justify-center" />
        <h1 className="mt-6 text-3xl font-bold">How do you want to use ZOVO?</h1>
        <p className="mt-2 text-muted-foreground max-w-md">
          You can switch between roles anytime from your profile.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-3xl">
        <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group" >
          <button onClick={() => pick('PASSENGER')} className="w-full text-left">
            <div className="aspect-video bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <Users className="h-16 w-16 text-primary" strokeWidth={1.5} />
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Passenger</h2>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground">
                Search for rides going your direction, book a seat, track your driver live, and pay with cash or UPI.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['Search rides', 'Live tracking', 'OTP ride start', 'In-app chat'].map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>
                ))}
              </div>
            </CardContent>
          </button>
        </Card>

        <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
          <button onClick={() => pick('DRIVER')} className="w-full text-left">
            <div className="aspect-video bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center">
              <Car className="h-16 w-16 text-accent-foreground" strokeWidth={1.5} />
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Driver</h2>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground">
                Offer empty seats on trips you're already making. Earn money, get rated, and manage your bookings.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['Offer rides', 'Accept requests', 'Verify OTP', 'Track earnings'].map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>
                ))}
              </div>
            </CardContent>
          </button>
        </Card>
      </div>

      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        Verification required before booking or offering rides.
      </div>

      {user?.isAdmin && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('admin.dashboard')}
        >
          Go to Admin Panel →
        </Button>
      )}
    </div>
  )
}
