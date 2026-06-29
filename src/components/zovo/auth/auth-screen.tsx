'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ZovoLogo } from '../shared/logo'
import { GoogleSignInButton } from '../shared/google-sign-in-button'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, User as UserIcon, Phone, Car } from 'lucide-react'

export function AuthScreen() {
  const { login, signup, googleLogin, loading } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  })

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(loginForm.email, loginForm.password)
      toast.success('Welcome back to ZOVO!')
    } catch (err: any) {
      toast.error(err.message || 'Login failed')
    }
  }

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await signup(signupForm)
      toast.success('Account created! Welcome to ZOVO.')
    } catch (err: any) {
      toast.error(err.message || 'Signup failed')
    }
  }

  const onGoogle = async () => {
    // Triggered by GoogleSignInButton after a successful GIS callback
    await useAuthStore.getState().init()
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Brand / hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="zovo-grid-bg absolute inset-0 opacity-10" />
        <div className="relative">
          <ZovoLogo size="lg" className="[&_span]:text-primary-foreground [&_div]:bg-white/15" />
        </div>
        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Share the ride.<br />Share the journey.
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            ZOVO connects drivers going somewhere with passengers heading the same way.
            Save money, reduce emissions, meet interesting people.
          </p>
          <div className="space-y-3 pt-4">
            {[
              { icon: Car, t: 'Real-time ride matching', d: 'Find rides on your route in seconds.' },
              { icon: UserIcon, t: 'Verified drivers & passengers', d: 'KYC, phone, and email verification built-in.' },
              { icon: Mail, t: 'Live GPS tracking + in-app chat', d: 'Stay connected from pickup to drop-off.' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="rounded-lg bg-white/15 p-2">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-primary-foreground">{f.t}</div>
                  <div className="text-sm text-primary-foreground/70">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} ZOVO. All rights reserved.
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <ZovoLogo size="lg" />
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? 'Enter your credentials to continue your journey.'
                  : 'Join ZOVO and start sharing rides today.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* LOGIN */}
                <TabsContent value="login">
                  <form onSubmit={onLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          required
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          placeholder="you@example.com"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          required
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          placeholder="••••••••"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>

                {/* SIGNUP */}
                <TabsContent value="signup">
                  <form onSubmit={onSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          required
                          minLength={2}
                          value={signupForm.name}
                          onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                          placeholder="Jane Doe"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          required
                          value={signupForm.email}
                          onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                          placeholder="you@example.com"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone (optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={signupForm.phone}
                          onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          required
                          minLength={6}
                          value={signupForm.password}
                          onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                          placeholder="At least 6 characters"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <GoogleSignInButton onSuccess={onGoogle} disabled={loading} />

              <p className="text-xs text-muted-foreground text-center mt-4">
                Demo admin: <span className="font-mono">admin@zovo.app / admin123</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
