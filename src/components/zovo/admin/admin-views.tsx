'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Users, Car, ShieldCheck, IndianRupee, TrendingUp, Loader2,
  Search, Ban, ShieldAlert, Crown, Check, X, MapPin, Clock, Star, Activity,
} from 'lucide-react'

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.stats().then(setStats).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading || !stats) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Platform Overview</h2>
        <p className="text-muted-foreground mt-1">Real-time stats from the ZOVO database.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-100 text-blue-800" />
        <StatBox label="Drivers" value={stats.totalDrivers} icon={Car} color="bg-emerald-100 text-emerald-800" />
        <StatBox label="Passengers" value={stats.totalPassengers} icon={Users} color="bg-amber-100 text-amber-800" />
        <StatBox label="Pending Verifications" value={stats.pendingVerifications} icon={ShieldCheck} color="bg-red-100 text-red-800" />
        <StatBox label="Active Rides" value={stats.activeRides} icon={Activity} color="bg-blue-100 text-blue-800" />
        <StatBox label="Completed Rides" value={stats.completedRides} icon={Car} color="bg-emerald-100 text-emerald-800" />
        <StatBox label="Platform Earnings" value={`₹${stats.platformEarnings}`} icon={IndianRupee} color="bg-primary/10 text-primary" />
        <StatBox label="Total Revenue" value={`₹${stats.totalRevenue}`} icon={TrendingUp} color="bg-emerald-100 text-emerald-800" />
      </div>

      {stats.revenueByDay && stats.revenueByDay.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue — Last 7 days</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {stats.revenueByDay.map((d: any) => {
                const max = Math.max(...stats.revenueByDay.map((x: any) => x.revenue), 1)
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-muted-foreground">₹{Math.round(d.revenue)}</div>
                    <div className="w-full bg-primary rounded-t" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: '4px' }} />
                    <div className="text-[10px] text-muted-foreground">{d.day.slice(5)}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Rides</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {stats.recentRides && stats.recentRides.length > 0 ? (
              stats.recentRides.map((r: any) => (
                <div key={r.id} className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.pickupAddress.split(',')[0]} → {r.destAddress.split(',')[0]}</div>
                    <div className="text-xs text-muted-foreground">{r.driver?.name} • {format(new Date(r.departureTime), 'dd MMM HH:mm')}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{r.status}</Badge>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.bookingCount} bookings • ₹{r.totalBookingValue}</div>
                  </div>
                </div>
              ))
            ) : <div className="p-8 text-center text-muted-foreground text-sm">No rides yet</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold mt-0.5">{value}</div>
          </div>
          <div className={`h-9 w-9 rounded-lg grid place-items-center ${color}`}><Icon className="h-4 w-4" /></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.admin.users(q, role)
      setUsers(r.items)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [q, role])

  const action = async (userId: string, a: string) => {
    try {
      await api.admin.userAction(userId, a)
      toast.success(`User ${a} applied`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-2xl font-bold">User Management</h2>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone…" className="pl-9" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded-md px-3 text-sm">
          <option value="">All roles</option>
          <option value="PASSENGER">Passengers</option>
          <option value="DRIVER">Drivers</option>
          <option value="ADMIN">Admins</option>
        </select>
      </div>

      {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[auto,1fr,auto] gap-3 items-center">
                  <div className="h-10 w-10 rounded-full bg-zinc-200 text-zinc-700 grid place-items-center font-bold">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {u.name}
                      {u.isAdmin && <Badge className="bg-zinc-900 text-white"><Crown className="h-3 w-3 mr-1" />Admin</Badge>}
                      {u.isBanned && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Banned</Badge>}
                      <Badge variant="outline" className="capitalize">{u.activeRole}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email} • {u.phone || 'No phone'}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.emailVerified && <Badge variant="secondary" className="text-[10px]">Email ✓</Badge>}
                      {u.phoneVerified && <Badge variant="secondary" className="text-[10px]">Phone ✓</Badge>}
                      {u.kycStatus === 'APPROVED' && <Badge variant="secondary" className="text-[10px]">KYC ✓</Badge>}
                      {u.driverStatus === 'APPROVED' && <Badge variant="secondary" className="text-[10px]">Driver ✓</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!u.isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => action(u.id, u.isBanned ? 'unban' : 'ban')} className={u.isBanned ? '' : 'text-destructive'}>
                        {u.isBanned ? <><Check className="h-3 w-3 mr-1" />Unban</> : <><Ban className="h-3 w-3 mr-1" />Ban</>}
                      </Button>
                    )}
                    {!u.isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => action(u.id, 'makeAdmin')}>
                        <Crown className="h-3 w-3 mr-1" />Make admin
                      </Button>
                    )}
                    {u.isAdmin && !u.isBanned && (
                      <Button size="sm" variant="outline" onClick={() => action(u.id, 'removeAdmin')}>
                        <X className="h-3 w-3 mr-1" />Remove admin
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminRides() {
  const [rides, setRides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.admin.rides(status)
      setRides(r.items)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [status])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-2xl font-bold">Ride Management</h2>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option value="SCHEDULED">Scheduled</option>
        <option value="ACTIVE">Active</option>
        <option value="ONGOING">Ongoing</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : (
        <div className="space-y-2">
          {rides.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[1fr,auto] gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{r.status}</Badge>
                      <span className="font-medium">{r.pickupAddress.split(',')[0]} → {r.destAddress.split(',')[0]}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Driver: {r.driver?.name} • {format(new Date(r.departureTime), 'dd MMM yyyy, HH:mm')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.vehicle?.make} {r.vehicle?.model} • {r.vehicle?.plateNumber}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">₹{r.totalRevenue}</div>
                    <div className="text-xs text-muted-foreground">{r.confirmedBookings} confirmed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminVerifications() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.admin.verifyList()
      setItems(r.items)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const review = async (id: string, status: string) => {
    try {
      await api.admin.verifyReview(id, status)
      toast.success(`Verification ${status.toLowerCase()}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-2xl font-bold">Pending Verifications</h2>
      {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : items.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><h3 className="font-semibold">All caught up!</h3><p className="text-muted-foreground mt-1">No pending verifications.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[1fr,auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{v.type}</Badge>
                      <span className="font-medium">{v.user?.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{v.user?.email} • {v.user?.phone || 'No phone'}</div>
                    <div className="text-xs text-muted-foreground">Submitted {format(new Date(v.submittedAt), 'dd MMM yyyy, HH:mm')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(v.id, 'APPROVED')}><Check className="h-3 w-3 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => review(v.id, 'REJECTED')}><X className="h-3 w-3 mr-1" />Reject</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.payments().then((r) => setPayments(r.items)).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-2xl font-bold">Payments</h2>
      {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : payments.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><IndianRupee className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><h3 className="font-semibold">No payments yet</h3></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y">
            {payments.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{p.booking?.passenger?.name} → {p.booking?.ride?.pickupAddress.split(',')[0]} → {p.booking?.ride?.destAddress.split(',')[0]}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(p.createdAt), 'dd MMM yyyy, HH:mm')} • {p.method}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">₹{p.amount}</div>
                  <Badge variant={p.status === 'PAID' ? 'default' : 'secondary'}>{p.status}</Badge>
                  <div className="text-xs text-muted-foreground mt-0.5">Fee ₹{p.platformFee} • Payout ₹{p.driverPayout}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
