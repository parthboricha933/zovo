'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useRealtimeStore } from '@/lib/stores/realtime-store'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { Bell, Menu, X, LogOut, RefreshCw, ShieldCheck, Settings, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { ZovoLogo } from './logo'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/lib/api-client'

interface NavItem {
  view: string
  label: string
  icon: any
}

const PASSENGER_NAV: NavItem[] = [
  { view: 'passenger.search', label: 'Search Ride', icon: 'Search' },
  { view: 'passenger.current', label: 'Current Booking', icon: 'MapPin' },
  { view: 'passenger.history', label: 'Booking History', icon: 'History' },
  { view: 'passenger.support', label: 'Support', icon: 'HelpCircle' },
  { view: 'passenger.profile', label: 'Profile', icon: 'User' },
]

const DRIVER_NAV: NavItem[] = [
  { view: 'driver.dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { view: 'driver.offer', label: 'Offer Ride', icon: 'PlusCircle' },
  { view: 'driver.requests', label: 'Ride Requests', icon: 'Inbox' },
  { view: 'driver.active', label: 'Active Ride', icon: 'MapPin' },
  { view: 'driver.upcoming', label: 'Upcoming Rides', icon: 'CalendarClock' },
  { view: 'driver.earnings', label: 'Earnings', icon: 'Wallet' },
  { view: 'driver.history', label: 'Ride History', icon: 'History' },
  { view: 'driver.profile', label: 'Profile', icon: 'User' },
]

const ADMIN_NAV: NavItem[] = [
  { view: 'admin.dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { view: 'admin.users', label: 'Users', icon: 'Users' },
  { view: 'admin.rides', label: 'Rides', icon: 'Car' },
  { view: 'admin.verifications', label: 'Verifications', icon: 'ShieldCheck' },
  { view: 'admin.payments', label: 'Payments', icon: 'Wallet' },
]

// We use a dynamic icon map
import * as Icons from 'lucide-react'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout, refresh } = useAuthStore()
  const { view, navigate, sidebarOpen, setSidebarOpen } = useUIStore()
  const { init, disconnect } = useRealtimeStore()
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // Init realtime once user is logged in
  useEffect(() => {
    if (!user) return
    // The cookie holds the JWT; we re-derive a short-lived token for the socket
    // by calling /api/auth/me and then... actually we can read the cookie? No — it's httpOnly.
    // We'll fetch a one-time socket token from /api/auth/me and pass it.
    // Simpler: emit token via fetch to /api/auth/socket-token? — we don't have one.
    // Easiest: read cookie via document.cookie? It's httpOnly so not accessible.
    // Solution: we expose the token via a non-httpOnly meta tag set on /api/auth/me.
    // For now: the socket auth uses the JWT — but client can't read it.
    // Workaround: have socket auth bypass if a special header is set. Actually simpler:
    // the realtime init takes a token. We'll fetch a fresh token from /api/auth/me —
    // it returns the user but not the token.
    //
    // We'll add a /api/auth/socket-token endpoint to mint a fresh JWT for the socket.
    api.auth.me().then(() => {
      // We need an actual token string. Fetch from /api/auth/socket-token.
      return fetch('/api/auth/socket-token', { credentials: 'include' }).then((r) => r.json())
    }).then((data) => {
      if (data?.token) init(data.token)
    }).catch(() => {})
    return () => disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Listen for notifications
  useEffect(() => {
    const { on } = useRealtimeStore.getState()
    const off = on('notification', (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50))
      setUnread((u) => u + 1)
    })
    return off
  }, [])

  // Load unread count + recent notifications
  // Poll more aggressively when socket isn't connected (Vercel production fallback)
  const { connected: socketConnected } = useRealtimeStore()
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const [{ count }, { items }] = await Promise.all([
          api.notifications.unreadCount(),
          api.notifications.list(),
        ])
        setUnread(count)
        setNotifications(items)
      } catch {}
    }
    load()
    // Poll every 30s when socket is connected, every 8s when not (fallback)
    const interval = socketConnected ? 30000 : 8000
    const i = setInterval(load, interval)
    return () => clearInterval(i)
  }, [user?.id, socketConnected])

  if (!user) return null

  const nav = user.activeRole === 'DRIVER' ? DRIVER_NAV : user.activeRole === 'ADMIN' ? ADMIN_NAV : PASSENGER_NAV
  if (user.activeRole === 'ADMIN') {
    // Admin uses its own layout — render children directly
    return <AdminShell>{children}</AdminShell>
  }

  const IconCmp = (name: string) => (Icons as any)[name] || Icons.Circle

  const Sidebar = (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="p-4 border-b">
        <button onClick={() => navigate(user.activeRole === 'DRIVER' ? 'driver.dashboard' : 'passenger.dashboard')}>
          <ZovoLogo />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto zovo-scroll">
        {nav.map((item) => {
          const Icon = IconCmp(item.icon)
          const active = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t space-y-1">
        <button
          onClick={() => navigate('passenger.profile')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-sidebar-accent text-sidebar-foreground"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="truncate text-xs font-semibold">{user.name}</div>
            <div className="truncate text-[10px] text-muted-foreground capitalize">{user.activeRole}</div>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={async () => { await logout(); navigate('auth') }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r">{Sidebar}</aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {Sidebar}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="lg:hidden">
                <ZovoLogo size="sm" />
              </div>
              <div className="hidden lg:block">
                <h1 className="text-sm font-semibold capitalize">
                  {nav.find((n) => n.view === view)?.label || 'Dashboard'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => refresh()} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotifs((s) => !s)}
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-4 px-1 grid place-items-center text-[10px] font-bold rounded-full bg-destructive text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto zovo-scroll bg-popover border rounded-xl shadow-xl z-50">
                    <div className="p-3 border-b flex items-center justify-between">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unread > 0 && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={async () => {
                            await api.notifications.markRead()
                            setUnread(0)
                            setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={async () => {
                            if (!n.readAt) {
                              await api.notifications.markRead(n.id)
                              setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
                              setUnread((u) => Math.max(0, u - 1))
                            }
                          }}
                          className={cn(
                            'w-full text-left p-3 border-b last:border-b-0 hover:bg-muted/50 flex gap-3',
                            !n.readAt && 'bg-primary/5'
                          )}
                        >
                          <div className={cn('h-2 w-2 rounded-full mt-1.5', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{n.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {!user.emailVerified || !user.phoneVerified || user.kycStatus !== 'APPROVED' ? (
                <Button size="sm" variant="outline" onClick={() => navigate('verification')}>
                  <ShieldCheck className="h-4 w-4 mr-1.5" /> Verify
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('passenger.profile')}
                className="hidden sm:inline-flex"
              >
                <Settings className="h-4 w-4 mr-1.5" /> Profile
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto zovo-scroll bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const { view, navigate } = useUIStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) return null
  const IconCmp = (name: string) => (Icons as any)[name] || Icons.Circle

  const Sidebar = (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-zinc-100 text-zinc-950 grid place-items-center">
            <Icons.Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight">ZOVO Admin</div>
            <div className="text-[10px] text-zinc-400 uppercase">Control Panel</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {ADMIN_NAV.map((item) => {
          const Icon = IconCmp(item.icon)
          const active = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-zinc-300 hover:bg-zinc-800"
          onClick={async () => { await logout(); navigate('auth') }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-zinc-50">
      <aside className="hidden lg:block w-64 shrink-0">{Sidebar}</aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-zinc-950">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          {Sidebar}
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-sm font-semibold">
                {ADMIN_NAV.find((n) => n.view === view)?.label || 'Overview'}
              </h1>
            </div>
            <Badge variant="secondary">{user.email}</Badge>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto zovo-scroll">{children}</main>
      </div>
    </div>
  )
}
